import type { AgentErrorSummary, AgentFileChange, SelectedProjectContext, VerificationResult } from "./types.ts";

const sourcePattern = /\.(?:[cm]?[jt]sx?)$/i;
const localImport = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;
const candidates = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

function resolveRelative(from: string, specifier: string) {
  const stack = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || !part) continue;
    if (part === "..") { if (!stack.length) return null; stack.pop(); }
    else stack.push(part);
  }
  return stack.join("/");
}

export async function verifyStagedChanges(changes: AgentFileChange[], context: SelectedProjectContext, projectFiles: string[], signal: AbortSignal): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const files = new Set([...projectFiles, ...changes.map(change => change.path)]);
  for (const change of changes) {
    signal.throwIfAborted();
    if (change.after.includes("<<<<<<< ") || change.after.includes("=======\n") && change.after.includes(">>>>>>> ")) {
      results.push({ type: "structure", success: false, file: change.path, output: "Marqueurs de conflit présents." });
      continue;
    }
    if (change.path.endsWith(".json")) {
      try { JSON.parse(change.after); results.push({ type: "syntax", success: true, file: change.path, output: "JSON valide." }); }
      catch (error) { results.push({ type: "syntax", success: false, file: change.path, output: error instanceof Error ? error.message : "JSON invalide." }); }
    } else if (sourcePattern.test(change.path)) {
      const parser = await import("@babel/parser");
      try {
        parser.parse(change.after, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"], errorRecovery: false });
        results.push({ type: "syntax", success: true, file: change.path, output: "Syntaxe JavaScript/TypeScript analysée." });
      } catch (error) {
        const issue = error as Error & { loc?: { line: number } };
        results.push({ type: "syntax", success: false, file: change.path, line: issue.loc?.line, output: issue.message });
      }
      for (const match of change.after.matchAll(localImport)) {
        const resolved = resolveRelative(change.path, match[1]);
        if (resolved && candidates.some(ext => files.has(`${resolved}${ext}`))) continue;
        results.push({ type: "imports", success: false, file: change.path, output: `Import local introuvable : ${match[1]}` });
      }
      if (!results.some(result => result.file === change.path && result.type === "imports" && !result.success)) results.push({ type: "imports", success: true, file: change.path, output: "Imports relatifs présents dans l’index." });
    } else results.push({ type: "structure", success: true, file: change.path, output: "Fichier proposé dans les limites du projet." });
  }
  if (!changes.length) results.push({ type: "structure", success: true, output: "Aucun changement de fichier proposé." });
  if (context.estimatedTokens > context.budget) results.push({ type: "structure", success: false, output: "Budget de contexte dépassé." });
  return results;
}

export function summarizeVerification(results: VerificationResult[]): AgentErrorSummary | null {
  const failures = results.filter(result => !result.success);
  if (!failures.length) return null;
  const first = failures[0];
  return { primaryError: first.output.slice(0, 500), file: first.file, line: first.line, relatedErrors: failures.slice(1, 5).map(result => `${result.file ?? "Projet"}: ${result.output.slice(0, 250)}`) };
}

export function repairFeedback(error: AgentErrorSummary, context: SelectedProjectContext, changes: AgentFileChange[] = []) {
  const source = error.file ? changes.find(change => change.path === error.file)?.after ?? context.files.find(file => file.path === error.file)?.content : undefined;
  return `Le changement préparé a échoué à la vérification.\nErreur principale : ${error.primaryError}\nFichier : ${error.file ?? "inconnu"}${error.line ? `:${error.line}` : ""}\nErreurs liées : ${error.relatedErrors.join(" ; ") || "aucune"}\nContexte ciblé :\n${source?.slice(0, 5000) ?? "Consulte le fichier concerné si nécessaire."}\nCorrige uniquement cette cause. Renvoie des actions structurées, de préférence patchFile. Aucune commande shell.`;
}
