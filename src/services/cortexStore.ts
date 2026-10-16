import { scopedKey } from "./accountScope.ts";
import type { CortexPersistence, CortexTask } from "../lib/cortex/types.ts";
import type { Trajectory, StrategyVersion } from "../lib/cortex/learning.ts";
import { mayPromoteStrategy } from "../lib/cortex/learning.ts";
import type { ModelExperience } from "../lib/cortex/adaptive.ts";
interface CortexData { tasks: CortexTask[]; trajectories: Trajectory[]; strategies: StrategyVersion[]; activeStrategy?: string; modelExperiences?:ModelExperience[] }
const empty = (): CortexData => ({ tasks: [], trajectories: [], strategies: [] });
let queue = Promise.resolve();
const temporary = new Map<string, CortexTask>();
const deletedConversations = new Set<string>();
async function read(): Promise<CortexData> {
  if (typeof window !== "undefined" && (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const store = await (await import("@tauri-apps/plugin-store")).load(scopedKey("solar.cortex")+".json", { defaults: {}, autoSave: false });
    return await store.get<CortexData>("data") ?? empty();
  }
  return JSON.parse(localStorage.getItem(scopedKey("solar.cortex.v1")) ?? "null") ?? empty();
}
async function write(data: CortexData) {
  if (typeof window !== "undefined" && (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const store = await (await import("@tauri-apps/plugin-store")).load(scopedKey("solar.cortex")+".json", { defaults: {}, autoSave: false });
    await store.set("data",data); await store.save();
  } else localStorage.setItem(scopedKey("solar.cortex.v1"), JSON.stringify(data));
}
function mutate(fn: (data: CortexData) => void) { const next = queue.then(async () => { const data = await read(); fn(data); await write(data); }); queue = next.catch(() => {}); return next; }
export const cortexStore: CortexPersistence & {
  list(conversationId?: string): Promise<CortexTask[]>; clearMemory(): Promise<void>;
  trajectories(): Promise<Trajectory[]>; record(item: Trajectory): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  strategies(): Promise<StrategyVersion[]>;
  promote(baseline:StrategyVersion,candidate:StrategyVersion):Promise<void>;
  rollback(version:string):Promise<void>;
  activeRules():Promise<string>;
  modelExperience(key:string):Promise<ModelExperience|undefined>;
  saveModelExperience(profile:ModelExperience):Promise<void>;
} = {
  save(task) {
    if(deletedConversations.has(task.conversationId))return Promise.resolve();
    if (task.conversationId.startsWith("temp:")) { temporary.set(task.id, structuredClone(task));while(temporary.size>40)temporary.delete(temporary.keys().next().value!);return Promise.resolve(); }
    return mutate(data => { if(deletedConversations.has(task.conversationId))return;data.tasks = [...data.tasks.filter(t => t.id !== task.id), task].slice(-40);while(data.tasks.length>1&&JSON.stringify(data.tasks).length>24_000_000)data.tasks.shift(); });
  },
  async load(id) { if (temporary.has(id)) return structuredClone(temporary.get(id)); await queue; return (await read()).tasks.find(t => t.id === id); },
  async list(id) { await queue; return [...(await read()).tasks, ...temporary.values()].filter(t => !id || t.conversationId === id); },
  async trajectories() { await queue; return (await read()).trajectories; },
  async modelExperience(key){await queue;return (await read()).modelExperiences?.find(profile=>profile.key===key);},
  saveModelExperience(profile){return mutate(data=>{data.modelExperiences=[...(data.modelExperiences??[]).filter(item=>item.key!==profile.key),structuredClone(profile)].slice(-30);});},
  record(item) { return mutate(data => { if(deletedConversations.has(item.conversationId))return;data.trajectories = [...data.trajectories.filter(t => t.id !== item.id), item].slice(-100); }); },
  clearMemory() { return mutate(data => { data.trajectories = []; data.strategies = []; data.modelExperiences=[]; data.activeStrategy = undefined; }); },
  async strategies(){await queue;return (await read()).strategies;},
  promote(baseline,candidate){if(!mayPromoteStrategy(baseline,candidate))return Promise.reject(new Error("La stratégie n’a pas démontré un gain sans régression sur le benchmark apparié."));return mutate(data=>{data.strategies=[...data.strategies.filter(s=>s.version!==baseline.version&&s.version!==candidate.version),baseline,{...candidate,parent:baseline.version}].slice(-20);data.activeStrategy=candidate.version;});},
  rollback(version){return mutate(data=>{if(!data.strategies.some(s=>s.version===version))throw new Error("Version de stratégie introuvable.");data.activeStrategy=version;});},
  async activeRules(){await queue;const data=await read();return data.strategies.find(s=>s.version===data.activeStrategy)?.rules.slice(0,5).join("\n").slice(0,1000)??"";},
  deleteConversation(id) { deletedConversations.add(id);for (const [key,task] of temporary) if (task.conversationId === id) temporary.delete(key); return mutate(data => {const removed=new Set(data.tasks.filter(t=>t.conversationId===id).map(t=>t.id)); data.tasks = data.tasks.filter(t => t.conversationId !== id); data.trajectories = data.trajectories.filter(t => !removed.has(t.id)&&t.conversationId!==id); }); },
};
