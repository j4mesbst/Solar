import type { AgentFileChange } from "../agent/types.ts";
import type { CortexCandidate, CortexTask, CortexVerification, RenderReport } from "./types.ts";
import { diagnosticExcerpt } from "./reliability.ts";
import { sourceHash, withoutJsxPresentation } from "./semantic.ts";
import { checkKey } from './experience.ts';
import { canonical } from './experience.ts';
import { stableDiagnostic } from './reliability.ts';
import { nearbyLocalImports } from '../agent/module-resolution.ts';
import { missingDomTargets, domRepairFiles, type MissingDomTarget } from './dom-repair.ts';

export type RepairKind = "syntax"|"structure"|"imports"|"contract"|"interaction"|"motion"|"geometry"|"tests";
export interface RepairTarget { kind:RepairKind; files:string[]; brief:string; missingDom?:MissingDomTarget[] }
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

/** Prioritize the first *measured* blocking cause. Advisory vision never
 * overrides a compiler, a missing element or an independent interaction. */
export function classifyRepair(checks:CortexVerification[],changes:AgentFileChange[],report?:RenderReport,projectFiles:string[]=[]):RepairTarget|undefined{
  checks=checks.filter(check=>check.hardConstraint!==false);
  const syntax=failed(checks,"syntax")??checks.find(check=>check.status==="failed"&&/SyntaxError/.test(check.output));
  if(syntax){const file=syntax.file??sourceFiles(changes,/\.(?:html?|[cm]?[jt]sx?)$/i)[0];return {kind:"syntax",files:file?[file]:[],brief:`Syntaxe invalide dans ${file??"le fichier généré"}${syntax.line?`:${syntax.line}:${syntax.column??1}`:""}. ${diagnosticExcerpt(syntax.output).slice(0,900)}\n${sourceAround(changes.find(change=>change.path===file),syntax.line)}\nCorrige uniquement la zone signalée avant de retoucher styles ou mise en page.`};}
  const missingDom=missingDomTargets(checks);
  if(missingDom.length){const files=domRepairFiles(missingDom,changes,projectFiles);const present=[...new Set(report?.frames.at(-1)?.elements.map(element=>element.selector).filter(Boolean)??[])].slice(0,5);return {kind:'structure',files,missingDom,brief:`PRIORITÉ DOM : ${missingDom.map(target=>`${target.selector}${target.expected?` attendu ${JSON.stringify(target.expected)}`:''}${target.file?` dans ${target.file}`:''}`).join('; ')} absent du rendu. ${present.length?`Déjà observés dans le rendu : ${present.join(', ')}; préserve-les. `:''}Les virgules désignent des alternatives CSS, pas plusieurs obligations. Attributs : ceux du sélecteur et de l’attente uniquement. Corrige HTML/React dans ${files.join(', ')||'le composant responsable'} par une édition ciblée atomique, avec le hash courant. Aucun ajustement CSS seul. Cortex doit confirmer la cible dans le DOM rendu avec les mêmes contrôles indépendants.`};}
  const imports=failed(checks,"imports")??checks.find(check=>check.status==="failed"&&/Cannot find module|Import local introuvable/i.test(check.output));
  if(imports){
    if(/Contrat de module|Import circulaire/i.test(imports.output)){
      const files=sourceFiles(changes,/\.[cm]?[jt]sx?$/i);
      return {kind:'imports',files,brief:`CONTRAT D'IMPORT : ${diagnosticExcerpt(imports.output).slice(0,700)}. Vérifie les exports effectivement disponibles et la déclaration réelle dans ${files.join(', ')}. Corrige les sources concernées dans un même lot; ne relance pas le même contrôle sans édition.`};
    }
    const file=imports.file??imports.output.match(/Importeur\s*:\s*([^;\s]+)/i)?.[1]??sourceFiles(changes,/\.[cm]?[jt]sx?$/i)[0];
    const spec=imports.output.match(/Import local introuvable\s*:\s*['"]?(\.{1,2}\/[^'";\s]+?)(?:['"]|\.\s+Importeur|\s|;|$)/i)?.[1]??imports.output.match(/Cannot find module\s*['"]([^'"]+)['"]/i)?.[1];
    const local=spec?.startsWith('.')?spec:undefined;
    const mode=imports.output.match(/\bmode\s+(cjs|esm|bundler)\b/i)?.[1] as 'cjs'|'esm'|'bundler'|undefined;
    const nearby=file&&local?nearbyLocalImports(file,local,[...projectFiles,...changes.map(change=>change.path)],mode??(/\.cjs$/i.test(file)?'cjs':'bundler')):[];
    const files=[...new Set([file,...nearby.map(item=>item.path)].filter((path):path is string=>Boolean(path)))];
    const exact=nearby.length===1?` Fichier présent : ${nearby[0].path}, mais ${local} ne le résout pas dans ce mode; l'import doit utiliser ${nearby[0].specifier}.`:nearby.length>1?` Fichiers proches : ${nearby.map(item=>`${item.path} via ${item.specifier}`).join(', ')}; choisis la cible réellement exportée.`:'';
    return {kind:'imports',files,brief:`Import non résolu ${local??diagnosticExcerpt(imports.output).slice(0,300)} dans ${file??'un importeur inconnu'}.${exact} Inspecte l'importeur et le module cible, vérifie leurs exports, puis édite les deux dans le même lot si nécessaire. Ne relance pas des tests sur des sources inchangées.`};
  }
  const contract=checks.find(check=>check.status==='failed'&&/TypeError:.*is not a function|AssertionError|Expected values to be strictly equal/i.test(check.output)&&sourceFiles(changes,/\.[cm]?[jt]sx?$/i).length);
  if(contract){
    const files=sourceFiles(changes,/\.[cm]?[jt]sx?$/i);
    const symbol=contract.output.match(/TypeError:\s*([\w$]+) is not a function/)?.[1]??contract.output.match(/\.([\w$]+) is not a function/)?.[1];
    const actual=contract.output.match(/\+ actual[^\n]*\n[\s\S]*?\n\+\s*(.+)/)?.[1];
    const expected=contract.output.match(/- expected[^\n]*\n[\s\S]*?\n-\s*(.+)/)?.[1];
    const invocation=contract.output.split('\n').find(line=>/\b(?:assert|a)\.(?:equal|strictEqual|deepEqual)\(/.test(line)&&line.length<500);
    return {kind:'contract',files,brief:`CONTRAT D'EXÉCUTION : ${diagnosticExcerpt(contract.output).slice(0,850)}. ${invocation?`Appel indépendant échoué : ${invocation.trim().slice(0,350)}. `:''}${symbol?`Symbole appelé : ${symbol}. Vérifie qu'il est réellement exporté par le module requis, et qu'aucun import circulaire ne le laisse indéfini. `:''}${actual&&expected?`Valeur réelle ${actual.slice(0,100)}, attendue ${expected.slice(0,100)}. Préserve la signature et le comportement demandés. `:''}Inspecte les sources courantes de ${files.join(', ')} et corrige le code ou l'export, pas le test. Une nouvelle vérification identique sans édition ne constitue pas un progrès.`};
  }
  const structure=failed(checks,"structure");if(structure){const files=/Export invalide/i.test(structure.output)?sourceFiles(changes,/\.[cm]?[jt]sx?$/i):structure.file?[structure.file]:changes.map(change=>change.path);return {kind:"structure",files,brief:`Structure incorrecte : ${diagnosticExcerpt(structure.output).slice(0,800)}. ${/Export invalide/i.test(structure.output)?`Inspecte la déclaration et l'import du symbole entre ${files.join(', ')}; l'export doit référencer un nom réellement défini. `:''}Corrige la déclaration ou l’export concerné sans modifier les parties déjà valides.`};}
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
  const motion=failed(checks,"temporal");if(motion){const frame=report?.frames.map(item=>`${item.timestamp}ms:${item.elements.filter(element=>element.selector.startsWith("#")).slice(0,6).map(element=>`${element.selector} opacity=${element.opacity} transform=${element.transform}`).join(", ")}`).slice(0,7).join(" ; ")??"instants indisponibles";const html=changes.find(change=>/\.html?$/i.test(change.path))?.after??'';const files=sourceFiles(changes,/\.(?:html?|[jt]sx?|css)$/i);if(/reduced.motion|mouvement réduit/i.test(`${motion.validatorId??''} ${motion.output}`))return {kind:"motion",files,brief:`Mouvement réduit échoué : ${diagnosticExcerpt(motion.output).slice(0,500)}. Préserve l'animation normale déjà validée; dans prefers-reduced-motion, supprime le mouvement CSS/WAAPI et applique directement l'état final visible. Vérifie les deux modes séparément, sans relancer une vérification sur une source inchangée.`};const hidden=/(?:opacity\s*:\s*0\b|visibility\s*:\s*hidden\b)/i.test(html);const noTrigger=hidden&&!/<script\b|\bon(?:load|click)\s*=|classList\.|\banimate\s*\(/i.test(html);const declared=[...html.matchAll(/@keyframes\s+([\w-]+)/gi)].map(match=>match[1]);const dynamic=[...html.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*['"]([\w-]+)['"]\s*\+/g)].find(match=>new RegExp(`animation:[^\\n]{0,80}\\+\\s*${match[1]}\\b`).test(html));const missingFrames=dynamic&&declared.length&&!declared.some(name=>name.startsWith(dynamic[2]));return {kind:"motion",files,brief:`Animation mesurée : ${diagnosticExcerpt(motion.output).slice(0,500)}. États observés : ${frame.slice(0,1050)}. ${noTrigger?'La source commence avec un élément masqué mais ne contient aucun script ou handler qui déclenche son état visible; le CSS seul ne lance pas la transition. ':''}${missingFrames?`Le script construit un nom d'animation commençant par ${dynamic[2]}, mais seules les keyframes ${declared.join(', ')} sont déclarées. Un nom sans @keyframes ne produit aucun mouvement; utilise un nom réellement déclaré ou crée les keyframes correspondantes. `:''}Vérifie d’abord le déclencheur et le changement d’état, puis la transition CSS/WAAPI. Conserve le mode mouvement réduit.`};}
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
  const domDefects=missingDomTargets(candidate.checks).map(target=>canonical(target)).sort();
  const domImproved=previous?.lastDomDefects!==undefined&&previous.lastDomDefects.some(defect=>!domDefects.includes(defect))&&!domDefects.some(defect=>!previous.lastDomDefects!.includes(defect));
  // A nicer pixel score cannot compensate for an unchanged missing DOM node.
  const progress=!previous||(previous.lastDomDefects?.length?Boolean(domImproved):newlyPassed||measuredImprovement)||!failed.length&&!evolution;
  const noProgress=failed.length&&!progress?(previous?.noProgress??0)+1:0;
  const edit=task.pendingRepairEdit;
  const record={step:task.steps,hypothesis:(edit?.hypothesis??target?.brief??"Première vérification").slice(0,320),actions:edit?.actions??[],files:edit?.files??candidate.changes.map(change=>change.path),result:(failed[0]?.output??"Toutes les contraintes vérifiées").slice(0,500),progress,category:category(target),sourceHashes:Object.fromEntries(candidate.changes.map(change=>[change.path,sourceHash(change.after)]))};
  task.repairMemory={objective:task.prompt.slice(0,500),latestError:record.result,focusFiles:target?.files??[],lastFailedIds:failedIds,lastPassedIds:passedIds,lastMeasurements:measurements,lastDomDefects:domDefects,noProgress,strategy:noProgress>=(domDefects.length?1:2)?"reassess":"targeted",nextAction:(target?.brief??"Vérifications réussies.").slice(0,850),attempts:[...(previous?.attempts??[]),record].slice(-8)};
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
  if(/\.[cm]?[jt]sx?$/i.test(path))return before!==after&&withoutJsxPresentation(before)===withoutJsxPresentation(after);
  if(!/\.html?$/i.test(path))return false;
  const withoutStyle=(value:string)=>value.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,"<style></style>").replace(/\s+(?:style|class)\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
  return before!==after&&withoutStyle(before)===withoutStyle(after);
}
