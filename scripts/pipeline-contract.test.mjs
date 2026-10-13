import assert from "node:assert/strict";
import { runPipeline } from "../src/lib/pipeline/index.ts";

const plan = JSON.stringify({ steps: [{ title: "Analyser", goal: "Repérer les besoins" }, { title: "Répondre", goal: "Construire une réponse" }] });
for (const effort of ["low", "medium", "high", "ultra"]) {
  const calls = [];
  const stages = [];
  const result = await runPipeline(effort, {
    onStage: stage => stages.push(stage),
    run: async input => {
      calls.push(input);
      if (input.stage === "Planification") return plan;
      if (input.stage === "Fusion des brouillons") return JSON.stringify({ chosen: 1, synthesis: "Meilleure synthèse", issues: [] });
      return input.final ? "Réponse visible" : "Résultat interne";
    },
  }, new AbortController().signal);
  assert.equal(result, "Réponse visible", `${effort}: final response returned`);
  assert.equal(calls.filter(call => call.final).length, 1, `${effort}: one streamed final pass`);
  assert.ok(calls.every(call => !call.final || call.stage === "Réponse finale"));
  if (effort !== "low") assert.ok(calls.some(call => call.format), `${effort}: structured intermediate output`);
  if (effort === "ultra") assert.equal(calls.filter(call => /^Brouillon [123]\/3$/.test(call.stage)).length, 3);
}
const controller = new AbortController(); controller.abort();
await assert.rejects(runPipeline("high", { onStage() {}, async run() { throw new DOMException("aborted", "AbortError"); } }, controller.signal));
const fallbackCalls=[];
const fallbackResult=await runPipeline("medium",{onStage(){},async run(input){fallbackCalls.push(input);if(input.stage==="Planification")return "sortie structurée invalide";return "Réponse directe récupérée";}},new AbortController().signal);
assert.equal(fallbackResult,"Réponse directe récupérée","a failed medium plan should fall back to one direct final response");
assert.equal(fallbackCalls.filter(input=>input.final).length,1,"the fallback remains the only visible answer pass");
console.log("pipeline-contract-tests: ok");
