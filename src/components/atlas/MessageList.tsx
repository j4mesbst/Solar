import {ProgressiveAnswer} from './ProgressiveAnswer';
import {ConversationQuestion} from '../team/ConversationQuestion';
import {AgentMascot} from '../team/AgentMascot';
import AnimatedShinyText from '../ui/animated-text-01';
import {readableMissionText} from '../../services/initiativeReport';
import {messageBubbles,playMessageSound,unlockMessageSound} from '../../services/messagePresentation';
import type {ActivityPhase} from './activityPresentation';
import {ConnectionRequest} from '../team/ConnectionRequest';
import {ResultCards} from "../team/ResultCards";
import { ContextReport, CompactingContext } from "../ui/context-report";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { MarkdownMessage } from "../ui/markdown-message";
import { PastedContents } from "../ui/pasted-content";
import type { AtlasMessage, AtlasStatus } from "./types";
import { ToolActivity } from "./ToolActivity";
import type { AtlasActivity } from "./connectors";
export function MessageList({ mascot,agentName,onChoice,disabled,messages, status, stamp, children, toolActivity,toolActivityPhase,toolActivityTool,responseDisplay="standard",responseSound=false }: {mascot?:import("../../services/solarAgentStore").MascotId;agentName?:string;onChoice?:(messageId:string,optionId:string)=>void;disabled?:boolean;responseDisplay?:"standard"|"messages";responseSound?:boolean; messages: AtlasMessage[]; status: AtlasStatus; stamp?: string; children?: ReactNode; toolActivity?:AtlasActivity;toolActivityPhase?:ActivityPhase;toolActivityTool?:string }) {
  const root = useRef<HTMLDivElement>(null), follow = useRef(true);
  const [settled,setSettled]=useState<Record<string,boolean>>({});
  const received=useRef(new Set<string>()),initialized=useRef(false);
  useEffect(()=>{const unlock=()=>{if(responseDisplay==='messages'&&responseSound)unlockMessageSound();};window.addEventListener('pointerdown',unlock,{passive:true});window.addEventListener('keydown',unlock);return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};},[responseDisplay,responseSound]);
  useEffect(()=>{const completed=messages.filter(m=>m.role==='atlas'&&!m.streaming&&!m.error&&m.text);if(!initialized.current){if(messages.length){for(const m of completed)received.current.add(m.id);initialized.current=true;}return;}const fresh=completed.filter(m=>!received.current.has(m.id));for(const m of fresh)received.current.add(m.id);if(fresh.length&&responseDisplay==='messages'&&responseSound)playMessageSound();},[messages,responseDisplay,responseSound]);

  useEffect(() => { const node = root.current; if (node && follow.current) node.scrollTop = node.scrollHeight; }, [messages, status, toolActivity]);
  useEffect(()=>{const node=root.current;if(!node)return;const resize=new ResizeObserver(()=>{if(follow.current&&node.clientHeight>0)node.scrollTop=node.scrollHeight;});resize.observe(node);if(node.firstElementChild)resize.observe(node.firstElementChild);return()=>resize.disconnect();},[]);
  const liveIds=useRef(new Set<string>());for(const m of messages)if(m.streaming)liveIds.current.add(m.id);
  const busy = status !== "idle";
  const waitingLabel=useWaitingLabel(busy&&!toolActivity);
  const streamingText = messages.some(message=>message.role==="atlas"&&message.streaming&&message.text.trim());
  return <div className={`atlas-message-viewport response-display-${responseDisplay}`} ref={root} onScroll={event => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100; }}><div className="atlas-messages">
    {stamp && <div className="atlas-stamp">{stamp}</div>}
    {messages.map((message, index) => { const me = message.role === "user", previous = messages[index - 1], next = messages[index + 1]; return <div key={message.id} className="atlas-row atlas-message-row" data-role={me ? "user" : "atlas"} data-tail={!next || next.role !== message.role} style={{ marginTop: !previous ? 0 : previous.role === message.role ? 3 : 12 }}>
      {(message.text || message.attachments?.length) && (me?<div className="atlas-message-bubble">{message.text}{message.attachments?.length?<PastedContents items={message.attachments}/>:null}</div>:message.localCommand==="context"&&message.contextReport?<ContextReport report={message.contextReport}/>:<div className="atlas-answer-parts">{responseDisplay==='messages'?<ProgressiveAnswer animate={liveIds.current.has(message.id)} text={readableMissionText(message.text)} streaming={message.streaming} onSettled={ready=>setSettled(prev=>prev[message.id]===ready?prev:{...prev,[message.id]:ready})}/>:<div className="atlas-message-bubble"><MarkdownMessage content={readableMissionText(message.text)} streaming={message.streaming}/></div>}</div>)}
      {!me&&message.resultCards?.length&&(!message.streaming&&(!message.text.trim()||!liveIds.current.has(message.id)||settled[message.id]===true))?<ResultCards cards={message.resultCards}/>:null}
      {message.question&&(!message.streaming&&(!message.text.trim()||!liveIds.current.has(message.id)||settled[message.id]===true))&&<ConversationQuestion question={message.question} disabled={busy||disabled} onSelect={onChoice?id=>onChoice(message.id,id):undefined}/>}
      {message.connectionRequest&&<ConnectionRequest messageId={message.id} {...message.connectionRequest}/>}
      {message.compacting&&<CompactingContext/>}
      {message.error && message.error.trim()!==message.text.trim() && <small className="atlas-message-error" role="status">{readableMissionText(message.error)}</small>}
      {me && index === messages.length - 1 && <small className="atlas-delivery">{busy ? "Lu" : "Distribué"}</small>}
    </div>; })}
    {busy&&!streamingText&&messages.at(-2)?.role==='user'&&<div className="atlas-row atlas-message-row" data-role="atlas"><div className="atlas-message-bubble">Demande reçue.</div></div>}
    {toolActivity && busy ? <ToolActivity mascot={mascot} activity={toolActivity} phase={toolActivityPhase} tool={toolActivityTool}/> : busy && !streamingText && !messages.some(message=>message.compacting) && <div role="status" aria-label={status === "working" ? `${agentName??"Atlas"} utilise un outil` : `${agentName??"Atlas"} réfléchit`} className="atlas-typing conversation-activity"><AgentMascot kind={mascot} size={24} active busy/><AnimatedShinyText>{waitingLabel}</AnimatedShinyText></div>}
    {busy&&streamingText&&(!toolActivity||toolActivityPhase!=='working')&&<span className="sr-only" role="status">Réponse en cours</span>}
    {children}
  </div></div>;
}

// Neutral presentation while the real request is pending; never a simulated tool log.
const waitingLabels=['Réfléchit…','Prépare sa réponse…','Un instant…','Prend le temps de répondre…','Formule sa réponse…'];
function useWaitingLabel(enabled:boolean){
 const[index,setIndex]=useState(0);
 useEffect(()=>{setIndex(0);if(!enabled)return;let timer:ReturnType<typeof setTimeout>;let cancelled=false;const next=()=>{timer=setTimeout(()=>{if(cancelled)return;if(!document.hidden)setIndex(i=>(i+1+Math.floor(Math.random()*(waitingLabels.length-1)))%waitingLabels.length);next();},1100+Math.random()*1200);};next();return()=>{cancelled=true;clearTimeout(timer);};},[enabled]);
 return waitingLabels[index];
}
