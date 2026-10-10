import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { mountSolarSky, type SolarSky } from "../services/solarSky.js";
export function useSolarScene(id:string|undefined,theme:"light"|"dark") {
 const sceneRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),veilRef=useRef<HTMLDivElement>(null),composerRef=useRef<HTMLDivElement>(null);
 const engine=useRef<SolarSky>();const target=useRef(id);const from=useRef<number>();const [revealed,setRevealed]=useState(Boolean(id));const revealedRef=useRef(revealed);revealedRef.current=revealed;
 const [replyRevealed,setReplyRevealed]=useState(Boolean(id));
 const stopTimer=useRef<ReturnType<typeof setTimeout>>();
 const flip=()=>{from.current=composerRef.current?.getBoundingClientRect().top;setRevealed(true);};
 useEffect(()=>{
  const sky=mountSolarSky(sceneRef.current!,canvasRef.current!,veilRef.current!,flip,()=>setReplyRevealed(true));engine.current=sky;sky.setTheme(theme);sky.reset(!id);
  const reset=()=>{clearTimeout(stopTimer.current);target.current=undefined;sky.reset(true);setRevealed(false);setReplyRevealed(false);};window.addEventListener("solar-new-chat",reset);
  return()=>{clearTimeout(stopTimer.current);window.removeEventListener("solar-new-chat",reset);sky.dispose();engine.current=undefined;};
 },[]);
 useEffect(()=>{engine.current?.setTheme(theme);},[theme]);
 useEffect(()=>{if(target.current===id)return;target.current=id;clearTimeout(stopTimer.current);engine.current?.reset(!id);setRevealed(Boolean(id));setReplyRevealed(Boolean(id));},[id]);
 useLayoutEffect(()=>{if(!revealed||from.current===undefined)return;const slot=composerRef.current;if(slot&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){const r1=slot.getBoundingClientRect();slot.style.transition="none";slot.style.transform=`translateY(${from.current-r1.top}px)`;void slot.offsetHeight;slot.style.transition="transform 0.95s var(--spring)";slot.style.transform="";}from.current=undefined;},[revealed]);
 return {sceneRef,canvasRef,veilRef,composerRef,revealed,replyRevealed,begin:(conversationId:string)=>{target.current=conversationId;if(!revealedRef.current){setReplyRevealed(false);engine.current?.begin();}},stop:()=>{engine.current?.stop();if(!revealedRef.current)stopTimer.current=setTimeout(()=>{engine.current?.reset(false);setReplyRevealed(true);flip();},1600);}};
}
