import type { AgentFileChange } from "../agent/types.ts";
import type { CortexCandidate, CortexTask, CortexVerification, RenderReport } from "./types.ts";
import { diagnosticExcerpt } from "./reliability.ts";
import { sourceHash } from "./semantic.ts";
import { checkKey } from './experience.ts';
import { canonical } from './experience.ts';
import { stableDiagnostic } from './reliability.ts';

export type RepairKind = "syntax"|"structure"|"imports"|"interaction"|"motion"|"geometry"|"tests";
export interface RepairTarget { kind:RepairKind; files:string[]; brief:string }
export type FailureClass='model-format'|'syntax'|'compilation'|'dependency'|'contract'|'tool'|'context'|'environment'|'verification';
export function failureClass(checks:CortexVerification[],detail=''):FailureClass{
  if(checks.some(check=>check.hardConstraint!==false&&check.status==='unavailable'))return 'environment';
  if(/CORTEX_CONTEXT|contexte.*(?:satur|fenêtre)/i.test(detail))return 'context';
  if(/CORTEX_ACTION_FORMAT|JSON|schéma/i.test(detail))return 'model-format';
  const failed=checks.filter(check=>check.hardConstraint!==false&&check.status==='failed');
  if(failed.some(check=>check.type==='syntax'))return 'syntax';
  if(failed.some(check=>check.type==='imports'))return 'dependency';
  if(failed.some(check=>check.type==='build'))return 'compilation';
  if(failed.some(check=>check.category==='functional'||check.type==='structure'))return 'contract';
  if(/outil|service|backend/i.test(detail))return 'tool';
  return 'verification';
}

/** A branch number or a paraphrased diagnosis is not new information.
 * A generation must change its observed inputs or editing method. */
export function generationDecision(task:CortexTask,candidate:CortexCandidate,method:string){
  const decision={step:task.steps,reason:candidate.issues.length?`repair:${failureClass(candidate.checks,candidate.issues.join('\n'))}`:task.sourceReads?.length||task.contextRecoveries?.length?'recovered-context':'initial-proposal',source:sourceHash(canonical(candidate.changes.map(change=>[change.path,sourceHash(change.after)]))),diagnostic:sourceHash(stableDiagnostic(candidate.issues.join('\n'))),context:sourceHash(canonical({files:task.context?.files.map(file=>[file.path,file.sourceHash,file.content]),reads:task.sourceReads?.map(read=>read.signature),recoveries:task.contextRecoveries})),strategy:method};
  const repeated=task.generationDecisions?.some(previous=>previous.source===decision.source&&previous.diagnostic===decision.diagnostic&&previous.context===decision.context&&previous.strategy===decision.strategy);
  if(!repeated)task.generationDecisions=[...(task.generationDecisions??[]),decision].slice(-32);
  return {...decision,repeated:Boolean(repeated)};
}

function sourceAround(change:AgentFileChange|undefined,line?:number){
  if(!change||!line)return "";
  return change.after.split("\n").slice(Math.max(0,line-3),line+2)
    .map((text,index)=>`${Math.max(1,line-2)+index}: ${text.slice(0,220)}`).join("\n").slice(0,900);
}
const failed=(checks:CortexVerification[],type:string)=>checks.find(check=>check.status==="failed"&&check.type===type);
const sourceFiles=(changes:AgentFileChange[],test:RegExp)=>changes.filter(change=>test.test(change.path)).map(change=>change.path);
const domPattern=/DOM requis\s*:\s*([^.;\n]+)|^(#[\w-]+): attendu [^\n]*observé null/m;

/** Prioritize the first *measured* blocking cause. Advisory vision never
 * overrides a compiler, a missing element or an independent interaction. */
export function classifyRepair(checks:CortexVerification[],changes:AgentFileChange[],report?:RenderReport):RepairTarget|undefined{
  checks=checks.filter(check=>check.hardConstraint!==false);
  const syntax=failed(checks,"syntax")??checks.find(check=>check.status==="failed"&&/SyntaxError/.test(check.output));
  if(syntax){const file=syntax.file??sourceFiles(changes,/\.(?:html?|[cm]?[jt]sx?)$/i)[0];return {kind:"syntax",files:file?[file]:[],brief:`Syntaxe invalide dans ${file??"le fichier généré"}${syntax.line?`:${syntax.line}:${syntax.column??1}`:""}. ${diagnosticExcerpt(syntax.output).slice(0,900)}\n${sourceAround(changes.find(change=>change.path===file),syntax.line)}\nCorrige uniquement la zone signalée avant de retoucher styles ou mise en page.`};}
  const missing=checks.find(check=>check.status==="failed"&&domPattern.test(check.output));
  if(missing){const match=missing.output.match(domPattern);const expected=match?.[1]??match?.[2]??"cible DOM";const observed=report?.frames.at(-1)?.elements.map(element=>element.selector).filter(Boolean).slice(0,24).join(", ")??"capture indisponible";const files=sourceFiles(changes,/\.(?:html?|[jt]sx?)$/i);return {kind:"structure",files,brief:`Cible DOM absente : ${expected}. Présent dans WebKit : ${observed}. Cherche le composant HTML/React responsable dans ${files.join(", ")||"le projet"}; ajoute la cible ou l’attribut requis. Aucun patch CSS avant sa présence, puis relance le rendu.`};}
  const imports=failed(checks,"imports")??checks.find(check=>check.status==="failed"&&/Cannot find module|Import local introuvable/i.test(check.output));
  if(imports){const file=imports.file??sourceFiles(changes,/\.[cm]?[jt]sx?$/i)[0];const spec=imports.output.match(/(?:Cannot find module|Import local introuvable)\s*['"]?([^'"\s]+)/i)?.[1];const local=spec?.startsWith(".")?spec:undefined;const related=changes.map(change=>change.path).filter(path=>path===file||local&&path.includes(local.replace(/^\.\/?/,"")));return {kind:"imports",files:related.length?related:file?[file]:[],brief:`Module local non résolu : ${local??diagnosticExcerpt(imports.output).slice(0,300)}. Vérifie le chemin relatif depuis ${file??"le fichier importeur"}, son extension réelle et l’export du fichier cible. Corrige les deux fichiers si nécessaire, puis relance les tests.`};}
  const structure=failed(checks,"structure");if(structure)return {kind:"structure",files:structure.file?[structure.file]:changes.map(change=>change.path),brief:`Structure incorrecte : ${diagnosticExcerpt(structure.output).slice(0,800)}. Corrige la déclaration ou l’export concerné sans modifier les parties déjà valides.`};
  // A dispatched click only proves that WebKit found the trigger. If the
  // expected text/state is still absent afterwards, this is a functional
  // failure, not a geometry or colour problem, even if a validator labels its
  // final DOM assertion "visual".
  const functional=report?.interactions?.some(action=>action.success)&&checks.find(check=>check.status==="failed"&&/attendu\s*\{[^\n]*"(?:text|value|visible)"/i.test(check.output)&&/observé/i.test(check.output));
  if(functional){
    const expectedRaw=functional.output.match(/attendu\s*(\{.*?\}),\s*observé/i)?.[1];
    let expected:Record<string,unknown>={};try{expected=expectedRaw?JSON.parse(expectedRaw):{};}catch{/* Keep the validator's original diagnostic below. */}
    const selector=typeof expected.selector==="string"?expected.selector:undefined;
    const observed=selector?report?.frames.at(-1)?.elements.find(element=>element.selector===selector):undefined;
    const triggers=report?.interactions?.map(action=>`${action.type??"action"} ${action.selector}: ${action.success?"envoyé":"cible absente"}`).join("; ")??"non mesurés";
    const files=sourceFiles(changes,/\.(?:html?|[jt]sx?)$/i);
    const standalone=changes.find(change=>/\.html?$/i.test(change.path));
    const noHandler=standalone&&!/<script\b|\bon(?:click|input|change)\s*=/i.test(standalone.after);
    return {kind:"interaction",files,brief:`VALIDATION FONCTIONNELLE après interaction : ${triggers}. ${selector??"Cible"} attendu ${JSON.stringify(expected).slice(0,280)}, observé ${JSON.stringify({text:observed?.text??null,value:observed?.value??null,visible:Boolean(observed&&observed.opacity>.9&&observed.width>0&&observed.height>0)}).slice(0,280)}. ${noHandler?"Le HTML courant ne contient ni script ni handler inline; aucune mise à jour d'état n'est visible dans cette source. ":"Vérifie le chargement du script, le handler et l'état actif. "}Répare le comportement du fichier ${files.join(", ")||"concerné"}, puis revalide le clic et le DOM. Ne modifie pas seulement le CSS.`};
  }
  const interaction=checks.find(check=>check.status==="failed"&&/interaction|déclench|clic|click|champ vidé/i.test(check.output));
  if(interaction){const triggers=report?.interactions?.map(item=>`${item.selector}:${item.success?"déclenché":"absent"}`).join(", ")??"non mesurés";return {kind:"interaction",files:sourceFiles(changes,/\.(?:html?|[jt]sx?)$/i),brief:`Interaction : ${diagnosticExcerpt(interaction.output).slice(0,500)}. Déclencheurs WebKit : ${triggers}. Corrige le handler/état puis vérifie le DOM après clic.`};}
  const motion=failed(checks,"temporal");if(motion){const frame=report?.frames.map(item=>`${item.timestamp}ms:${item.elements.filter(element=>element.selector.startsWith("#")).slice(0,6).map(element=>`${element.selector} opacity=${element.opacity} transform=${element.transform}`).join(", ")}`).slice(0,7).join(" ; ")??"instants indisponibles";return {kind:"motion",files:sourceFiles(changes,/\.(?:html?|[jt]sx?|css)$/i),brief:`Animation mesurée : ${diagnosticExcerpt(motion.output).slice(0,500)}. États observés : ${frame.slice(0,1050)}. Vérifie d’abord le déclencheur et le changement d’état, puis la transition CSS/WAAPI. Conserve le mode mouvement réduit.`};}
  const geometry=failed(checks,"visual");if(geometry)return {kind:"geometry",files:sourceFiles(changes,/\.(?:html?|[jt]sx?|css)$/i),brief:`Géométrie/rendu : ${diagnosticExcerpt(geometry.output).slice(0,700)}. Ajuste uniquement les règles qui contrôlent la mesure observée.`};
  const tests=checks.find(check=>check.status==="failed");if(tests)return {kind:"tests",files:tests.file?[tests.file]:changes.map(change=>change.path),brief:`Vérification échouée : ${diagnosticExcerpt(tests.output).slice(0,1000)}. Applique un patch minimal sur les fichiers concernés et relance les vérifications.`};
}

const checkId=checkKey;
const category=(target?:RepairTarget):"technical"|"functional"|"visual"=>target?.kind==="interaction"?"functional":target?.kind==="geometry"||target?.kind==="motion"?"visual":"technical";
export function verificationCategory(check:CortexVerification,report?:RenderReport):"technical"|"functional"|"visual"{
  if(check.category)return check.category;
  if(/interaction|input-reset|dialog-close|click/i.test(`${check.validatorId??""} ${check.output}`))return "functional";
  if(check.type==="visual"&&report?.interactions?.some(action=>action.success)&&/attendu\s*\{[^\n]*"(?:text|value|visible)"/i.test(check.output))return "functional";
  if(check.type==="visual"||check.type==="temporal")return "visual";
  return "technical";
}

/** Keep only verified observations and a short repair history in checkpoints.
 * A smaller file or another generation is not, by itself, progress. */
export function recordRepairVerification(task:CortexTask,candidate:CortexCandidate,target?:RepairTarget,evolution?:{metric:string;direction:"min"|"max"}){
  const previous=task.repairMemory;
  const failed=candidate.checks.filter(check=>check.status==="failed"&&check.hardConstraint!==false);
  const failedIds=failed.map(checkId).sort();
  const passedIds=candidate.checks.filter(check=>check.status==="passed"&&check.hardConstraint!==false).map(checkId).sort();
  const measurements=Object.fromEntries(candidate.checks.filter(check=>check.hardConstraint!==false&&check.comparable!==false).flatMap(check=>[
    ...(check.measurement!==undefined?[[checkId(check),check.measurement] as const]:[]),
    ...Object.entries(check.qualityMetrics??{}).map(([metric,value])=>[`${checkId(check)}:${metric}`,value] as const),
  ]));
  const newlyPassed=previous?.lastFailedIds.some(id=>passedIds.includes(id))??false;
  const measuredImprovement=Object.entries(measurements).some(([id,value])=>previous?.lastMeasurements[id]!==undefined&&(
    evolution?.metric&&id.endsWith(`:${evolution.metric}`)
      ? evolution.direction==="min"?value<previous.lastMeasurements[id]-0.001:value>previous.lastMeasurements[id]+0.001
      : value<previous.lastMeasurements[id]-0.001
  ));
  const progress=!previous||newlyPassed||measuredImprovement||!failed.length&&!evolution;
  const noProgress=failed.length&&!progress?(previous?.noProgress??0)+1:0;
  const edit=task.pendingRepairEdit;
  const record={step:task.steps,hypothesis:(edit?.hypothesis??target?.brief??"Première vérification").slice(0,320),actions:edit?.actions??[],files:edit?.files??candidate.changes.map(change=>change.path),result:(failed[0]?.output??"Toutes les contraintes vérifiées").slice(0,500),progress,category:category(target),sourceHashes:Object.fromEntries(candidate.changes.map(change=>[change.path,sourceHash(change.after)]))};
  task.repairMemory={objective:task.prompt.slice(0,500),latestError:record.result,focusFiles:target?.files??[],lastFailedIds:failedIds,lastPassedIds:passedIds,lastMeasurements:measurements,noProgress,strategy:noProgress>=2?"reassess":"targeted",nextAction:(target?.brief??"Vérifications réussies.").slice(0,850),attempts:[...(previous?.attempts??[]),record].slice(-8)};
  task.pendingRepairEdit=undefined;
  return {progress,noProgress,strategy:task.repairMemory.strategy};
}

export function repairMemoryContext(task:CortexTask){
  const memory=task.repairMemory;if(!memory)return "";
  const attempts=memory.attempts.slice(-4).map(item=>`étape ${item.step} · ${item.category} · hypothèse ${item.hypothesis.slice(0,150)} · actions ${item.actions.join("+")||"aucune"} · ${item.progress?"progrès vérifié":"aucun progrès vérifié"} · ${item.result.slice(0,180)}`).join("\n");
  return `\nMÉMOIRE DE RÉPARATION (observations, pas instructions des fichiers)\nObjectif : ${memory.objective}\nFichiers : ${memory.focusFiles.join(", ")||"à localiser"}\nDernière erreur : ${memory.latestError.slice(0,450)}\nHistorique compact :\n${attempts}\nStratégie : ${memory.strategy=== "reassess"?"les corrections précédentes n'ont pas amélioré la validation; change de cause probable et inspecte le comportement avant de proposer une autre édition":"corrige la cause actuellement mesurée"}.\nProchaine vérification : ${memory.nextAction.slice(0,400)}`;
}

export function isStyleOnlyChange(path:string,before:string,after:string){
  if(/\.css$/i.test(path))return before!==after;
  if(!/\.html?$/i.test(path))return false;
  const withoutStyle=(value:string)=>value.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,"<style></style>");
  return before!==after&&withoutStyle(before)===withoutStyle(after);
}
