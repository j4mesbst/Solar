import { streamChat, ChatError } from "../src/services/chatApi.ts";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const provider = { id: "router", name: "Gonka Router", protocol: "openai-compatible", baseUrl: "https://example.test/v1", secretRef: "key", enabled: true, connectionState: "connected" };
const messages = [{ id: "u1", conversationId: "c1", role: "user", content: "hello", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", order: 0 }];
const encoder = new TextEncoder(); let request;
globalThis.fetch = async (_url, init) => { request = init; return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n')); controller.close(); } }), { status: 200 }); };
let answer = "";
await streamChat({ provider, model: "model-a", messages, effort: "high", vault: { get: async () => "non-sensitive-test-key" }, signal: new AbortController().signal, onDelta: text => { answer += text; } });
assert(answer === "Hello", "SSE chunks should be concatenated");
assert(JSON.parse(request.body).stream === true, "request should ask for real streaming");
assert(JSON.parse(request.body).model === "model-a", "request should use selected model");
assert(JSON.parse(request.body).max_tokens === 3072, "high effort should reserve enough output tokens");
assert(JSON.parse(request.body).messages[0].role === "system", "effort should add a response instruction");
assert(!answer.includes("<think>"), "internal reasoning tags must not reach the chat UI");
globalThis.fetch = async () => new Response("", { status: 401 });
try { await streamChat({ provider, model: "model-a", messages, effort: "medium", vault: { get: async () => "x" }, signal: new AbortController().signal, onDelta: () => {} }); throw new Error("401 should fail"); } catch (error) { assert(error instanceof ChatError && error.code === "unauthorized", "401 should normalize"); }
console.log("chat-contract-tests: ok");

const runChunks = async (chunks, extra = {}) => {
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { status: 200 });
  let result = "";
  await streamChat({ provider, model: "model-a", messages, effort: "medium", vault: { get: async () => "test" }, signal: new AbortController().signal, onDelta: text => { result += text; }, ...extra });
  return result;
};
const delta = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\n`;
assert(await runChunks([delta("ha"), delta("ha"), delta(" "), delta(" "), delta("!"), delta("!"), "data: [DONE]\n\n"]) === "haha  !!", "legitimate repeated tokens and whitespace must survive");
const secretFragments = ["<", "thi", "nk>", "private thought", "</th", "ink>", "Réponse ", "<ana", "lysis>", "private", "</analysis>", "visible."];
const answerWithoutThought = await runChunks([...secretFragments.map(delta), "data: [DONE]"]);
assert(answerWithoutThought === "Réponse visible.", "split reasoning tags must never leak or freeze the answer");
assert(await runChunks([delta("x < 3 et y > 2"), "data: [DONE]\n\n"]) === "x < 3 et y > 2", "ordinary angle brackets must survive");
const snapshot = text => `data: ${JSON.stringify({ choices: [{ message: { content: text } }] })}\n\n`;
assert(await runChunks([snapshot("Salut"), snapshot("Salut !"), snapshot("Salut !"), "data: [DONE]\n\n"]) === "Salut !", "explicit snapshots must not replay content");
const local = { ...provider, protocol: "ollama", baseUrl: "http://localhost:11434" };
assert(await runChunks(['{"message":{"content":"Bon"},"done":false}\n', '{"message":{"content":"jour"},"done":true}'], { provider: local, vault: { get: async () => { throw new Error("local inference must not require a key"); } } }) === "Bonjour", "Ollama NDJSON must stream without a key");
try { await runChunks([delta("partial")]); throw new Error("truncated stream must fail"); } catch (error) { assert(error instanceof ChatError && error.code === "network", "truncated stream must retain partial response with a meaningful error"); }
try { await runChunks(['data: {broken}\n\n']); throw new Error("bad JSON must fail"); } catch (error) { assert(error instanceof ChatError && error.code === "invalid-response", "malformed chunks must fail clearly"); }
const cancelled = new AbortController(); cancelled.abort();
try { await runChunks([delta("hello"), "data: [DONE]\n\n"], { signal: cancelled.signal }); throw new Error("cancel must fail"); } catch (error) { assert(error instanceof ChatError && error.code === "interrupted", "cancellation should normalize"); }
console.log("stream-regression-tests: ok");

const activityStages=[];const hidden=await runChunks([`data: ${JSON.stringify({choices:[{delta:{reasoning_content:"hidden private content"}}]})}\n\n`,delta("<think>private</think>"),delta("Visible"),"data: [DONE]\n\n"],{onActivity:s=>activityStages.push(s)});assert(hidden==="Visible","activity events never reveal reasoning");assert(activityStages.join(",")==="connecting,waiting,thinking,writing","stages reflect received stream events");console.log("activity-contracts: ok (real connection/reasoning/writing events without reasoning exposure)");
