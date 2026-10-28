import {useEffect,useRef,useState} from 'react';
import {MarkdownMessage} from '../ui/markdown-message';
import {messageBubbles} from '../../services/messagePresentation';
/** Reveal received text in order. This never invents model/tool progress. */
export function ProgressiveAnswer({text,streaming,animate,onSettled}:{animate?:boolean;text:string;streaming?:boolean;onSettled?:(ready:boolean)=>void}){
 const parts=messageBubbles(text);const initial=useRef(streaming||animate);const[count,setCount]=useState(initial.current?1:parts.length);const ready=!streaming&&count>=parts.length;
 useEffect(()=>{onSettled?.(ready);},[ready,onSettled]);
 useEffect(()=>{if(count>=parts.length)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const timer=setTimeout(()=>setCount(n=>n+1),reduced?0:Math.min(1200,Math.max(380,(parts[count-1]?.length??0)*11)));return()=>clearTimeout(timer);},[count,parts.length,text]);
 return <>{parts.slice(0,count).map((part,i)=><div key={i} className="atlas-message-bubble"><MarkdownMessage content={part} streaming={streaming&&i===count-1}/></div>)}</>;
}
