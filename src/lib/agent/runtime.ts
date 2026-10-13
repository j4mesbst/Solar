import { analyzeComplexity, analyzeIntent, resolveMode } from "./intent.ts";
import { buildRepositoryIndex, selectProjectContext } from "./context.ts";
import { contextBudget } from "./models.ts";
import { agentActionSchema, parseAgentResponse, stageAction, validateAction } from "./actions.ts";
import { repairFeedback, summarizeVerification, verifyStagedChanges } from "./verification.ts";
import { actionPrompt, agentSystemPrompt, finalPrompt } from "./prompt.ts";
import type { AgentDependencies, AgentFileChange, AgentPlan, AgentRequest, AgentResult, AgentState, SelectedProjectContext, VerificationResult } from "./types.ts";

const planSchema = { type: "object", properties: { objective: { type: "string" }, steps: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", properties: { id: { type: "string" }, action: { type: "string" }, files: { type: "array", items: { type: "string" } }, expectedResult: { type: "string" } }, required: ["id", "action", "files", "expectedResult"], additionalProperties: false } } }, required: ["objective", "steps"], additionalProperties: false };

function parsePlan(raw: string): AgentPlan {
  const data: unknown = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Plan invalide.");
  const value = data as Record<string, unknown>;
  if (typeof value.objective !== "string" || !Array.isArray(value.steps) || !value.steps.length || value.steps.length > 4) throw new Error("Étapes du plan invalides.");
  return { objective: value.objective.slice(0, 300), steps: value.steps.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("Étape de plan invalide.");
    const step = item as Record<string, unknown>;
    if (typeof step.action !== "string" || typeof step.expectedResult !== "string" || !Array.isArray(step.files) || !step.files.every(path => typeof path === "string")) throw new Error("Étape de plan incomplète.");
    return { id: typeof step.id === "string" ? step.id.slice(0, 30) : String(index + 1), action: step.action.slice(0, 300), expectedResult: step.expectedResult.slice(0, 250), files: step.files.slice(0, 8).map(path => String(path).slice(0, 240)) };
  }) };
}

export class SolarAgentRuntime {
  private active?: { id: string; controller: AbortController };
  cancel() { this.active?.controller.abort(); this.active = undefined; }

  async run(request: AgentRequest, dependencies: AgentDependencies): Promise<AgentResult> {
    this.cancel();
    const generationId = crypto.randomUUID();
    const controller = new AbortController();
    this.active = { id: generationId, controller };
    const cancel = () => controller.abort();
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) controller.abort();
    const signal = controller.signal;
    const started = performance.now();
    let state: AgentState = "idle", mode = request.mode ?? request.model.preferredMode, repairIterations = 0, firstToken: number | undefined;
    let context: SelectedProjectContext | undefined;
    const staged = new Map<string, AgentFileChange>();
    const report = (next: AgentState, detail?: string) => { signal.throwIfAborted(); if (this.active?.id !== generationId) throw new DOMException("Ancienne génération annulée", "AbortError"); state = next; dependencies.onState?.(next, detail); dependencies.onLog?.({ generationId, state, mode, selectedFiles: context?.files.length ?? 0, repair: repairIterations }); };
    const generate = async (call: Parameters<AgentDependencies["generate"]>[0]) => { signal.throwIfAborted(); const value = await dependencies.generate(call, signal); signal.throwIfAborted(); return value; };
    try {
      report("analyzing");
      const intent = analyzeIntent(request.userPrompt);
      const index = buildRepositoryIndex(request.project);
      report("selectingContext");
      context = await selectProjectContext(intent, request.project, index, contextBudget(request.model), signal, request.model.maxFiles);
      const complexity = analyzeComplexity(intent, context.files.length, request.model);
      mode = resolveMode(complexity, request.model, request.mode);
      let plan: AgentPlan | undefined;
      const system = agentSystemPrompt(request.model, request.additionalGuidance);
      if (mode !== "fast" && intent.taskType !== "question") {
        report("planning");
        try {
          plan = parsePlan(await generate({ system, prompt: `Crée un plan de 1 à ${mode === "deep" ? 4 : 3} étapes courtes pour : ${intent.objective}. Utilise seulement les chemins réellement listés : ${context.relatedPaths.join(", ")}. Pas de commandes shell. Réponds en JSON.`, schema: planSchema, maxOutputTokens: 750 }));
        } catch (error) {
          signal.throwIfAborted();
          plan = { objective: intent.objective, steps: [{ id: "1", action: intent.objective, files: context.files.map(file => file.path), expectedResult: "Changement vérifié" }] };
          if (error instanceof DOMException && error.name === "AbortError") throw error;
        }
      }
      const steps = mode === "deep" ? plan?.steps.slice(0, 4) ?? [{ id: "1", action: intent.objective, files: [], expectedResult: "Changement vérifié" }] : [{ id: "1", action: plan?.steps.map(step => step.action).join(" ; ") || intent.objective, files: context.files.map(file => file.path), expectedResult: "Changement vérifié" }];
      let modelMessage = "", verification: VerificationResult[] = [];
      const maxRepair = mode === "fast" ? 1 : mode === "balanced" ? 2 : 3;
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        let feedback = "", readRounds = 0, stepDone = false;
        for (let attempt = 0; attempt <= maxRepair + 2; attempt++) {
          report(attempt ? "repairing" : "generating", `Étape ${stepIndex + 1}/${steps.length}`);
          const raw = await generate({ system, prompt: actionPrompt(intent, context, plan, step.action, feedback), schema: agentActionSchema, maxOutputTokens: request.model.parameterClass === "small" ? 1800 : 3600 });
          let parsed;
          try { parsed = parseAgentResponse(raw); }
          catch (error) {
            if (attempt >= maxRepair + 1) throw error;
            report("repairing", "JSON invalide"); repairIterations++;
            const repaired = await generate({ system, prompt: `Convertis cette réponse en JSON strict conforme au schéma d’actions, sans ajouter d’action. Erreur : ${error instanceof Error ? error.message : "JSON invalide"}. Réponse : ${raw.slice(0, 8000)}`, schema: agentActionSchema, maxOutputTokens: 3000 });
            parsed = parseAgentResponse(repaired);
          }
          const failures = parsed.actions.map(action => validateAction(action, request.project, staged, request.allowChanges)).filter((item): item is string => Boolean(item));
          if (failures.length) { if (attempt >= maxRepair + 1) throw new Error(failures[0]); repairIterations++; feedback = `Action refusée : ${failures.slice(0, 3).join(" ; ")}. Propose un patch sûr et ciblé.`; continue; }
          const checkpoint = new Map(staged);
          const toolResults: string[] = [];
          try {
            report("applyingChanges", "Préparation des modifications");
            for (const action of parsed.actions) toolResults.push(await stageAction(action, request.project, staged, signal));
          } catch (error) {
            staged.clear(); for (const [path, change] of checkpoint) staged.set(path, change);
            if (attempt >= maxRepair + 1) throw error;
            repairIterations++; feedback = `Action non applicable : ${error instanceof Error ? error.message : String(error)}. Relis le fichier puis propose un petit patch.`; continue;
          }
          modelMessage = parsed.finalMessage || parsed.actions.find(action => action.type === "finish")?.message || modelMessage;
          if (parsed.actions.some(action => action.type === "readFile" || action.type === "searchCode") && !parsed.actions.some(action => action.type === "patchFile" || action.type === "createFile" || action.type === "replaceFile")) {
            if (++readRounds > 2) throw new Error("Le modèle demande trop de lectures sans proposer de résultat.");
            feedback = toolResults.join("\n\n").slice(0, 8000); continue;
          }
          if (mode === "deep" || stepIndex === steps.length - 1) {
            report("verifying", `Étape ${stepIndex + 1}/${steps.length}`);
            verification = await verifyStagedChanges([...staged.values()], context, request.project.files, signal);
            if (dependencies.verify) verification.push(...await dependencies.verify([...staged.values()], context, signal));
            const error = summarizeVerification(verification);
            if (error) {
              if (attempt >= maxRepair) throw new Error(`Vérification échouée après ${repairIterations} correction(s) : ${error.primaryError}`);
              repairIterations++; feedback = repairFeedback(error, context, [...staged.values()]); continue;
            }
          }
          stepDone = true; break;
        }
        if (!stepDone) throw new Error(`L’étape ${stepIndex + 1} n’a pas produit de résultat vérifié.`);
      }
      if (!verification.length) { report("verifying"); verification = await verifyStagedChanges([...staged.values()], context, request.project.files, signal); }
      if (staged.size && dependencies.onProposal) await dependencies.onProposal([...staged.values()], signal);
      const verificationFacts = verification.filter(item => item.success).slice(0, 8).map(item => `${item.type} ${item.file ?? "projet"}: ${item.output}`);
      report("generating", "Réponse finale");
      let finalAnswer = "";
      const output = await generate({ system: "Réponds en français avec exactitude. Les fichiers préparés restent des propositions à approuver. Ne prétends pas avoir exécuté de build, test ou écriture non indiqués.", prompt: finalPrompt(intent, [...staged.keys()], verificationFacts, modelMessage), visible: true, maxOutputTokens: 800, onDelta: part => { if (firstToken === undefined) firstToken = performance.now() - started; finalAnswer += part; signal.throwIfAborted(); } });
      if (!finalAnswer) finalAnswer = output || modelMessage || "La proposition est prête dans le panneau Solar Code.";
      report("completed");
      return { finalAnswer, changedFiles: [...staged.values()], verificationResults: verification, iterations: repairIterations + 1, plan, mode, generationId, metrics: { timeToFirstTokenMs: firstToken, totalGenerationMs: performance.now() - started, contextTokenCount: context.estimatedTokens, repairIterations, contextFiles: context.files.length } };
    } catch (error) { if (!signal.aborted) { try { report("failed"); } catch { /* A newer generation already owns the state. */ } } throw error; }
    finally { request.signal.removeEventListener("abort", cancel); if (this.active?.id === generationId) this.active = undefined; }
  }
}
