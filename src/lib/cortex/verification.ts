import { verifyStagedChanges } from "../agent/verification.ts";
import type { AgentFileChange, AgentProject, SelectedProjectContext, SolarIntent } from "../agent/types.ts";
import type { CortexCriterion, CortexVerification, RenderReport } from "./types.ts";
import { diagnosticExcerpt } from "./reliability.ts";

export async function verifyCode(changes: AgentFileChange[], context: SelectedProjectContext, project: AgentProject, intent: SolarIntent, criteria: CortexCriterion[], signal: AbortSignal) {
  const staticChecks = await verifyStagedChanges(changes, context, project.files, signal);
  const checks: CortexVerification[] = staticChecks.map(c => ({ ...c, status: c.success ? "passed" : "failed" }));
  for (const change of changes.filter(change=>/\.html?$/i.test(change.path))) {
    for (const tag of ["style","script"]) {
      const opening=(change.after.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`,"gi"))??[]).length;
      const closing=(change.after.match(new RegExp(`</${tag}\\s*>`,"gi"))??[]).length;
      if(opening!==closing) checks.push({type:"structure",file:change.path,validatorId:`html:${change.path}:${tag}`,status:"failed",success:false,output:`STRUCTURE HTML : balises ${tag} déséquilibrées (${opening} ouverture, ${closing} fermeture). Restaurer les balises avant de corriger CSS/JS.`});
    }
  }
  if (intent.taskType !== "question") checks.push({ type: "intent", success: changes.length > 0, status: changes.length ? "passed" : "failed", output: changes.length ? "Des modifications concrètes sont proposées. Les exigences sémantiques restent à examiner." : "La tâche demande une modification mais aucun fichier n’a changé." });
  for (const criterion of criteria.filter(c => c.kind !== "check")) {
    const change = changes.find(c => c.path === criterion.target);
    const exists = Boolean(change || project.files.includes(criterion.target));
    const text = change?.after ?? (exists && criterion.kind === "contains" ? await project.readFile(criterion.target, signal) : "");
    const passed = criterion.kind === "file" ? exists : Boolean(criterion.value && text.includes(criterion.value));
    checks.push({ type: "intent", file: criterion.target, success: passed, status: passed ? "passed" : "failed", output: `${criterion.id}: ${passed ? "contrainte vérifiée" : "contrainte non satisfaite"}` });
  }
  return checks;
}

/** Keep raw logs in verification records, but feed a small model the root
 * location and message first. This avoids drowning repair turns in tool noise. */
export function surgicalErrorFeedback(checks: CortexVerification[]) {
  return checks.filter(check => check.status === "failed").map(check => {
    const lines = check.output.split("\n");
    const hit = /AssertionError/.test(check.output) ? diagnosticExcerpt(check.output) : lines.find(line => /(?:ReferenceError|TypeError|SyntaxError|Export invalide|error\[|TS\d+|error:)/i.test(line)) ?? lines.find(line => /(?:^|\s)(?:[^\s:]+\.(?:ts|tsx|js|jsx|cjs|mjs|rs|swift):\d+)/i.test(line)) ?? lines.find(line => line.trim()) ?? "Échec sans détail exploitable.";
    const location = hit.match(/([\w./-]+\.(?:ts|tsx|js|jsx|rs|swift)):(\d+)(?::(\d+))?/i);
    return `${check.type}${location ? ` ${location[1]}:${location[2]}${location[3] ? `:${location[3]}` : ""}` : ""}: ${hit.trim().slice(0, 420)}`;
  }).slice(0, 6).join("\n");
}

export function temporalSampleTimes(prompt: string) {
  const durations = [...prompt.matchAll(/(\d+(?:[.,]\d+)?)\s*(ms|millisecond(?:e)?s?|s|seconde(?:s)?)/gi)].map(match => {
    const value = Number(match[1].replace(",", "."));
    return /^s|seconde/i.test(match[2]) ? value * 1000 : value;
  }).filter(value => Number.isFinite(value) && value >= 100 && value <= 10_000);
  const duration = durations.length ? Math.max(...durations) : 700;
  return [...new Set([0, .12, .3, .5, .75, 1, 1.22].map(factor => Math.min(10_000, Math.round(duration * factor))))].sort((a, b) => a - b);
}

/** Deterministic recovery for a generated document that is visually valid but
 * completely static. It adds one bounded, reduced-motion-safe entrance to
 * existing top-level/interactive elements; it never regenerates the UI. */
export function repairMeasuredMotion(html: string, requirements: string) {
  if (/data-cortex-motion-repair/.test(html)) return html;
  const durationMatch=requirements.match(/(\d+(?:[.,]\d+)?)\s*(ms|s|seconde(?:s)?)/i);
  const value=durationMatch?Number(durationMatch[1].replace(",",".")):0;
  const duration=Math.max(180,Math.min(2000,durationMatch&&/^s|seconde/i.test(durationMatch[2])?value*1000:value||600));
  const blur=/\bblur|flou/i.test(requirements)?"filter:blur(10px);":"";
  const scale=/\bscale|échelle|agrand/i.test(requirements)?"scale(.94) ":"";
  const translate=/\btranslate|apparition|entr[ée]e|cascade|stagger/i.test(requirements)?"translateY(16px) ":"";
  const style=`<style data-cortex-motion-repair>\n@keyframes cortexMeasuredIn{from{opacity:0;${blur}transform:${scale}${translate||"translateY(10px)"}}to{opacity:1;filter:blur(0);transform:none}}\nbody>*,main>*,button,[data-cortex]{animation:cortexMeasuredIn ${Math.round(duration)}ms cubic-bezier(.22,1,.36,1) both}main>*:nth-child(2),button:nth-of-type(2){animation-delay:40ms}main>*:nth-child(3),button:nth-of-type(3){animation-delay:80ms}\n@media(prefers-reduced-motion:reduce){body>*,main>*,button,[data-cortex]{animation:none!important}}\n</style>`;
  return /<\/head>/i.test(html)?html.replace(/<\/head>/i,`${style}</head>`):`${style}${html}`;
}

const elementChanged = (a: RenderReport["frames"][number]["elements"][number], b?: RenderReport["frames"][number]["elements"][number]) => Boolean(b && (
  Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1 ||
  Math.abs(a.opacity - b.opacity) > .015 || a.transform !== b.transform || a.filter !== b.filter
));

export function assessRender(report: RenderReport, temporal: boolean, requirements = ""): CortexVerification[] {
  if (!report.supported || !report.frames.length) return [{ type: "visual", success: false, status: "unavailable", output: "Aucun rendu capturé. La vérification visuelle n’a pas été effectuée." }];
  if(report.captureMode==='remotion'){
    const images=report.frames.every(frame=>frame.image?.startsWith('data:image/png;base64,')&&frame.raster?.length===768);
    const success=images&&!report.errors.length;
    return [{type:'visual',validatorId:'v5-remotion-frames',status:success?'passed':'failed',success,output:`Remotion : ${report.frames.length} images PNG capturées, échantillonnage raster ${images?'présent':'incomplet'}, erreurs ${report.errors.length}. Le DOM WebKit, l’accessibilité et la qualité artistique ne sont pas attestés.`}];
  }
  const errors = [...report.errors];
  for (const frame of report.frames) {
    if (frame.overflow > 2) errors.push(`Débordement horizontal ${frame.overflow}px à ${frame.timestamp}ms.`);
    if ((frame.overflowY ?? 0) > report.height * .5) errors.push(`Débordement vertical important ${frame.overflowY}px à ${frame.timestamp}ms.`);
    for (const issue of frame.telemetry ?? []) errors.push(`${issue.selector}: ${issue.detail} (${issue.issue}) à ${frame.timestamp}ms.`);
  }
  const final = report.frames.at(-1)!;
  const clipped = final.elements.filter(element => element.opacity > .05 && (element.x < -2 || element.x + element.width > report.width + 2)).slice(0, 4);
  if (clipped.length) errors.push(`Éléments coupés horizontalement : ${clipped.map(element => element.selector).join(", ")}.`);
  const textSizes = final.elements.filter(element => element.text && element.fontSize).map(element => element.fontSize!);
  const typography = textSizes.length ? `Tailles de texte observées ${Math.min(...textSizes).toFixed(0)}–${Math.max(...textSizes).toFixed(0)}px.` : "Typographie non mesurable dans les éléments ciblés.";
  const checks: CortexVerification[] = [{ type: "visual", success: !errors.length, status: errors.length ? "failed" : "passed", measurement:report.referenceDifference,qualityMetrics:report.referenceDifference===undefined?undefined:{referenceDifference:report.referenceDifference},output: `${report.frames.length} captures réelles ${report.width}×${report.height}. ${errors.join(" ") || "Pas de débordement, découpe horizontale ni erreur JavaScript observé."} ${typography}${report.referenceDifference !== undefined ? ` Écart pixel moyen du rendu final à la référence : ${report.referenceDifference.toFixed(3)} (mesure, pas jugement esthétique).` : ""}` }];
  if (temporal) {
    const issues: string[] = [];
    if (report.frames.length < 5) issues.push("Moins de cinq instants capturés.");
    const first = report.frames[0], last = report.frames.at(-1)!;
    const moved = report.frames.slice(1).some(frame => first.elements.some(element => elementChanged(element, frame.elements.find(next=>next.selector===element.selector))));
    if (!moved) issues.push("Aucun changement visuel mesuré entre le début et la fin de la séquence.");
    const target = temporalSampleTimes(requirements).at(-2) ?? 700;
    const hasExplicitDuration = /(\d+(?:[.,]\d+)?)\s*(?:ms|millisecond(?:e)?s?|s|seconde(?:s)?)/i.test(requirements);
    let lastMotionAt = 0; let largestJump = 0;
    for (let index = 1; index < report.frames.length; index++) {
      const before = report.frames[index - 1], after = report.frames[index];
      let changed = false;
      for (let element = 0; element < before.elements.length; element++) {
        const a = before.elements[element], b = after.elements.find(next=>next.selector===a.selector);
        if (!b) continue;
        const jump = Math.hypot(a.x - b.x, a.y - b.y);
        largestJump = Math.max(largestJump, jump);
        if (elementChanged(a, b)) changed = true;
      }
      if (changed) lastMotionAt = after.timestamp;
    }
    if (largestJump > Math.max(report.width, report.height) * .75) issues.push(`Saut spatial important mesuré (${largestJump.toFixed(0)}px entre deux captures).`);
    if (hasExplicitDuration && !/boucle|loop|infinite|infini/i.test(requirements) && lastMotionAt > target + 40) issues.push(`Le mouvement reste actif à ${lastMotionAt}ms alors que la durée demandée se termine vers ${target}ms.`);
    if (/prefers-reduced-motion|mouvement réduit/i.test(requirements) && report.frames.some(frame => frame.reducedMotion === undefined)) issues.push("La préférence de mouvement réduit n’a pas pu être mesurée.");
    checks.push({ type: "temporal", success: !issues.length, status: issues.length ? "failed" : "passed", output: issues.join(" ") || `Positions, dimensions, transformations, opacité et filtre mesurés sur ${report.frames.length} instants; dernier changement observé à ${lastMotionAt}ms.` });
  }
  return checks;
}
