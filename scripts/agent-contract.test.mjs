import assert from "node:assert/strict";
import { SolarAgentRuntime, analyzeIntent, modelProfile, contextBudget, buildRepositoryIndex, selectProjectContext, parseAgentResponse, validateAction, verifyStagedChanges } from "../src/lib/agent/index.ts";

const source = new Map([
  ["src/ChatView.tsx", 'import { Other } from "./Other";\nexport const ChatView = () => <button>Old</button>;\n'],
  ["src/Other.tsx", "export const Other = 1;\n"],
  ["package.json", '{"scripts":{"build":"vite build"}}'],
  ["src/value.ts", "export const value = 0;\n"],
]);
const project = { id: "test-project", name: "Demo", files: [...source.keys(), ...Array.from({ length: 80 }, (_, i) => `src/unrelated${i}.ts`)], readFile: async path => source.get(path) ?? "export const unrelated = true;\n" };
const four = modelProfile("qwen3:4b", "Solar 4B", "ollama");
const nine = modelProfile("hf.co/ornith-ai/Ornith-1.0-9B-GGUF:Q4_K_M", "Solar 9B", "ollama");
const twelve = modelProfile("gemma3:12b", "Solar 12B", "ollama");
assert.equal(four.parameterClass, "small");
assert.equal(nine.parameterClass, "medium");
assert.equal(twelve.parameterClass, "largeLocal");
assert(four.maxFiles < twelve.maxFiles && four.temperature < twelve.temperature);
assert(contextBudget(four).maximumTokens < contextBudget(twelve).maximumTokens);

const intent = analyzeIntent("Modifie ChatView.tsx pour remplacer Old par New sans toucher les autres fichiers.");
const index = buildRepositoryIndex(project);
const selection = await selectProjectContext(intent, project, index, contextBudget(four), new AbortController().signal, four.maxFiles);
assert(selection.files.some(file => file.path === "src/ChatView.tsx"));
assert(selection.files.length <= four.maxFiles && selection.files.length < project.files.length);
assert(selection.estimatedTokens <= selection.budget);
assert(!selection.files.some(file => file.path.startsWith("src/unrelated")));
assert.deepEqual(parseAgentResponse('```json\n{"actions":[{"type":"finish","message":"OK"}],}\n```').actions[0], { type: "finish", message: "OK" });
assert.throws(() => parseAgentResponse('{"actions":[{"type":"deleteFile","path":"src/ChatView.tsx"}]}'));
assert.match(validateAction({ type: "runCommand", command: "rm -rf ." }, project, new Map(), true), /jamais exécutées/);
assert.match(validateAction({ type: "readFile", path: "../.env" }, project, new Map(), true), /Chemin/);
assert.match(validateAction({ type: "createFile", path: "src/new.ts", content: "ok" }, project, new Map(), false), /désactivés/);

const patch = { actions: [{ type: "patchFile", path: "src/ChatView.tsx", oldText: "Old", newText: "New" }], finalMessage: "Patch préparé" };
const runtime = new SolarAgentRuntime();
let proposed = [];
const output = await runtime.run({ userPrompt: intent.objective, conversationId: "c1", model: nine, project, mode: "fast", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => { if (call.visible) { call.onDelta?.("Patch vérifié."); return "Patch vérifié."; } return JSON.stringify(patch); },
  onProposal: async changes => { proposed = changes; },
});
assert.equal(output.changedFiles.length, 1);
assert.equal(output.changedFiles[0].after.includes("New"), true);
assert.equal(proposed.length, 1);
assert.equal(source.get("src/ChatView.tsx")?.includes("Old"), true, "le projet ne doit pas être modifié avant approbation");
assert(output.verificationResults.every(result => result.success));
assert.equal(output.mode, "fast");

const invalid = await verifyStagedChanges([{ path: "src/value.ts", before: "export const value = 0;", after: "export const value = ;" }], selection, project.files, new AbortController().signal);
assert(invalid.some(result => result.type === "syntax" && !result.success));
let calls = 0;
const repaired = await new SolarAgentRuntime().run({ userPrompt: "Corrige value.ts", conversationId: "c2", model: twelve, project, mode: "balanced", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => {
    if (call.visible) { call.onDelta?.("Correction proposée."); return "Correction proposée."; }
    if ("objective" in (call.schema?.properties ?? {})) return JSON.stringify({ objective: "Corriger", steps: [{ id: "1", action: "Modifier value.ts", files: ["src/value.ts"], expectedResult: "Syntaxe valide" }] });
    calls++;
    return calls === 1 ? JSON.stringify({ actions: [{ type: "replaceFile", path: "src/value.ts", content: "export const value = ;\n" }] }) : JSON.stringify({ actions: [{ type: "patchFile", path: "src/value.ts", oldText: "= ;", newText: "= 1;" }] });
  },
});
assert.equal(repaired.changedFiles[0].after, "export const value = 1;\n");
assert.equal(repaired.metrics.repairIterations, 1);
assert(repaired.verificationResults.every(result => result.success));

let rejected = 0;
const safe = await new SolarAgentRuntime().run({ userPrompt: "Modifie ChatView.tsx", conversationId: "c3", model: four, project, mode: "fast", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => { if (call.visible) return "Terminé."; rejected++; return rejected === 1 ? '{"actions":[{"type":"runCommand","command":"rm -rf ."}]}' : JSON.stringify(patch); },
});
assert.equal(safe.changedFiles.length, 1);
assert.equal(safe.metrics.repairIterations, 1);

const created = await new SolarAgentRuntime().run({ userPrompt: "Crée src/NewComponent.tsx", conversationId: "c4", model: nine, project, mode: "fast", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => call.visible ? "Composant proposé." : JSON.stringify({ actions: [{ type: "createFile", path: "src/NewComponent.tsx", content: "export const NewComponent = () => <div />;" }] }),
});
assert.equal(created.changedFiles[0].created, true);

let jsonAttempts = 0;
const recoveredJson = await new SolarAgentRuntime().run({ userPrompt: "Modifie ChatView.tsx", conversationId: "c5", model: four, project, mode: "fast", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => {
    if (call.visible) return "Patch prêt.";
    jsonAttempts++;
    return jsonAttempts === 1 ? "not json" : JSON.stringify(patch);
  },
});
assert.equal(recoveredJson.changedFiles.length, 1);
assert(jsonAttempts >= 2, "un JSON invalide doit demander une régénération structurée");

let buildChecks = 0;
let buildActions = 0;
const buildRepaired = await new SolarAgentRuntime().run({ userPrompt: "Corrige value.ts et vérifie le build", conversationId: "c6", model: nine, project, mode: "balanced", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => {
    if (call.visible) return "Vérification effectuée.";
    if ("objective" in (call.schema?.properties ?? {})) return JSON.stringify({ objective: "Corriger", steps: [{ id: "1", action: "Corriger value.ts", files: ["src/value.ts"], expectedResult: "Build valide" }] });
    buildActions++;
    return buildActions === 1
      ? JSON.stringify({ actions: [{ type: "patchFile", path: "src/value.ts", oldText: "= 0", newText: "= 1" }] })
      : JSON.stringify({ actions: [{ type: "patchFile", path: "src/value.ts", oldText: "= 1", newText: "= 2" }] });
  },
  verify: async () => [{ type: "build", success: ++buildChecks > 1, file: "src/value.ts", output: buildChecks === 1 ? "TS2322: type mismatch" : "Build validé" }],
});
assert.equal(buildRepaired.changedFiles[0].after, "export const value = 2;\n");
assert.equal(buildRepaired.metrics.repairIterations, 1);

let deepStep = 0;
const multi = await new SolarAgentRuntime().run({ userPrompt: "Modifie ChatView.tsx et Other.tsx", conversationId: "c7", model: twelve, project, mode: "deep", allowChanges: true, signal: new AbortController().signal }, {
  generate: async call => {
    if (call.visible) return "Deux fichiers proposés.";
    if ("objective" in (call.schema?.properties ?? {})) return JSON.stringify({ objective: "Deux fichiers", steps: [{ id: "1", action: "Modifier ChatView", files: ["src/ChatView.tsx"], expectedResult: "Texte changé" }, { id: "2", action: "Modifier Other", files: ["src/Other.tsx"], expectedResult: "Valeur changée" }] });
    deepStep++;
    return deepStep === 1 ? JSON.stringify(patch) : JSON.stringify({ actions: [{ type: "patchFile", path: "src/Other.tsx", oldText: "Other = 1", newText: "Other = 2" }] });
  },
});
assert.equal(multi.changedFiles.length, 2);
assert.equal(multi.mode, "deep");

const cancellation = new SolarAgentRuntime();
const first = cancellation.run({ userPrompt: "Modifie ChatView.tsx", conversationId: "old", model: nine, project, mode: "fast", allowChanges: true, signal: new AbortController().signal }, {
  generate: (_, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true })),
});
const second = cancellation.run({ userPrompt: "Question simple", conversationId: "new", model: nine, project, mode: "fast", allowChanges: false, signal: new AbortController().signal }, {
  generate: async call => call.visible ? "OK" : '{"actions":[],"finalMessage":"OK"}',
});
await assert.rejects(first, /abort|cancel/i);
assert.equal((await second).finalAnswer, "OK");
console.log("agent-contracts: ok (context, profiles, JSON, safety, Fast/Balanced/Deep, repair, cancellation, proposals)");
