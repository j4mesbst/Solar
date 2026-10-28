import type { CortexVerification } from "./types.ts";

/** Await cancellation independently of an adapter's willingness to settle.
 * The adapter still receives the same signal and must stop its underlying IO. */
export function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Annulé", "AbortError"));
    if (signal.aborted) { operation.catch(() => {}); abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
export function stableDiagnostic(text: string) {
  return text.replace(/(?:\/private)?\/(?:var\/folders\/[^\s:]+\/T|tmp)\/solar-(?:bench|cortex)-[\w-]+/g, "[copie]");
}
/** Preserve assertion diffs, not merely their header or a temporary stack path. */
export function diagnosticExcerpt(output: string) {
  const lines = stableDiagnostic(output).split("\n");
  const at = lines.findIndex(line => /AssertionError|TypeError|SyntaxError|ReferenceError|error:|expected|attendu|observé/i.test(line));
  return lines.slice(Math.max(0, at), Math.max(0, at) + 24).join("\n").slice(0, 1800);
}
/** Enrich feedback only: independent validator verdicts remain untouched. */
export function structuralFeedback(checks: CortexVerification[]) {
  return checks.filter(check => check.status === "failed" && /observé null|élément absent|DOM requis/i.test(check.output))
    .map(check => `STRUCTURE DOM : ${check.output.slice(0, 800)}. Corrige d’abord React/HTML : crée ou restaure la cible exacte et ses attributs. Une correction CSS seule ne peut pas créer un élément absent.`);
}
