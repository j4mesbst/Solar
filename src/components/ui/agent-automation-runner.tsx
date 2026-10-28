import { useEffect, useState, useRef } from "react";
import type { Model, Provider } from "../../domain/types.ts";
import { delegatedReadAllowed, claimAutomation, detectMissedAutomations, dueAutomations, markAutomationResult } from "../../services/agentScheduler.ts";
import { solarAgentStore, type AgentMission } from "../../services/solarAgentStore.ts";

let automationTickInProgress = false;
let automationTickPending=false;
export function AgentAutomationRunner({ providers, models, onReview,agentIds,modelOverride }: { providers: Provider[]; models: Model[]; onReview:()=>void;agentIds?:string[];modelOverride?:{providerId:string;modelId:string} }) {
  const scope=useRef({agentIds,modelOverride});scope.current={agentIds,modelOverride};
  const [notice,setNotice]=useState(""); const notified=useRef(new Set<string>());
  useEffect(() => {
    let active = true; let running: AbortController | undefined;
    const tick = async () => {
      if(!active)return;if(automationTickInProgress){automationTickPending=true;return;}automationTickInProgress=true;
      try {
        await detectMissedAutomations();
        for(const item of (await solarAgentStore.snapshot()).automations.filter(item=>item.enabled&&item.missed)){const key=`${item.id}:${item.nextRunAt}`;if(!notified.current.has(key)){notified.current.add(key);setNotice("Une automatisation manquée attend ton choix dans Atlas.");}}
        const due = await dueAutomations(new Date());
        for (const automation of due) {
          if(scope.current.agentIds&&!scope.current.agentIds.includes(automation.agentId))continue;
          if (!active) break;
          if (!await claimAutomation(automation)) { await markAutomationResult(automation, "Occurrence déjà prise en charge ; consulter les missions."); continue; }
          const data = await solarAgentStore.snapshot();
          if(!data.automations.some(item=>item.id===automation.id&&item.nextRunAt===automation.nextRunAt&&item.enabled&&!item.missed)) continue;
          const storedAgent = data.agents.find(item => item.id === automation.agentId);
          const agent=storedAgent?{...storedAgent,...scope.current.modelOverride}:undefined;
          if (!agent?.enabled) { await markAutomationResult(automation, "Agent désactivé."); continue; }
          const timestamp = new Date().toISOString();
          const mission: AgentMission = { id: crypto.randomUUID(), agentId: agent.id, workspaceId:automation.workspaceId,kind:automation.kind,goal: automation.instruction, status: "queued", createdAt: timestamp, updatedAt: timestamp, events: [] };
          // Claim this occurrence before any model request. A crash cannot silently
          // reissue the same external reads on the next launch.
          await solarAgentStore.saveMission(mission);
          if (!await markAutomationResult(automation, `Mission ${mission.id} démarrée.`)) continue;
          const { runAgentMission } = await import("../../services/solarAgentRuntime.ts");
          running=new AbortController();
          const {savedConnection}=await import('../../services/pluginAccounts');
          const accounts=Object.fromEntries(await Promise.all((automation.readConsent?.services??[]).map(async id=>[id,(await savedConnection(id as import('../../services/pluginCatalog').PluginId))?.id??''])));
          const workspace=data.workspaces?.find(w=>w.id===automation.workspaceId&&w.agentId===agent.id);
          const delegated=delegatedReadAllowed(automation,agent,accounts,workspace?{name:workspace.name,resources:workspace.resources}:[]);
          const result = await runAgentMission({ mission, agent, providers, models,timezone:automation.timezone,unchangedDigest:automation.notifyOn==="changes"?automation.lastEvidenceDigest:undefined,authorizedBackgroundRead:delegated,readOnlyTools:automation.kind!==undefined,serviceScope:delegated?automation.readConsent!.services:undefined, background: automation.interactiveOnce !== true, signal: running.signal });
          const checked=await solarAgentStore.completeAutomationCheck(automation.id,result);
          if(active&&checked?.notify)setNotice(result.status === "completed"&&!checked.error ? "Une automatisation a un résultat à consulter dans les missions d’Atlas." : "Une automatisation demande ton attention dans les missions d’Atlas.");
        }
      if(active){running=new AbortController();const {tickTeamManager}=await import('../../services/teamManager');await tickTeamManager(providers,models,running.signal);}
      window.dispatchEvent(new CustomEvent("solar-automations-changed",{detail:{origin:"runner"}}));
      } catch (error) { console.error("Solar Agent automation", error instanceof Error ? error.message : "échec"); }
      finally { automationTickInProgress = false;if(automationTickPending){automationTickPending=false;queueMicrotask(()=>window.dispatchEvent(new Event("solar-automations-changed")));} }
    };
    const changed=(event:Event)=>{if((event as CustomEvent).detail?.origin!=="runner")void tick();};
    void tick(); window.addEventListener("solar-automations-changed",changed); const timer = window.setInterval(() => void tick(), 60_000);
    return () => { active = false; running?.abort(); window.removeEventListener("solar-automations-changed",changed); window.clearInterval(timer); };
  }, [providers, models]);
  return notice ? <div className="automation-notice" role="status"><span>{notice}</span><button onClick={()=>{setNotice("");onReview();}}>Voir Atlas</button><button aria-label="Masquer la notification" onClick={()=>setNotice("")}>Fermer</button></div> : null;
}
