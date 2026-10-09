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
globalThis.fetch = async () => new Response("", { status: 401 });
try { await streamChat({ provider, model: "model-a", messages, effort: "medium", vault: { get: async () => "x" }, signal: new AbortController().signal, onDelta: () => {} }); throw new Error("401 should fail"); } catch (error) { assert(error instanceof ChatError && error.code === "unauthorized", "401 should normalize"); }
console.log("chat-contract-tests: ok");
