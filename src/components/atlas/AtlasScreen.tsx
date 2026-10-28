import {conversationQuestionInstructions,firstAgentQuestion,parseAgentQuestion} from '../../services/agentQuestions';
import {runTeamMission} from '../../services/teamManager';
import {savedConnection} from '../../services/pluginAccounts';
import type {ContinuationSuggestion} from '../../services/continuationSuggestions';
import type {RoleSuggestion} from '../../services/teamSuggestions';
import {agentResultCards,resultCardContext} from "../../services/agentResultCards";
import { useToolActivity } from "./useToolActivity";
import {AgentWorkspaces} from "../ui/agent-workspaces";
import {SOLAR_CLOUD_BUSY_MESSAGE} from "../../services/solarCloud";
import { AtlasSuggestions } from "./AtlasSuggestions";
import { preloadAtlasSuggestions, type AtlasSuggestion } from "../../services/atlasSuggestions";
import { dueRoutine } from "../../services/agentNotebook";
import { AgentNotebookPanel } from "../ui/agent-notebook-panel";
import { conversationHistoryForContext } from "../../services/conversationContext";
import { contextCommand, runContextCommand } from "../../services/contextCommands";
import { SharedMemoryPanel } from "../ui/shared-memory-panel";
import { AtlasAutomations } from "../ui/atlas-automations";
import { pluginCatalog } from "../../services/pluginCatalog";
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AppSettings, Conversation, Effort, Message, Model, PastedContent, Provider } from "../../domain/types";
import { AtlasChat } from "./AtlasChat";
import type { AtlasStatus } from "./types";
import { solarAgentStore, type AgentMission, type SolarAgent } from "../../services/solarAgentStore";
import { AtlasSelect } from "./AtlasSelect";
import type { AgentAccessMode } from "../../domain/types";
import { runAgentMission } from "../../services/solarAgentRuntime";
import { solarStore } from "../../services/store";
import { useDraft } from "../../hooks/useDraft";
import { fileAttachment } from "../../services/fileAttachment";
import { draftMessage } from "../../services/pastedContent";
import { modelLabel } from "../../services/aiLabels";
import { Button } from "../ui/button";
import { contrastText, validColor } from "../../services/appearance";
const LegacyAgents = lazy(() => import("../ui/solar-agent-page").then(module => ({ default: module.SolarAgentPage })));
const now = () => new Date().toISOString();
export function AtlasScreen({ active=true,teamIdentity,header,emptyContent,suggestionsContent,continuationContent,onBusyChange,cancelRef,conversationId,onConversationChange,providers, models, settings, theme, onBack, onPlugins, onSettings }: { active?:boolean;teamIdentity?:{mascot?:import("../../services/solarAgentStore").MascotId;agent:SolarAgent;agentId:string;conversationId:string;name:string;needsRole?:boolean;onRoleDefined:(role:string)=>Promise<void>};header?:ReactNode;emptyContent?:ReactNode;suggestionsContent?:ReactNode;continuationContent?:ReactNode;onBusyChange?:(busy:boolean)=>void;cancelRef?:React.MutableRefObject<((id?:string)=>void)|null>;conversationId?:string;onConversationChange?:(id:string)=>void;providers: Provider[]; models: Model[]; settings: AppSettings; theme: "light" | "dark"; onBack: () => void; onPlugins: () => void; onSettings: () => void }) {
  const toolActivity=useToolActivity();
  const [settingsCloseSignal,setSettingsCloseSignal]=useState(0);
  const [suggestions,setSuggestions]=useState<AtlasSuggestion[]>([]);
  // Per launch and conversation, not per render/focus/response. Visited agents
  // stay mounted, so switching away and back cannot reinsert a proposal.
  const [suggestionsUsed,setSuggestionsUsed]=useState(()=>new Set<string>());
  const consumeSuggestions=(id:string)=>setSuggestionsUsed(old=>old.has(id)?old:new Set(old).add(id));
  const [atlas, setAtlas] = useState<{ agentId: string; conversationId: string }>();
  const [agent, setAgent] = useState<SolarAgent>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AtlasStatus>("idle"), [error, setError] = useState("");
  const [mission, setMission] = useState<AgentMission>(), [completed, setCompleted] = useState(0);
  const [importing, setImporting] = useState(false), [archives, setArchives] = useState(false);
  useEffect(()=>{onBusyChange?.(status!=="idle");},[status]);
  const running = useRef<AbortController>(), locked = useRef(false), importLock = useRef(false);
  const mounted = useRef(false),activeConversation=useRef<string>();
  const usable = models.filter(model => model.enabled && model.available !== false && providers.some(provider => provider.id === model.providerId && provider.enabled));
  const palette = settings.appearance?.[theme];
  const accent = palette?.accent && validColor(palette.accent) ? palette.accent : undefined;
  const bubble = palette?.userBubble && validColor(palette.userBubble) ? palette.userBubble : undefined;
  const appearance = { "--atlas-slack-logo":theme==='dark'?'brightness(0) invert(1)':'none', "--atlas-monochrome-logo":theme==='dark'?'invert(1)':'none', ...(accent ? { "--atlas-blue": accent, "--atlas-on-blue": contrastText(accent) } : {}), ...(bubble ? { "--atlas-user-bubble": bubble, "--atlas-user-text": contrastText(bubble) } : {}) } as CSSProperties;
  const { draft, ready, update, appendAttachments, clearSent, flush, error: draftError } = useDraft(atlas?.conversationId ?? "atlas:initializing");
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;running.current?.abort();};},[]);
  useEffect(() => {
    if(conversationId&&activeConversation.current===conversationId)return;
    let live=true;running.current?.abort();running.current=undefined;locked.current=false;
    toolActivity.reset();setAtlas(undefined);setMessages([]);setStatus("idle");setError("");setCompleted(0);setSuggestions([]);setMission(undefined);
    const fallback = usable.find(model => model.id === (settings.agent?.defaultModelId??settings.defaultModelId)) ?? usable[0];
    void (async () => {
      const value = teamIdentity?{agentId:teamIdentity.agentId,conversationId:teamIdentity.conversationId}:await solarAgentStore.ensureAtlas({ modelId: fallback?.id ?? "", providerId: fallback?.providerId ?? "", effort: settings.agent?.defaultEffort??"medium" });
      if(conversationId){if(!teamIdentity)await solarAgentStore.selectAtlasConversation(conversationId);value.conversationId=conversationId;}
      const data = await solarAgentStore.snapshot();let history = await solarStore.listMessages(value.conversationId);
      if(teamIdentity?.needsRole&&!history.length){
        const at=now(),firstName=settings.profile?.name?.trim().split(/\s+/)[0];
        const intro:Message={id:`intro:${value.conversationId}`,conversationId:value.conversationId,role:'assistant',content:`Bonjour${firstName?' '+firstName:''} ! Moi, c’est ${teamIdentity.name}. Je peux t’aider au travail comme au quotidien.`,question:firstAgentQuestion(),status:'completed',createdAt:at,order:0};
        await solarStore.saveConversation({id:value.conversationId,space:'agent',title:teamIdentity.name,effort:teamIdentity.agent.effort,providerId:teamIdentity.agent.providerId,modelId:teamIdentity.agent.modelId,createdAt:at,updatedAt:at});
        await solarStore.saveMessage(intro);history=[intro];
      }
      if (!mounted.current||!live) return;
      const stored=data.agents.find(item=>item.id===value.agentId);
      const configured=stored?{...stored,...(teamIdentity&&fallback?{modelId:fallback.id,providerId:fallback.providerId}:{}),...(!teamIdentity&&settings.agent?.defaultModelId&&fallback?{modelId:fallback.id,providerId:fallback.providerId}:{}),...(!teamIdentity&&settings.agent?.defaultEffort?{effort:settings.agent.defaultEffort}:{})}:stored;
      if(!teamIdentity&&configured&&stored&&(configured.modelId!==stored.modelId||configured.effort!==stored.effort))await solarAgentStore.saveAgent(configured);
      if(!live||!mounted.current)return;activeConversation.current=value.conversationId;setAtlas(value); setAgent(configured); setMessages(history);if(!teamIdentity)onConversationChange?.(value.conversationId);
    })().catch(reason => { if (mounted.current&&live) setError(reason instanceof Error ? reason.message : "Impossible de restaurer Atlas."); });
    return () => { live=false; };
  }, [conversationId]);
  useEffect(()=>{if(teamIdentity||!atlas||messages.length)return;let live=true;const refresh=()=>void preloadAtlasSuggestions(atlas.conversationId).then(items=>{if(live)setSuggestions(items);}).catch(()=>{if(live)setSuggestions([]);});refresh();window.addEventListener("solar-plugins-changed",refresh);return()=>{live=false;window.removeEventListener("solar-plugins-changed",refresh);};},[atlas?.conversationId,messages.length]);
  useEffect(()=>{if(!cancelRef)return;cancelRef.current=id=>{if(!id||id===atlas?.conversationId)running.current?.abort();};return()=>{cancelRef.current=null;};},[atlas?.conversationId,cancelRef]);
  useEffect(()=>{if(!teamIdentity)return;const model=usable[0];setAgent({...teamIdentity.agent,...(model?{modelId:model.id,providerId:model.providerId}:{})});},[teamIdentity?.agent.updatedAt,usable[0]?.id]);
  useEffect(()=>{if(!teamIdentity)return;const fill=(event:Event)=>{const value=(event as CustomEvent).detail;if(value?.agentId===teamIdentity.agentId&&typeof value.text==='string'){if(value.autoSend)sendAction.current(value.text,value.connectionMessageId);else update({text:value.text});}};window.addEventListener('solar-team-import-prompt',fill);return()=>window.removeEventListener('solar-team-import-prompt',fill);},[teamIdentity?.agentId,update]);
  const suggestionAction=useRef<(suggestion:RoleSuggestion|ContinuationSuggestion)=>void>(()=>{});
  useEffect(()=>{if(!teamIdentity)return;const select=(e:Event)=>{const value=(e as CustomEvent).detail;if(value?.agentId===teamIdentity.agentId)suggestionAction.current(value.suggestion);};window.addEventListener('solar-team-suggestion',select);return()=>window.removeEventListener('solar-team-suggestion',select);},[teamIdentity?.agentId]);
  suggestionAction.current=async suggestion=>{
    if(!atlas||!agent||locked.current||!suggestion||(suggestion.service!==undefined&&!pluginCatalog.some(p=>p.id===suggestion.service))||typeof suggestion.text!=='string')return;
    consumeSuggestions(atlas.conversationId);
    locked.current=true;
    try{
      if(!suggestion.service||await savedConnection(suggestion.service)){locked.current=false;sendAction.current(suggestion.text);return;}
      const info=pluginCatalog.find(p=>p.id===suggestion.service)!;const at=now();
      const user:Message={id:crypto.randomUUID(),conversationId:atlas.conversationId,role:'user',content:suggestion.text,status:'completed',createdAt:at,order:messages.length};
      const answer:Message={id:crypto.randomUUID(),conversationId:atlas.conversationId,role:'assistant',content:`J’ai besoin de ${info.name} pour cette demande.`,connectionRequest:{service:suggestion.service,prompt:suggestion.text,agentId:agent.id},status:'completed',createdAt:at,order:messages.length+1};
      const conversation:Conversation={id:atlas.conversationId,space:'agent',title:suggestion.text.slice(0,70),providerId:agent.providerId,modelId:agent.modelId,effort:agent.effort,createdAt:messages[0]?.createdAt??at,updatedAt:at};
      await solarStore.saveTurn(conversation,user,answer);if(mounted.current){setMessages([...messages,user,answer]);onConversationChange?.(atlas.conversationId);}
    }catch{if(mounted.current)setError('Impossible de préparer la connexion. Réessaie.');}finally{locked.current=false;}
  };
  useEffect(()=>{const refresh=()=>{const conversation=activeConversation.current;if(!conversation||locked.current)return;void solarStore.listMessages(conversation).then(history=>{if(mounted.current&&!locked.current&&activeConversation.current===conversation)setMessages(history);}).catch(()=>{});};window.addEventListener('solar-team-missions-updated',refresh);return()=>window.removeEventListener('solar-team-missions-updated',refresh);},[]);
  const sendAction=useRef<(text:string,resumeId?:string)=>void>(()=>{});
  const configure = async (patch: Partial<SolarAgent>) => {
    if (!agent) return;
    const next = { ...agent, ...patch, updatedAt: now() };
    try { await solarAgentStore.saveAgent(next); if (mounted.current) setAgent(next); }
    catch { if (mounted.current) setError("Impossible d’enregistrer les réglages d’Atlas."); }
  };
  // Returning to an existing conversation offers a choice, never pretends to have
  // worked during the absence and never runs a provider until a choice is made.
  const absence=useRef<number>(),returnLock=useRef(false);
  const returnState=useRef({active,status,messages,atlas,ready,draft,archives});
  returnState.current={active,status,messages,atlas,ready,draft,archives};
  useEffect(()=>{
    if(!teamIdentity)return;
    const check=async()=>{
      const state=returnState.current,visible=state.active&&!document.hidden;
      if(!visible){absence.current??=Date.now();return;}
      const since=absence.current;absence.current=undefined;
      if(!since||Date.now()-since<15*60_000||returnLock.current||locked.current||state.status!=='idle'||!state.ready||!state.atlas||state.archives||state.draft.text.trim()||state.draft.attachments.length)return;
      if(state.messages.some(m=>m.question&&!m.question.selectedId&&!m.question.dismissed))return;
      const last=state.messages.filter(m=>m.role==='user'&&!m.questionAnswer&&!m.connectionAnswer).at(-1);
      const subject=(last?.displayText??last?.content??'').trim();
      if(!subject||subject.startsWith('/'))return;
      returnLock.current=true;
      try{
        const message:Message={id:crypto.randomUUID(),conversationId:state.atlas.conversationId,role:'assistant',content:'',status:'completed',createdAt:now(),order:Math.max(0,...state.messages.map(m=>m.order))+1,question:{title:'On reprend où nous en étions ?',options:[
          {id:'a',label:'Reprendre la dernière demande',prompt:`Reprenons ma dernière demande : ${subject.slice(0,1500)}. Appuie-toi sur les résultats déjà présents ; ne prétends pas avoir travaillé pendant mon absence.`},
          {id:'b',label:'Faire le point sur le résultat',prompt:`Fais un point très court sur le résultat déjà obtenu pour ma demande : ${subject.slice(0,1500)}. Distingue ce qui est fait et ce qui reste ouvert.`},
          {id:'c',label:'Choisir une nouvelle priorité',prompt:'Je veux changer de priorité. Demande-moi en une phrase ce que je veux faire maintenant.'},
        ]}};
        await solarStore.saveMessage(message);
        if(mounted.current&&activeConversation.current===message.conversationId)setMessages(old=>[...old,message]);
      }catch{ /* Optional return question must not interrupt the conversation. */ }
      finally{returnLock.current=false;}
    };
    void check();document.addEventListener('visibilitychange',check);
    return()=>document.removeEventListener('visibilitychange',check);
  },[active,teamIdentity?.conversationId]);
  const addAttachments = async (files: File[]) => {
    if (!atlas || importLock.current) return;
    importLock.current = true; setImporting(true); setError("");
    try {
      if (draft.attachments.length + files.length > 10) throw new Error("Ajoute au maximum dix fichiers de contexte.");
      const attachments: PastedContent[] = [];
      for (const file of files) attachments.push(await fileAttachment(file));
      if (attachments.reduce((total, item) => total + item.content.length, 0) > 1_500_000) throw new Error("Le contexte est trop volumineux. Importe des extraits.");
      if (mounted.current) appendAttachments(attachments);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Fichier illisible."); }
    finally { importLock.current = false; if (mounted.current) setImporting(false); }
  };
  const attachRef = useRef(addAttachments); attachRef.current = addAttachments;
  useEffect(() => {
    if (!active || !atlas || archives || !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return;
    let disposed = false, unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      const off = await getCurrentWebview().onDragDropEvent(event => {
        if (event.payload.type !== "drop" || disposed) return;
        const paths = event.payload.paths;
        void (async () => {
          const { invoke } = await import("@tauri-apps/api/core");
          if (paths.length > 10) throw new Error("Ajoute au maximum dix fichiers de contexte.");
          const files: File[] = [];
          for (const path of paths) {
            const value = await invoke<{ name: string; bytes: number[] }>("attachment_read", { path });
            const extension = value.name.split(".").at(-1)?.toLowerCase();
            const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" } as Record<string, string>)[extension ?? ""] ?? "";
            files.push(new File([new Uint8Array(value.bytes)], value.name, { type: mime }));
          }
          if (!disposed) await attachRef.current(files);
        })().catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : String(reason)); });
      });
      if (disposed) off(); else unlisten = off;
    }).catch(() => { if (!disposed) setError("Le dépôt natif est indisponible. Utilise le sélecteur de fichiers."); });
    return () => { disposed = true; unlisten?.(); };
  }, [atlas?.conversationId, archives,active]);
  const send = async (prefill?:string,choice?:{messageId:string;optionId:string},resumeId?:string) => {
    if (!atlas || !agent || !ready || locked.current || importLock.current || !((prefill??draft.text).trim() || draft.attachments.length)) return;
    const resumeSource=resumeId?messages.find(m=>m.id===resumeId):undefined;
    if(resumeId&&(!resumeSource?.connectionRequest||resumeSource.connectionRequest.resumedAt||prefill!==resumeSource.connectionRequest.prompt||!await savedConnection(resumeSource.connectionRequest.service)))return;
    if(locked.current)return;
    const questionSource=choice?messages.find(m=>m.id===choice.messageId):undefined;
    const option=questionSource?.question?.options.find(o=>o.id===choice?.optionId);
    if(choice&&(!option||questionSource?.question?.selectedId||questionSource?.question?.dismissed||prefill!==option.prompt))return;
    consumeSuggestions(atlas.conversationId);
    const model = usable.find(model => model.id === agent.modelId), provider = providers.find(provider => provider.id === model?.providerId);
    if (!model || !provider) { setError(teamIdentity?"Le modèle sélectionné est indisponible. Vérifie Modèles dans les réglages.":"Choisis un modèle disponible dans les réglages d’Atlas."); return; }
    const snapshot = structuredClone({...draft,text:prefill??draft.text,...(choice||resumeId?{attachments:[]}: {})}), snapshotAgent = structuredClone(agent);
    if (snapshot.attachments.some(item => item.kind === "image") && !model.capabilities.includes("vision")) { setError(teamIdentity?"Ce modèle ne peut pas traiter cette image. Joins un document texte.":"Ce modèle ne déclare pas de capacité vision. Choisis un modèle vision ou retire les images."); return; }
    locked.current = true; const controller = new AbortController(); running.current = controller;
    const isCurrent=()=>mounted.current&&activeConversation.current===atlas.conversationId&&running.current===controller;
    toolActivity.reset();setError(""); setStatus("thinking");
    const timestamp = now();
    const user: Message = { ...(choice?{questionAnswer:choice}:{}),...(resumeId?{connectionAnswer:{messageId:resumeId}}:{}),id: crypto.randomUUID(), conversationId: atlas.conversationId, role: "user", content: draftMessage(snapshot), displayText: snapshot.text, attachments: snapshot.attachments, status: "completed", createdAt: timestamp, order: messages.length };
    let assistant: Message = { id: crypto.randomUUID(), conversationId: atlas.conversationId, role: "assistant", content: "", status: "streaming", createdAt: timestamp, order: user.order + 1 };
    const answeredMessages=messages.map(m=>m.id===resumeId&&m.connectionRequest?{...m,connectionRequest:{...m.connectionRequest,resumedAt:timestamp}}:m.question?{...m,question:{...m.question,...(m.id===choice?.messageId?{selectedId:choice.optionId}:{dismissed:true})}}:m);
    const history = [...answeredMessages, user]; let submitted = false;
    let responseSave = Promise.resolve();
    try {
      const conversation: Conversation = { id: atlas.conversationId, space: "agent", title: messages.length?((await solarStore.listConversations()).find(c=>c.id===atlas.conversationId)?.title??"Atlas"):(snapshot.text.trim().slice(0,70)||"Documents joints"), providerId: provider.id, modelId: model.id, effort: snapshotAgent.effort, createdAt: messages[0]?.createdAt ?? timestamp, updatedAt: timestamp };
      await solarStore.saveTurn(conversation, user, assistant); submitted = true;if(isCurrent())onConversationChange?.(atlas.conversationId);
      if(!choice&&!resumeId)await clearSent(atlas.conversationId, snapshot);
      if (isCurrent()) setMessages([...history, assistant]);
      const command=contextCommand(snapshot.text,snapshot.attachments.length);
      if(command){
        user.localCommand=command;assistant={...assistant,localCommand:command};await solarStore.saveMessage(user);
        const result=await runContextCommand(command,{conversationId:atlas.conversationId,messages,model,provider,effort:snapshotAgent.effort,signal:controller.signal,onCompacting:active=>{assistant={...assistant,compacting:active};if(isCurrent())setMessages([...history,assistant]);}});
        assistant={...assistant,content:result.content,contextReport:result.report,status:"completed"};return;
      }
      if(teamIdentity?.needsRole&&snapshot.text.trim()&&!snapshot.text.trim().startsWith('/')){
        await teamIdentity.onRoleDefined(snapshot.text.trim());
        snapshotAgent.instructions=snapshot.text.trim()+"\nRéponds naturellement et brièvement. Respecte les permissions effectives et vérifie les résultats.";
        setAgent({...agent,instructions:snapshotAgent.instructions});
      }
      if(teamIdentity){snapshotAgent.instructions+=`\nDans cette conversation, ton nom est ${JSON.stringify(teamIdentity.name)}.`+conversationQuestionInstructions;
        if(option?.service&&!await savedConnection(option.service)){
          const info=pluginCatalog.find(p=>p.id===option.service)!;
          assistant={...assistant,content:`Connecte ${info.name} ici, et je pourrai t’aider à partir de tes données.`,status:'completed',connectionRequest:{service:option.service,prompt:option.prompt,agentId:agent.id}};
          return;
        }
      }
      const goal = snapshot.text.trim() || "Effectue la tâche décrite dans les fichiers joints.";
      const task: AgentMission = { id: crypto.randomUUID(), agentId: agent.id, requestText: goal, goal: draftMessage({ text: goal, attachments: snapshot.attachments }), status: "queued", createdAt: timestamp, updatedAt: timestamp, events: [] };
      let lastSaved = 0, lastRendered = 0;
      const result = await runTeamMission({ mission: task, agent: snapshotAgent, providers, models, signal: controller.signal, history:await conversationHistoryForContext(atlas.conversationId,history),onReferences:references=>{assistant={...assistant,toolReferences:references};},conversationId:atlas.conversationId,onCompacting:active=>{assistant={...assistant,compacting:active};if(isCurrent())setMessages([...history,assistant]);},onContext:report=>{assistant={...assistant,contextReport:report};},onMetrics:metrics=>{assistant={...assistant,metrics};}, attachments: snapshot.attachments,
        onToolEvent:event=>{if(isCurrent())toolActivity.observe(event);},onPhase: value => { if (isCurrent()) setStatus(value); }, onUpdate: value => { if (isCurrent()) setMission(value); },
        onReplace: text => { assistant={...assistant,content:text}; if(isCurrent())setMessages([...history,assistant]); },
        onDelta: chunk => {
          assistant = { ...assistant, content: assistant.content + chunk };
          if (isCurrent() && Date.now()-lastRendered>=32) { lastRendered=Date.now();setMessages([...history, assistant]); }
          if (Date.now() - lastSaved > 500) { lastSaved = Date.now(); const value = structuredClone(assistant); responseSave = responseSave.then(() => solarStore.saveMessage(value)); }
        },
      });
      if(teamIdentity&&result.checkpoint?.calls){const cards=agentResultCards(result.checkpoint.calls);if(cards.length){const visible=result.result??assistant.content;assistant={...assistant,resultCards:cards,displayText:visible,content:visible+resultCardContext(cards)};}}
      if(teamIdentity){const parsed=parseAgentQuestion(assistant.displayText??assistant.content);assistant={...assistant,displayText:parsed.text,...(result.question??parsed.question?{question:result.question??parsed.question}:{})};}
      assistant = { ...assistant,sources:result.sources, status: result.status === "completed"||result.status==="waiting" ? "completed" : controller.signal.aborted ? "interrupted" : "error", error: result.error };
      if (isCurrent()) { if (result.status === "completed") setCompleted(value => value + 1); else if(result.status!=="waiting")setError(""); }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Impossible d’envoyer le message.";
      assistant = { ...assistant, status: controller.signal.aborted ? "interrupted" : "error", compacting:false,error: message };
      // The saved reply already displays its error. Reserve the global banner
      // for attachment, setup and persistence failures, not a duplicate copy.
      if (isCurrent()) setError(submitted?"":message);
    } finally {
      try { await responseSave; if (submitted) {await solarStore.saveMessage(assistant);if(isCurrent())onConversationChange?.(atlas.conversationId);} }
      catch { if (isCurrent()) setError("La réponse reste visible, mais sa sauvegarde a échoué."); }
      if (isCurrent()) { if(controller.signal.aborted)toolActivity.reset();else toolActivity.finish();if (submitted) setMessages([...history, assistant]); setStatus("idle"); }
      if(running.current===controller){running.current = undefined; locked.current = false;}
    }
  };
  sendAction.current=(text,resumeId)=>void send(text,undefined,resumeId);
  const connectionResume=useRef<()=>void>(()=>{});
  connectionResume.current=()=>{const last=messages.at(-1);if(last?.connectionRequest&&!last.connectionRequest.resumedAt)void send(last.connectionRequest.prompt,undefined,last.id);};
  useEffect(()=>{const closed=(event:Event)=>{const service=(event as CustomEvent).detail?.service;const last=messages.at(-1);if(last?.connectionRequest?.service===service)connectionResume.current();};window.addEventListener('solar-team-connection-closed',closed);return()=>window.removeEventListener('solar-team-connection-closed',closed);},[messages]);
  const initiativeState=useRef({atlas,agent,messages,draft,ready,archives,settings,providers,models});
  initiativeState.current={atlas,agent,messages,draft,ready,archives,settings,providers,models};
  useEffect(()=>{
    let disposed=false;
    const check=async()=>{
      const state=initiativeState.current;
      if(teamIdentity||disposed||document.visibilityState!=="visible"||locked.current||importLock.current||!state.ready||state.archives||!state.atlas||!state.agent||state.agent.accessMode!=="full"||!state.agent.memoryEnabled||state.settings.agent?.proactive===false||state.draft.text.trim()||state.draft.attachments.length)return;
      const data=await solarAgentStore.snapshot();
      if(disposed||data.memorySettings?.enabled===false||locked.current||initiativeState.current.agent?.accessMode!=="full"||initiativeState.current.settings.agent?.proactive===false||initiativeState.current.draft.text.trim()||initiativeState.current.draft.attachments.length)return;
      const routine=dueRoutine(data.notebooks?.[state.agent.id]);if(!routine)return;
      const selected=state.models.find(m=>m.id===state.agent!.modelId&&m.enabled&&m.available!==false);
      const provider=state.providers.find(p=>p.id===selected?.providerId&&p.enabled);if(!selected||!provider)return;
      // Consent is the current Full mode. The additional executor constraint
      // restricts this initiative to read tools even if a model asks to write.
      locked.current=true;const controller=new AbortController();running.current=controller;
      let assistant:Message|undefined;
      try{
        if(!await solarAgentStore.claimInitiative(state.agent.id,routine.service,now()))return;
        if(disposed)return;
        toolActivity.reset();setStatus("thinking");setError("");
        const goal=`Résume mes ${routine.limit} derniers mails ${routine.service=== "gmail"?"Gmail":"Outlook"}. Initiative fondée sur une habitude observée sur ${routine.days.length} jours.`,timestamp=now();
        const task:AgentMission={id:crypto.randomUUID(),agentId:state.agent.id,origin:"initiative",goal,requestText:goal,status:"queued",createdAt:timestamp,updatedAt:timestamp,events:[]};
        // A request for the current mission enters model context, but is never
        // stored or displayed as a message written by the person.
        const request:Message={id:task.id,conversationId:state.atlas.conversationId,role:"user",content:goal,createdAt:timestamp,order:state.messages.length,status:"completed"};
        let references:NonNullable<Message["toolReferences"]>=[];
        const result=await runAgentMission({mission:task,agent:state.agent,providers:state.providers,models:state.models,signal:controller.signal,history:await conversationHistoryForContext(state.atlas.conversationId,[...state.messages,request]),conversationId:state.atlas.conversationId,readOnlyTools:true,onReferences:r=>{references=r;},onToolEvent:event=>{if(!disposed&&activeConversation.current===state.atlas!.conversationId&&running.current===controller)toolActivity.observe(event);},onUpdate:m=>{if(!disposed)setMission(m);},onPhase:p=>{if(!disposed)setStatus(p);}});
        if(result.status!=="completed")throw Error(result.error??"Cette initiative n’a pas abouti.");
        const ids=references.flatMap(r=>r.ids);if(!ids.length)throw Error("L’initiative n’a pas obtenu de résultat attesté.");await solarAgentStore.observeInitiative(state.agent.id,routine.service,ids);if(JSON.stringify(ids)===JSON.stringify(routine.lastIds))return;
        assistant={id:crypto.randomUUID(),conversationId:state.atlas.conversationId,role:"assistant",content:"Initiative d’Atlas · ta lecture habituelle des derniers mails.\n\n"+result.result,toolReferences:references,status:"completed",createdAt:timestamp,order:state.messages.length};
        await solarStore.saveMessage(assistant);if(!disposed){setMessages([...state.messages,assistant]);setCompleted(n=>n+1);}
      }catch(reason){if(!disposed&&!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Initiative interrompue.");}
      finally{locked.current=false;running.current=undefined;if(!disposed){if(controller.signal.aborted)toolActivity.reset();else toolActivity.finish();setStatus("idle");}}
    };
    const timer=window.setInterval(()=>void check().catch(()=>{}),60000);
    return()=>{disposed=true;window.clearInterval(timer);};
  },[]);
  const leave = async (callback: () => void) => { running.current?.abort(); await flush(); callback(); };
  const closeArchives = async () => {
    try { const data = await solarAgentStore.snapshot(); setAgent(data.agents.find(item => item.id === atlas?.agentId)); setArchives(false); }
    catch { setError("Impossible de restaurer les réglages d’Atlas."); setArchives(false); }
  };
  if (archives) return <div className="atlas-archives"><Button variant="ghost" onClick={() => void closeArchives()}>Retour à Atlas</Button><Suspense fallback={<p>Ouverture des anciennes missions…</p>}><LegacyAgents providers={providers} models={models} onConnect={onPlugins}/></Suspense></div>;
  return <AtlasChat stamp={messages[0]?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(messages[0].createdAt)):undefined} mascot={teamIdentity?.mascot} onChoice={(messageId,optionId)=>{const option=messages.find(m=>m.id===messageId)?.question?.options.find(o=>o.id===optionId);if(option)void send(option.prompt,{messageId,optionId});}} responseDisplay="messages" responseSound={settings.responseSound} header={header} agentName={teamIdentity?.name} directAttachments={!!teamIdentity} emptyContent={emptyContent} toolActivity={toolActivity.activity} toolActivityPhase={toolActivity.phase} toolActivityTool={toolActivity.tool} settingsCloseSignal={settingsCloseSignal} appearance={appearance} showMascot={settings.agent?.showMascot!==false} messages={messages.filter(message=>!message.questionAnswer&&!message.connectionAnswer&&!(message.generatedBy==='team-manager'&&message.role==='user')).map(message => ({ id: message.id, role: message.role === "user" ? "user" : "atlas", question:message.question,text:teamIdentity?parseAgentQuestion(message.displayText ?? message.content).text:message.displayText ?? message.content, streaming:message.status==="streaming", attachments: message.role === "user" ? message.attachments : undefined, error: message.error,connectionRequest:teamIdentity?message.connectionRequest:undefined,localCommand:message.localCommand,contextReport:message.contextReport,compacting:message.compacting,resultCards:teamIdentity?message.resultCards:undefined }))}
    status={status} draft={draft.text} onDraftChange={text => update({ text })} onSend={() => void send()} onStop={() => {running.current?.abort();toolActivity.reset();}} models={usable.map(model => ({ id: model.id, name: modelLabel(model), where: `${providers.find(provider => provider.id === model.providerId)?.protocol === "ollama" ? "Local" : "En ligne"} · ${providers.find(provider => provider.id === model.providerId)?.name}` }))}
    modelId={agent?.modelId ?? ""} onModelChange={id => { const model = usable.find(model => model.id === id); if (model) void configure({ modelId: id, providerId: model.providerId }); }} effort={agent?.effort ?? "medium"} onEffortChange={(effort: Effort) => void configure({ effort })}
    files={draft.attachments.map(item => ({ id: item.id, name: item.title }))} onAddFiles={files => void addAttachments(files)} onRemoveFile={id => update({ attachments: draft.attachments.filter(item => item.id !== id) })}
    initializing={!atlas || !ready} disabled={!atlas || !ready || !agent || !usable.some(model => model.id === agent.modelId)} importing={importing} error={error || draftError} completedRevision={completed} onBack={() => void leave(onBack)}
    suggestions={teamIdentity?undefined:(!suggestionsUsed.has(atlas?.conversationId??'')&&!draft.text.trim()&&!draft.attachments.length&&status==="idle"&&ready?(!messages.length?<AtlasSuggestions items={suggestions} disabled={locked.current||!ready||!agent||!usable.some(m=>m.id===agent.modelId)} onSelect={text=>void send(text)}/>:continuationContent):undefined)}
    settingsContent={<div className="atlas-additional-settings"><AtlasSelect label="Autorisations" value={agent?.accessMode??"standard"} options={[{id:"read-only",label:"Lecture seule",hint:"Consulter sans modifier"},{id:"standard",label:"Accès standard",hint:"Demander avant les actions sensibles"},{id:"full",label:"Accès complet",hint:"Agir sans demander de confirmation"}]} onChange={id=>void configure({accessMode:id as AgentAccessMode})}/><p className="atlas-access-description">{agent?.accessMode==="full"?"Atlas peut lire, modifier et transmettre les données des plugins connectés au modèle choisi sans te redemander. Les limites des services restent applicables.":agent?.accessMode==="read-only"?"Atlas peut consulter les plugins connectés. Toute modification est bloquée ; les transferts vers un modèle cloud demandent confirmation.":"Atlas consulte les plugins connectés et demande ton accord avant une modification ou un transfert vers un modèle cloud."}</p>
      {atlas&&<details><summary>Dossiers de travail</summary><AgentWorkspaces agentId={atlas.agentId} conversationId={atlas.conversationId} revision={completed} onRun={text=>{setSettingsCloseSignal(value=>value+1);void send(text);}}/></details>}{atlas&&<details><summary>Mémoire personnelle d’Atlas</summary><AgentNotebookPanel agentId={atlas.agentId} revision={completed}/></details>}<details><summary>Mémoire partagée</summary><SharedMemoryPanel/></details>{atlas && <details><summary>Automatisations</summary><AtlasAutomations agentId={atlas.agentId} conversationId={atlas.conversationId}/></details>}
      {!usable.length && <p>Configure un fournisseur ou télécharge un modèle dans Solar.</p>}
      <nav className="atlas-settings-links" aria-label="Réglages complémentaires"><Button variant="ghost" onClick={() => void leave(onPlugins)}>Gérer les plugins</Button><Button variant="ghost" onClick={() => void leave(onSettings)}>Paramètres de Solar</Button><Button variant="ghost" onClick={() => void leave(() => setArchives(true))}>Anciens agents et missions</Button></nav>
    </div>}
    />;
}
