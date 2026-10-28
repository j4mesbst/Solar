import type { ToolApproval } from "./toolRegistry.ts";

export interface PendingToolApproval extends ToolApproval { id: string }
let pending: PendingToolApproval[] = [];
const listeners = new Set<() => void>();
const decisions = new Map<string, (allowed: boolean) => void>();
const publish = () => listeners.forEach(listener => listener());
export const toolApprovals = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => pending,
  decide(id: string, allowed: boolean) { decisions.get(id)?.(allowed); },
  request(request: ToolApproval, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    return new Promise(resolve => {
      const id = crypto.randomUUID();
      const finish = (allowed: boolean) => {
        signal.removeEventListener("abort", abort);
        decisions.delete(id); pending = pending.filter(item => item.id !== id); publish();
        resolve(allowed && !signal.aborted);
      };
      const abort = () => finish(false);
      decisions.set(id, finish); pending = [...pending, { ...request, id }];
      signal.addEventListener("abort", abort, { once: true }); publish();
      if (signal.aborted) abort();
    });
  },
};
