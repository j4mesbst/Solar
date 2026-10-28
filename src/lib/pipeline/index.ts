import type { Effort } from "../../domain/types";

export type PipelineStage = "Planification" | `Étape ${number}/${number}` | "Relecture critique" | "Brouillon 1/3" | "Brouillon 2/3" | "Brouillon 3/3" | "Fusion des brouillons" | "Réponse finale";
export interface PipelineStep { title: string; goal: string; }
export interface PipelinePlan { steps: PipelineStep[]; }
export interface PipelineRunner {
  run(input: { stage: PipelineStage; instruction: string; signal: AbortSignal; format?: unknown; final?: boolean }): Promise<string>;
  onStage(stage: PipelineStage): void;
}

export const planSchema = {
  type: "object",
  properties: { steps: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", properties: { title: { type: "string" }, goal: { type: "string" } }, required: ["title", "goal"], additionalProperties: false } } },
  required: ["steps"], additionalProperties: false,
};
const mergeSchema = {
  type: "object", properties: { chosen: { type: "integer", minimum: 1, maximum: 3 }, synthesis: { type: "string" }, issues: { type: "array", items: { type: "string" } } },
  required: ["chosen", "synthesis", "issues"], additionalProperties: false,
};
const resultSchema = { type: "object", properties: { outcome: { type: "string" }, key_facts: { type: "array", items: { type: "string" } }, uncertainties: { type: "array", items: { type: "string" } } }, required: ["outcome", "key_facts", "uncertainties"], additionalProperties: false };
const reviewSchema = { type: "object", properties: { findings: { type: "array", items: { type: "string" } }, corrections: { type: "array", items: { type: "string" } } }, required: ["findings", "corrections"], additionalProperties: false };
const draftSchema = { type: "object", properties: { response: { type: "string" }, approach: { type: "string" } }, required: ["response", "approach"], additionalProperties: false };
function parsePlan(text: string): PipelinePlan {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Le plan structuré produit par le modèle est invalide.");
  const value = JSON.parse(json) as PipelinePlan;
  if (!Array.isArray(value.steps) || !value.steps.length) throw new Error("Le plan ne contient aucune étape.");
  return { steps: value.steps.slice(0, 4).map(step => ({ title: String(step.title).slice(0, 120), goal: String(step.goal).slice(0, 600) })) };
}
function checkAbort(signal: AbortSignal) { if (signal.aborted) throw new DOMException("Pipeline interrompu", "AbortError"); }
const planPrompt = (question: string) => `Décompose la demande en étapes de travail concises, nécessaires et ordonnées. Ne réponds pas à la demande. Réponds uniquement avec le JSON conforme au schéma. Demande :\n${question}`;

export async function runPipeline(effort: Effort, runner: PipelineRunner, signal: AbortSignal): Promise<string> {
  if (effort === "low") return runner.run({ stage: "Réponse finale", instruction: "Réponds directement à la demande.", signal, final: true });
  if (effort === "medium") {
    let plan: PipelinePlan;
    try {
      const planText = await runner.run({ stage: "Planification", instruction: planPrompt("La demande complète est dans le contexte de conversation."), signal, format: planSchema });
      plan = parsePlan(planText);
    } catch {
      checkAbort(signal);
      runner.onStage("Réponse finale");
      return runner.run({ stage: "Réponse finale", instruction: "La planification structurée n’a pas abouti. Réponds directement à la demande, sans étape intermédiaire ni format JSON.", signal, final: true });
    }
    return runner.run({ stage: "Réponse finale", instruction: `Suis ce plan et réponds à la demande de l'utilisateur.\n${JSON.stringify(plan)}`, signal, final: true });
  }
  runner.onStage("Planification");
  const planText = await runner.run({ stage: "Planification", instruction: planPrompt("La demande complète est dans le contexte de conversation."), signal, format: planSchema });
  const plan = parsePlan(planText);

  if (effort === "ultra") {
    const drafts: string[] = [];
    for (let i = 0; i < 3; i++) {
      checkAbort(signal);
      const stage = `Brouillon ${i + 1}/3` as PipelineStage; runner.onStage(stage);
      drafts.push(await runner.run({ stage, instruction: `Produis un brouillon indépendant et complet pour répondre à la demande. Approche ${i + 1}. Réponds selon le schéma structuré.\nPlan de repère : ${JSON.stringify(plan)}`, signal, format: draftSchema }));
    }
    runner.onStage("Fusion des brouillons");
    const selected = await runner.run({ stage: "Fusion des brouillons", instruction: `Compare les trois brouillons, choisis le meilleur et fusionne leurs éléments utiles. Renvoie uniquement le JSON du schéma.\n${drafts.map((draft, i) => `Brouillon ${i + 1}:\n${draft}`).join("\n\n")}`, signal, format: mergeSchema });
    runner.onStage("Relecture critique");
    const draft = await runner.run({ stage: "Relecture critique", instruction: `Rédige un brouillon final à partir de la synthèse sélectionnée, puis formule une critique brève des éventuelles lacunes.\n${selected}`, signal });
    const critique = await runner.run({ stage: "Relecture critique", instruction: `Critique ce brouillon pour en détecter erreurs, omissions et imprécisions. Réponds selon le schéma structuré :\n${draft}`, signal, format: reviewSchema });
    return runner.run({ stage: "Réponse finale", instruction: `Fournis uniquement la réponse finale corrigée en tenant compte de cette critique.\nBrouillon : ${draft}\nCritique : ${critique}`, signal, final: true });
  }

  const results: string[] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    checkAbort(signal);
    const stage = `Étape ${i + 1}/${plan.steps.length}` as PipelineStage; runner.onStage(stage);
    results.push(await runner.run({ stage, instruction: `Effectue uniquement cette étape. N'écris pas encore la réponse finale. Réponds selon le schéma structuré.\nÉtape : ${JSON.stringify(plan.steps[i])}\nRésultats antérieurs utiles : ${results.join("\n").slice(-5000)}`, signal, format: resultSchema }));
  }
  runner.onStage("Relecture critique");
  const critique = await runner.run({ stage: "Relecture critique", instruction: `Relis ces résultats, repère contradictions, omissions ou erreurs et indique les corrections nécessaires selon le schéma structuré.\n${results.join("\n\n")}`, signal, format: reviewSchema });
  return runner.run({ stage: "Réponse finale", instruction: `Rédige la réponse finale en appliquant cette relecture aux résultats utiles.\nRésultats : ${results.join("\n\n")}\nRelecture : ${critique}`, signal, final: true });
}
