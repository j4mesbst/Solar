import {useEffect,useRef} from 'react';
import {startGlass} from './glass-reveal-engine';
export function LiquidGlassLogoReveal({onDone}:{onDone:()=>void}){
 const wrap=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){onDone();return;}
  if(!wrap.current)return;
  // A lost WebGL context cannot be revived on the same canvas (including StrictMode remounts).
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');wrap.current.appendChild(canvas);
  const cleanup=startGlass(canvas,'/solar-icon.png',onDone),timeout=setTimeout(onDone,8000);
  return()=>{clearTimeout(timeout);cleanup();canvas.remove();};
 },[onDone]);
 return <div ref={wrap} className="solar-launch" role="status" aria-label="Ouverture de Solar"><img src="/solar-icon.png" alt="" className="solar-launch-fallback"/></div>;
}
