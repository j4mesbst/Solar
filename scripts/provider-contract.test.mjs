import { validateProviderInput, providerApi, ProviderError } from "../src/services/providerApi.ts";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(validateProviderInput("", "https://example.com", "x"), "empty name should fail");
assert(validateProviderInput("Gonka", "not-a-url", "x"), "bad URL should fail");
assert(validateProviderInput("Gonka", "https://example.com/v1", ""), "empty secret should fail");

const provider = { id: "p", name: "Test", protocol: "openai-compatible", baseUrl: "https://example.com/v1", secretRef: "secret", enabled: true, connectionState: "unknown" };
const vault = { get: async () => "test-secret" };
let requestHeaders;
globalThis.fetch = async (_url, init) => { requestHeaders = init.headers; return new Response(JSON.stringify({ data: [{ id: "model-a" }] }), { status: 200 }); };
const models = await providerApi.discoverModels(provider, vault);
assert(models[0].providerModelId === "model-a" && models[0].source === "remote", "models response should map");
assert(requestHeaders.Authorization === "Bearer test-secret" && requestHeaders["x-api-key"] === "test-secret", "auth headers should be sent in both compatible formats");

globalThis.fetch = async () => new Response("", { status: 401 });
try { await providerApi.test(provider, vault); throw new Error("401 should fail"); } catch (error) { assert(error instanceof ProviderError && error.code === "unauthorized", "401 should normalize"); }
globalThis.fetch = async () => { throw new Error("offline"); };
try { await providerApi.test(provider, vault); throw new Error("offline should fail"); } catch (error) { assert(error instanceof ProviderError && error.code === "unavailable", "offline should normalize"); }
globalThis.fetch = async () => new Response("{}", { status: 200 });
try { await providerApi.test(provider, vault); throw new Error("invalid response should fail"); } catch (error) { assert(error instanceof ProviderError && error.code === "invalid-response", "invalid response should normalize"); }

console.log("provider-contract-tests: ok");
assert(validateProviderInput("Ollama", "http://localhost:11434", "", "ollama") === null, "Ollama must not require an API key");
let localUrl;
globalThis.fetch = async (url, init) => { localUrl = url; assert(!init.headers.Authorization, "local discovery must not send an API key"); return new Response(JSON.stringify({ models: [{ name: "qwen:test" }] }), { status: 200 }); };
const localModels = await providerApi.discoverModels({ ...provider, protocol: "ollama", baseUrl: "http://localhost:11434" }, { get: async () => { throw new Error("local discovery must not require the vault"); } });
assert(localUrl.endsWith("/api/tags") && localModels[0].providerModelId === "qwen:test", "Ollama tags must map to model IDs");
console.log("local-provider-tests: ok");
