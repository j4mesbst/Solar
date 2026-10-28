import type { AgentFileChange, AgentProject } from "../agent/types.ts";
import { sourceHash } from "./semantic.ts";

/** Isolated proposal transaction. No operation in this module writes to disk. */
export function beginTransaction(changes: AgentFileChange[]) {
  return new Map(changes.map(change => [change.path, { ...change }]));
}

export async function assertCurrentSources(project: AgentProject, changes: AgentFileChange[], signal: AbortSignal) {
  for (const change of changes) {
    signal.throwIfAborted();
    if (change.created) {
      if (project.files.includes(change.path)) throw Error(`${change.path} existe maintenant dans le projet. La création proposée doit être réexaminée.`);
      continue;
    }
    const current = await project.readFile(change.path, signal);
    if (current !== change.before) throw Error(`${change.path} a changé sur disque (#${sourceHash(current)}). Transaction suspendue; les modifications externes sont préservées.`);
  }
}

export async function completeTransaction(project: AgentProject, staged: Map<string, AgentFileChange>, signal: AbortSignal) {
  const changes = [...staged.values()].filter(change => change.created || change.before !== change.after);
  await assertCurrentSources(project, changes, signal);
  return changes.map(change => ({ ...change }));
}
