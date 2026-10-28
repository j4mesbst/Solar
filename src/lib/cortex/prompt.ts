import type { SelectedProjectContext } from "../agent/types.ts";

/**
 * Keep the expensive prefix deterministic. Ollama may reuse its KV cache only
 * when this sequence stays byte-for-byte stable across repair turns.
 */
export function cortexStablePrefix(system: string, context: SelectedProjectContext, protocol: string) {
  void context; // Dynamic sources belong to the user payload, after the rules.
  return [system.trim(), "PROTOCOLE", protocol.trim()].join("\n\n");
}

export function cortexTurnPrompt(objective: string, context: SelectedProjectContext, progress: { plan: string[]; issues: string[]; changes: { path: string }[]; next: string }) {
  const files = context.files.map(file => `FICHIER ${file.path}\n${file.content}\nFIN FICHIER ${file.path}`).join("\n\n");
  return [
    `OBJECTIF\n${objective}`,
    `FICHIERS CONCERNÉS\n${context.files.map(file => file.path).join(", ") || "aucun"}`,
    `MODIFICATIONS VALIDÉES\n${progress.changes.map(change => change.path).join(", ") || "aucune"}`,
    `TESTS / ERREURS\n${progress.issues.join("\n").slice(0, 3500) || "aucun retour de vérification"}`,
    `PROCHAINE ACTION\n${progress.next}`,
    files,
  ].join("\n\n");
}

/** Omit complete source blocks, never arbitrary characters from an objective,
 * diagnosis or hash-guarded conflict snapshot. The caller can request a focused
 * file read again. Unknown prompt formats must fail visibly instead of losing
 * instructions or silently turning complete source into a partial source. */
export function compactPromptFiles(prompt: string, maximumCharacters: number) {
  if(prompt.length<=maximumCharacters)return prompt;
  const blocks=[...prompt.matchAll(/^FICHIER ([^\n]+)\n[\s\S]*?^FIN FICHIER \1$/gm)];
  let result=prompt;
  for(const block of blocks.reverse()){
    result=result.slice(0,block.index)+`FICHIER ${block[1]}\n[Source omise pour la fenêtre de contexte; lire ce fichier ou sa plage avant édition.]\nFIN FICHIER ${block[1]}`+result.slice(block.index+block[0].length);
    if(result.length<=maximumCharacters)return result;
  }
  throw Error("CORTEX_CONTEXT: Objectif, diagnostics et source de conflit dépassent la fenêtre disponible. Réduis le périmètre; aucune instruction n’a été tronquée silencieusement.");
}
