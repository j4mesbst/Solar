import {agentName} from './agentNames.ts';
import {latestFinishedReply} from './agentReadState.ts';
import {readUsage} from './usage.ts';
import {SOLAR_PLANS,effectiveSolarLimits} from './solarPlans.ts';
import {learnWorkspaceInput,observeWorkspace,type AgentWorkspace,type RoutineKind} from "./agentWorkspaces.ts";
import {watchOutcome} from "./missionEvidence.ts";
import { learnNotebook, type AgentNotebook } from "./agentNotebook.ts";
import { scopedKey } from "./accountScope.ts";
import { currentAccountScope } from "./accountScope.ts";
import type { Effort, AgentAccessMode } from "../domain/types.ts";

export type MissionStatus = "queued" | "running" | "permission" | "paused" | "completed" | "failed" | "cancelled" | "waiting" | "partial";
export type ConnectionGrant = `${string}.read` | `${string}.write`;
export interface SolarAgent {
  setupKey?:string;
  id: string; ownerId: string; name: string; description: string; instructions: string;
  providerId: string; modelId: string; effort: Effort; enabled: boolean;
  grants: ConnectionGrant[]; skillIds: string[]; memoryEnabled: boolean;
  budget?:{maxModelCalls?:number;maxToolCalls?:number;maxTokens?:number;maxDurationMs?:number};accessMode?: AgentAccessMode;
  createdAt: string; updatedAt: string;
}
export type MascotId = 'orbit'|'drop'|'spark'|'petal'|'pebble';
export interface TeamProfile {libraryFolders?:{id:string;name:string;files:string[]}[];pinned?:boolean; color?:string; manager?:boolean;lastReadMissionId?:string;agentId:string;conversationId:string;mascot:MascotId;needsRole?:boolean;role?:string;suggestions?:{roleTitle?:string;role:string;status:"ready"|"error";items:{id:string;service:string;text:string}[];error?:string}}
export interface MissionEvent { at: string; kind: "started" | "tool" | "verified" | "error" | "paused"; detail: string }
export interface AgentMission {
  question?:import("../domain/types").AgentQuestion;
  sources?:import('../domain/extensions').SearchSource[];
  workspaceId?:string;kind?:RoutineKind;verification?:{checked:number;limitations:string[]};id: string; agentId: string; goal: string; requestText?: string; status: MissionStatus; createdAt: string; updatedAt: string;
  evidenceDigest?:string;usage?:{inputTokens?:number;outputTokens?:number;modelCalls?:number;toolCalls?:number;elapsedMs?:number;estimated?:boolean};origin?: "initiative"; result?: string; error?: string; events: MissionEvent[]; checkpoint?: { delegations?:{agentId:string;instruction:string;missionId:string}[]; cortex?:import("../lib/cortex/tool-runtime.ts").CortexToolTelemetry; toolName?: string; toolResult?: string; response?: string; calls?: import("../lib/cortex/tool-runtime.ts").CortexToolCall[] };
}
export interface AgentMemory {
  id: string; scope: "user" | "project" | "agent" | "skill"; agentId?: string; projectId?: string;
  content: string; source: string; conversationId?: string; status: "current" | "obsolete";
  confirmed: boolean; createdAt: string; updatedAt: string;
}
export interface AgentAutomation {
  workspaceId?:string;kind?:RoutineKind;readConsent?:{providerId:string;modelId:string;services:string[];connections:Record<string,string>;instruction:string;resources:string};id: string; agentId: string; instruction: string; frequency: "once" | "daily" | "weekly";
  localDate?: string; localTime: string; timezone: string; weekdays?: number[]; enabled: boolean;
  notifyOn?:"always"|"changes";lastEvidenceDigest?:string;lastCheckedAt?:string;lastNotifiedAt?:string;nextRunAt: string; interactiveOnce?: boolean; lastOccurrence?: string; lastResult?: string; missed?: boolean;
  createdAt: string; updatedAt: string;
}
export interface AgentData {removedTeamProfiles?:TeamProfile[];configurationNamesVersion?:1; configuration?:import("./setupTypes").SetupState;manager?:import("./setupTypes").TeamManager; team?:{version:1;personalized?:true;readReceipts?:1;selected:string;profiles:TeamProfile[]}; workspaces?:AgentWorkspace[];workspaceConversations?:Record<string,string>; version: 1; notebooks?: Record<string, AgentNotebook>; memorySettings?: { enabled: boolean; cloud: boolean }; atlas?: { version: 1; agentId: string; conversationId: string }; agents: SolarAgent[]; missions: AgentMission[]; memories: AgentMemory[]; automations: AgentAutomation[] }
const empty = (): AgentData => ({ version: 1, agents: [], missions: [], memories: [], automations: [] });
let queue = Promise.resolve();
const native = () => typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
async function read(): Promise<AgentData> {
  let value: AgentData | null;
  if (native()) {
    const store = await (await import("@tauri-apps/plugin-store")).load(scopedKey("solar.agent") + ".json", { defaults: {}, autoSave: false });
    value = await store.get<AgentData>("data") ?? null;
  } else value = JSON.parse(localStorage.getItem(scopedKey("solar.agent.v1")) ?? "null");
  if (!value) return empty();
  if (value.version !== 1 || !Array.isArray(value.agents) || !Array.isArray(value.missions) || !Array.isArray(value.memories) || !Array.isArray(value.automations)) throw new Error("Stockage Solar Agent incompatible ; aucune donnée n’a été écrasée.");
  return value;
}
async function write(data: AgentData) {
  if (native()) {
    const store = await (await import("@tauri-apps/plugin-store")).load(scopedKey("solar.agent") + ".json", { defaults: {}, autoSave: false });
    await store.set("data", data); await store.save();
  } else localStorage.setItem(scopedKey("solar.agent.v1"), JSON.stringify(data));
}
async function mutate(fn: (data: AgentData) => void): Promise<AgentData> {
  const owner = currentAccountScope();
  const next = queue.then(async () => { if (owner !== currentAccountScope()) throw new Error("Compte Solar modifié."); const data = await read(); fn(data); await write(data); return structuredClone(data); });
  queue = next.then(() => {}, () => {}); return next;
}
export const solarAgentStore = {
  async normalizeConfigurationNames(){return mutate(data=>{
    const managerId=data.manager?.agentId??data.configuration?.created.manager;
    if(!managerId||data.configurationNamesVersion===1)return;
    data.configurationNamesVersion=1;
    const ids=new Set(Object.values(data.configuration?.created??{}));
    for(const a of data.agents)if(a.id!==managerId&&a.name.toLocaleLowerCase()==='atlas')ids.add(a.id);
    const used=new Set(data.agents.filter(a=>a.id!==managerId&&!ids.has(a.id)).map(a=>a.name.toLocaleLowerCase()));used.add('atlas');
    const manager=data.agents.find(a=>a.id===managerId);if(manager)manager.name='Atlas';
    for(const a of data.agents.filter(a=>a.id!==managerId&&ids.has(a.id)))a.name=agentName(a.name,used);
    const proposal=data.configuration?.proposal;if(proposal){proposal.manager.name='Atlas';for(const p of proposal.agents){const a=data.agents.find(a=>a.id===(p.existingAgentId??data.configuration?.created[p.key]));if(a)p.name=a.name;}}
  });},
  async nameTeamManager(id:string){return mutate(data=>{const agent=data.agents.find(a=>a.id===id);if(!agent)throw Error('Manager indisponible.');if(data.agents.some(a=>a.id!==id&&a.name.toLocaleLowerCase()==='atlas'))throw Error('Un autre agent porte déjà le nom Atlas. Associe-le au manager ou renomme-le.');agent.name='Atlas';});},
  async ensureTeam(_defaults:{providerId:string;modelId:string},conversationIds:string[]=[]){return mutate(data=>{
    if(data.team){
      if(data.team.version!==1||!Array.isArray(data.team.profiles)||data.team.profiles.some(p=>!p||!data.agents.some(a=>a.id===p.agentId)||typeof p.conversationId!=="string"||!p.conversationId.startsWith("atlas:")||!["orbit","drop","spark","petal","pebble"].includes(p.mascot))||new Set(data.team.profiles.map(p=>p.agentId)).size!==data.team.profiles.length||new Set(data.team.profiles.map(p=>p.conversationId)).size!==data.team.profiles.length||(data.team.profiles.length&&!data.team.profiles.some(p=>p.agentId===data.team!.selected)))throw Error("L’équipe Solar ne peut pas être restaurée. Aucune donnée n’a été remplacée.");
      if(!data.team.personalized){
        const seeds:Record<string,string>={Atlas:'Ton bras droit pour organiser, comprendre et faire avancer les choses.',Milo:'Tes e-mails, résumés et réponses à préparer.',Nova:'Tes rendez-vous, ta journée et tes prochaines échéances.',Pixel:'Tes projets, dépôts et tickets, avec des sources vérifiées.',Luma:'Tes recherches, documents et idées à approfondir.'};
        data.team.profiles=data.team.profiles.filter(p=>{const a=data.agents.find(a=>a.id===p.agentId)!;return !!p.role||!!p.needsRole||seeds[a.name]!==a.description||conversationIds.includes(p.conversationId)||data.missions.some(m=>m.agentId===a.id)||data.automations.some(m=>m.agentId===a.id)||data.memories.some(m=>m.agentId===a.id)||!!data.notebooks?.[a.id];});
        if(!data.team.profiles.some(p=>p.agentId===data.team!.selected))data.team.selected=data.team.profiles[0]?.agentId??'';
        data.team.personalized=true;
      }
      if(data.team.readReceipts!==1){for(const p of data.team.profiles)p.lastReadMissionId=latestFinishedReply(data.missions,p.agentId)?.id??'';data.team.readReceipts=1;}
      return;
    }
    // Existing authored agents migrate; a new account starts genuinely empty.
    const profiles:TeamProfile[]=data.agents.map(a=>({agentId:a.id,conversationId:data.atlas?.agentId===a.id?data.atlas.conversationId:`atlas:team:${crypto.randomUUID()}`,mascot:'orbit',role:a.instructions}));
    for(const p of profiles)p.lastReadMissionId=latestFinishedReply(data.missions,p.agentId)?.id??'';
    data.team={version:1,personalized:true,readReceipts:1,selected:profiles[0]?.agentId??'',profiles};
  });},
  async createTeamAgent(name:string,mascot:MascotId,defaults:{providerId:string;modelId:string},role?:string,setupKey?:string){let created:TeamProfile|undefined;await mutate(data=>{
 if(setupKey){const existing=data.agents.find(a=>a.setupKey===setupKey);if(existing){created=data.team?.profiles.find(p=>p.agentId===existing.id);if(created)return;throw Error("Agent créé hors de cette équipe.");}}
 const plan=readUsage().plan;if((data.team?.profiles.length??0)>=effectiveSolarLimits(plan).agents)throw Error(`Ton offre ${SOLAR_PLANS[plan].name} a atteint sa limite d’agents. Tes agents existants sont conservés ; consulte Abonnement pour en créer davantage.`);
    name=name.trim();if(role!==undefined&&(!role.trim()||role.trim().length>12000))throw Error("Décris son rôle en 12 000 caractères maximum.");if(!data.team||!name||name.length>60||/[\u0000-\u001f]/.test(name)||!['orbit','drop','spark','petal','pebble'].includes(mascot))throw Error("Choisis un nom et une mascotte valides.");
    if(data.team.profiles.some(p=>data.agents.find(a=>a.id===p.agentId)?.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error("Un agent porte déjà ce nom.");
    const at=new Date().toISOString(),id=crypto.randomUUID();
    data.agents.push({id,setupKey,ownerId:currentAccountScope(),name,description:'Un nouveau rôle à définir.',instructions:'Réponds naturellement et brièvement. Demande à l’utilisateur quel rôle il souhaite te confier.',...defaults,effort:'medium',enabled:true,grants:[],skillIds:[],memoryEnabled:true,accessMode:'standard',createdAt:at,updatedAt:at});
    created={lastReadMissionId:'',agentId:id,conversationId:`atlas:team:${crypto.randomUUID()}`,mascot,needsRole:!role,role:role?.trim()};if(role){const a=data.agents.at(-1)!;a.description=role.trim().slice(0,220);a.instructions=role.trim()+'\nRéponds naturellement et brièvement. Respecte les permissions effectives et vérifie les résultats.';}data.team.profiles.push(created);data.team.selected=id;
  });return created!;},
  async saveConfiguration(configuration:import('./setupTypes').SetupState){return mutate(data=>{data.configuration=structuredClone(configuration);});},
  async saveManager(manager:import('./setupTypes').TeamManager){return mutate(data=>{if(!data.team?.profiles.some(p=>p.agentId===manager.agentId))throw Error('Manager indisponible.');data.manager=structuredClone(manager);data.configurationNamesVersion=1;});},
  async updateManager(update:(manager:import('./setupTypes').TeamManager)=>void){return mutate(data=>{if(data.manager)update(data.manager);});},
  async placeTeamAgent(id:string,beforeId:string|undefined,manager:boolean,after=false){return mutate(data=>{const list=data.team?.profiles;if(!list)throw Error("Équipe indisponible.");const p=list.find(p=>p.agentId===id);if(!p||beforeId&&!list.some(p=>p.agentId===beforeId))throw Error("Agent indisponible.");if(beforeId===id)return;p.manager=manager;p.pinned=manager;data.configurationNamesVersion=1;list.splice(list.indexOf(p),1);const target=beforeId?list.findIndex(p=>p.agentId===beforeId):list.length;list.splice(target+(beforeId&&after?1:0),0,p);if(!data.manager&&manager)data.manager={agentId:id,enabled:false,nextCheckAt:new Date().toISOString(),grants:[],tasks:[]};});},
  async designateManager(id:string,value:boolean){return mutate(data=>{const p=data.team?.profiles.find(p=>p.agentId===id);if(!p)throw Error("Agent indisponible.");p.manager=value;p.pinned=value;data.configurationNamesVersion=1;if(!data.manager&&value)data.manager={agentId:id,enabled:false,nextCheckAt:new Date().toISOString(),grants:[],tasks:[]};});},
  async useTeamModel(providerId:string,modelId:string){return mutate(data=>{for(const a of data.agents){a.providerId=providerId;a.modelId=modelId;a.updatedAt=new Date().toISOString();}if(data.manager)data.manager.enabled=false;});},
  async pinTeamAgent(id:string,pinned:boolean){return mutate(data=>{const p=data.team?.profiles.find(p=>p.agentId===id);if(!p)throw Error("Agent indisponible.");p.pinned=pinned;});},
  async moveTeamAgent(id:string,beforeId:string){return mutate(data=>{const list=data.team?.profiles;if(!list||id===beforeId)return;const from=list.findIndex(p=>p.agentId===id);if(from<0||!list.some(p=>p.agentId===beforeId))throw Error("Agent indisponible.");const [profile]=list.splice(from,1);list.splice(list.findIndex(p=>p.agentId===beforeId),0,profile);});},
  async selectTeamAgent(id:string){return mutate(data=>{if(!data.team?.profiles.some(p=>p.agentId===id))throw Error("Cet agent est indisponible.");data.team.selected=id;});},
  async markTeamAgentRead(id:string){return mutate(data=>{const p=data.team?.profiles.find(p=>p.agentId===id);if(p)p.lastReadMissionId=latestFinishedReply(data.missions,id)?.id??'';});},
  async defineTeamAgent(id:string,patch:{name?:string;role?:string;mascot?:MascotId;color?:string}){return mutate(data=>{
    const profile=data.team?.profiles.find(p=>p.agentId===id),agent=data.agents.find(a=>a.id===id);if(!profile||!agent)throw Error("Cet agent est indisponible.");
    if(patch.name!==undefined){const name=patch.name.trim();if(!name||name.length>60||/[\u0000-\u001f]/.test(name))throw Error("Le nom doit contenir entre 1 et 60 caractères.");if(data.team!.profiles.some(p=>p.agentId!==id&&data.agents.find(a=>a.id===p.agentId)?.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error("Un agent porte déjà ce nom.");agent.name=name;}
    if(patch.role!==undefined){const role=patch.role.trim();if(!role||role.length>12000)throw Error("Décris son rôle en 12 000 caractères maximum.");agent.description=role.slice(0,220);if(profile.role!==role)delete profile.suggestions;profile.role=role;agent.instructions=role+'\nRéponds naturellement et brièvement. Respecte les permissions effectives et vérifie les résultats.';profile.needsRole=false;}
    if(patch.color!==undefined){if(!/^#[0-9a-f]{6}$/i.test(patch.color))throw Error("Couleur invalide.");profile.color=patch.color;}
    if(patch.mascot!==undefined){if(!['orbit','drop','spark','petal','pebble'].includes(patch.mascot))throw Error("Mascotte invalide.");profile.mascot=patch.mascot;}agent.updatedAt=new Date().toISOString();
  });},
  async saveTeamSuggestions(id:string,role:string,result:NonNullable<TeamProfile['suggestions']>){return mutate(data=>{const p=data.team?.profiles.find(p=>p.agentId===id);if(!p||p.role!==role)return;p.suggestions=structuredClone(result);});},
  async ensureAtlas(defaults: { providerId: string; modelId: string; effort: Effort }): Promise<NonNullable<AgentData["atlas"]>> {
    const data = await mutate(data => {
      if (data.atlas) {
        if (data.atlas.version !== 1 || !data.agents.some(item => item.id === data.atlas!.agentId)) throw new Error("Configuration Atlas incompatible. Les anciens agents sont conservés.");
        return;
      }
      const timestamp = new Date().toISOString(), id = crypto.randomUUID();
      // Additive migration: never repurpose an existing agent or silently grant
      // Atlas its permissions, memories or scheduled work.
      data.agents.push({ id, ownerId: currentAccountScope(), name: "Atlas", description: "Ton agent personnel", instructions: "Réponds naturellement et brièvement.", ...defaults, enabled: true, grants: [], skillIds: [], memoryEnabled: true, createdAt: timestamp, updatedAt: timestamp });
      data.atlas = { version: 1, agentId: id, conversationId: `atlas:${crypto.randomUUID()}` };
    });
    return data.atlas!;
  },
  async selectAtlasConversation(conversationId:string) { return mutate(data=>{if(!data.atlas||!conversationId.startsWith("atlas:"))throw Error("Conversation Atlas invalide.");data.atlas.conversationId=conversationId;}); },
  async snapshot() { await queue; return structuredClone(await read()); },
  async saveWorkspace(workspace:AgentWorkspace,conversationId?:string){return mutate(data=>{
    if(!data.agents.some(a=>a.id===workspace.agentId)||!workspace.name.trim()||workspace.name.length>100||workspace.goal.length>2000||workspace.resources.length>12)throw Error("Dossier de travail invalide.");
    const existing=data.workspaces?.find(w=>w.id===workspace.id);if(!existing&&(data.workspaces?.length??0)>=100)throw Error("La limite de 100 dossiers est atteinte. Supprime un ancien dossier avant de continuer.");if(existing&&existing.agentId!==workspace.agentId)throw Error("Dossier d’un autre agent.");
    data.workspaces=[...(data.workspaces??[]).filter(w=>w.id!==workspace.id),structuredClone(workspace)];if(conversationId){data.workspaceConversations??={};data.workspaceConversations[conversationId]=workspace.id;}
  });},
  async updateWorkspaceDefinition(id:string,patch:Pick<AgentWorkspace,'name'|'goal'|'resources'>){return mutate(data=>{const workspace=data.workspaces?.find(w=>w.id===id);if(!workspace||!patch.name.trim()||patch.name.length>100||patch.goal.length>2000||patch.resources.length>12)throw Error("Dossier invalide.");Object.assign(workspace,structuredClone(patch),{updatedAt:new Date().toISOString()});});},
  async linkWorkspace(agentId:string,conversationId:string,id?:string){return mutate(data=>{if(id&&!data.workspaces?.some(w=>w.id===id&&w.agentId===agentId&&!w.archived))throw Error("Dossier indisponible.");data.workspaceConversations??={};if(id)data.workspaceConversations[conversationId]=id;else delete data.workspaceConversations[conversationId];});},
  async deleteWorkspace(id:string){return mutate(data=>{data.workspaces=data.workspaces?.filter(w=>w.id!==id);for(const [conversation,key]of Object.entries(data.workspaceConversations??{}))if(key===id)delete data.workspaceConversations![conversation];});},
  async setWorkspaceMission(id:string,missionId:string){return mutate(data=>{const workspace=data.workspaces?.find(w=>w.id===id);if(workspace){workspace.lastMissionId=missionId;workspace.updatedAt=new Date().toISOString();}});},
  async forgetWorkspaceNote(id:string,key:string){return mutate(data=>{const workspace=data.workspaces?.find(w=>w.id===id);if(workspace){workspace.notes=workspace.notes.filter(n=>n.key!==key);workspace.updatedAt=new Date().toISOString();}});},
  async recordWorkspaceInput(id:string,text:string,source:Parameters<typeof learnWorkspaceInput>[2]){return mutate(data=>{const index=data.workspaces?.findIndex(w=>w.id===id&&!w.archived)??-1;if(index<0)throw Error("Dossier indisponible.");const agent=data.agents.find(a=>a.id===data.workspaces![index].agentId);if(!agent?.memoryEnabled||data.memorySettings?.enabled===false)return;data.workspaces![index]=learnWorkspaceInput(data.workspaces![index],text,source);});},
  async observeWorkspace(id:string,calls:import("../lib/cortex/tool-runtime.ts").CortexToolCall[],missionId:string){return mutate(data=>{const index=data.workspaces?.findIndex(w=>w.id===id&&!w.archived)??-1;if(index<0)return;const agent=data.agents.find(a=>a.id===data.workspaces![index].agentId);if(agent?.memoryEnabled&&data.memorySettings?.enabled!==false)data.workspaces![index]=observeWorkspace(data.workspaces![index],calls,missionId);});},
  async saveAgent(agent: SolarAgent) { return mutate(data => { if (agent.ownerId !== currentAccountScope()) throw new Error("Compte propriétaire incorrect."); data.agents = [...data.agents.filter(item => item.id !== agent.id), structuredClone(agent)]; }); },
  async removeTeamAgent(id:string){return mutate(data=>{
    const profile=data.team?.profiles.find(p=>p.agentId===id),agent=data.agents.find(a=>a.id===id);
    if(!profile||!agent)throw Error('Agent indisponible.');
    if(data.missions.some(m=>m.agentId===id&&['running','queued','permission','waiting'].includes(m.status)))throw Error('Arrête les missions de cet agent avant de le supprimer.');
    data.removedTeamProfiles=[...(data.removedTeamProfiles??[]).filter(p=>p.agentId!==id),profile];
    data.team!.profiles=data.team!.profiles.filter(p=>p.agentId!==id);
    if(data.team!.selected===id)data.team!.selected=data.team!.profiles[0]?.agentId??'';
    agent.enabled=false;agent.updatedAt=new Date().toISOString();
    for(const automation of data.automations)if(automation.agentId===id)automation.enabled=false;
    if(data.manager?.agentId===id)data.manager.enabled=false;
  });},
  async restoreTeamAgent(id:string){return mutate(data=>{
    const profile=data.removedTeamProfiles?.find(p=>p.agentId===id),agent=data.agents.find(a=>a.id===id);
    if(!profile||!agent||!data.team)throw Error('Agent indisponible.');
    data.team.profiles.push(profile);data.team.selected=id;agent.enabled=true;
    data.removedTeamProfiles=data.removedTeamProfiles?.filter(p=>p.agentId!==id);
    // Recurring permissions remain paused after restoration.
  });},
  async addLibraryFolder(id:string,folder:{id:string;name:string;files:string[]}){return mutate(data=>{
    const profile=data.team?.profiles.find(p=>p.agentId===id);if(!profile)throw Error('Agent indisponible.');
    if(!folder.name.trim()||folder.name.length>255||folder.files.length>2000||folder.files.some(f=>typeof f!=='string'||f.length>4096))throw Error('Dossier invalide.');
    profile.libraryFolders=[...(profile.libraryFolders??[]).filter(f=>f.id!==folder.id),structuredClone(folder)];
  });},
  async deleteAgent(id: string) { return mutate(data => { if (data.atlas?.agentId === id) throw new Error("Atlas est l’assistant principal. Ses données peuvent être gérées sans supprimer son profil."); if(data.team){data.team.profiles=data.team.profiles.filter(p=>p.agentId!==id);if(data.team.selected===id)data.team.selected=data.team.profiles[0]?.agentId??'';} data.agents = data.agents.filter(item => item.id !== id); data.missions = data.missions.filter(item => item.agentId !== id); data.memories = data.memories.filter(item => item.agentId !== id); data.automations = data.automations.filter(item => item.agentId !== id); }); },
  async saveMission(mission: AgentMission) { return mutate(data => { if (!data.agents.some(agent => agent.id === mission.agentId)) throw new Error("Agent introuvable."); const safe = structuredClone(mission); if (safe.checkpoint) { delete safe.checkpoint.toolResult; safe.checkpoint.calls = safe.checkpoint.calls?.map(call => ({ ...call, result: "[not retained]" })); } data.missions = [...data.missions.filter(item => item.id !== mission.id), safe]; }); },
  async learnNotebook(agentId: string, input: Parameters<typeof learnNotebook>[1]) { return mutate(data => { const agent=data.agents.find(a=>a.id===agentId); if(!agent?.memoryEnabled || data.memorySettings?.enabled===false)return; data.notebooks ??= {}; data.notebooks[agentId]=learnNotebook(data.notebooks[agentId],input); }); },
  async clearNotebook(agentId: string) { return mutate(data => { if(data.notebooks)delete data.notebooks[agentId]; }); },
  async observeInitiative(agentId: string, service: string, ids: string[]) { return mutate(data=>{const routine=data.notebooks?.[agentId]?.routines.find(r=>r.service===service);if(routine)routine.lastIds=ids;}); },
  async claimInitiative(agentId: string, service: string, at: string) { let claimed=false; await mutate(data=>{const routine=data.notebooks?.[agentId]?.routines.find(r=>r.service===service);if(!routine || routine.days.length<3 || Date.parse(at)-Date.parse(routine.lastRequestedAt)<86400000 || routine.lastAttemptAt && Date.parse(at)-Date.parse(routine.lastAttemptAt)<86400000)return; routine.lastAttemptAt=at;claimed=true;});return claimed; },
  async saveMemory(memory: AgentMemory) { return mutate(data => { data.memories = [...data.memories.filter(item => item.id !== memory.id), structuredClone(memory)]; }); },
  async saveMemorySettings(settings: { enabled: boolean; cloud: boolean }) { return mutate(data => { data.memorySettings = settings; }); },
  async deleteMemory(id: string) { return mutate(data => { data.memories = data.memories.filter(item => item.id !== id); }); },
  async saveAutomation(automation: AgentAutomation) { return mutate(data => { if (!data.agents.some(agent => agent.id === automation.agentId)) throw new Error("Agent introuvable."); data.automations = [...data.automations.filter(item => item.id !== automation.id), structuredClone(automation)]; }); },
  async completeAutomationCheck(id:string,mission:AgentMission,at=new Date().toISOString()){
    let outcome:{notify:boolean;error?:string}|undefined;
    await mutate(data=>{const current=data.automations.find(item=>item.id===id&&item.agentId===mission.agentId&&item.lastResult===`Mission ${mission.id} démarrée.`);if(!current)return;
      const checked=watchOutcome(current,mission,at);Object.assign(current,checked.update);outcome={notify:checked.notify,error:checked.error};
      current.lastResult=mission.status==="completed"?(checked.error??(current.notifyOn==="changes"?checked.notify?"Changement détecté ; résultat dans les missions.":"Sources contrôlées ; aucun nouveau changement à signaler.":`Terminée · mission ${mission.id}`)):`${mission.status} · ${mission.error??mission.result??"voir la mission"}`;current.updatedAt=at;
    });return outcome;
  },
  async updateAutomationOutcome(id: string, missionId: string, result: string) { return mutate(data => { const current = data.automations.find(item => item.id === id && item.lastResult === `Mission ${missionId} démarrée.`); if (current) { current.lastResult = result; current.updatedAt = new Date().toISOString(); } }); },
  async updateAutomationOccurrence(id: string, expected: string, update: (current: AgentAutomation) => AgentAutomation) { let changed: AgentAutomation | undefined; await mutate(data => { const index = data.automations.findIndex(item => item.id === id && item.nextRunAt === expected); if (index < 0) return; changed = update(structuredClone(data.automations[index])); data.automations[index] = changed; }); return changed; },
  async deleteAutomation(id: string) { return mutate(data => { data.automations = data.automations.filter(item => item.id !== id); }); },
};

export function recallMemories(data: AgentData, agentId: string, query: string, limit = 5): AgentMemory[] {
  const terms = [...new Set(query.toLocaleLowerCase("fr").match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
  return data.memories.filter(item => item.status === "current" && item.confirmed && (item.scope === "user" || item.agentId === agentId))
    .map(item => ({ item, matches: terms.reduce((count, term) => count + (item.content.toLocaleLowerCase("fr").includes(term) ? 1 : 0), 0), score: terms.reduce((count, term) => count + (item.content.toLocaleLowerCase("fr").includes(term) ? 1 : 0), 0) + (item.confirmed ? 0.2 : 0) }))
    .filter(entry => entry.matches > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, limit).map(entry => entry.item);
}
export function recallMissionHistory(data: AgentData, agentId: string, limit = 3): AgentMission[] {
  return data.missions.filter(item => item.agentId === agentId && ["completed", "paused"].includes(item.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
