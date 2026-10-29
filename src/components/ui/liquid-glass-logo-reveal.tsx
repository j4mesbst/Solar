import {useEffect,useRef} from 'react';
import {startGlass} from './glass-reveal-engine';
export function LiquidGlassLogoReveal({onDone}:{onDone:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){onDone();return;}if(!canvas.current)return;const cleanup=startGlass(canvas.current,'/solar-icon.png',onDone);const timeout=setTimeout(onDone,8000);return()=>{clearTimeout(timeout);cleanup();};},[onDone]);
 return <div className="solar-launch" role="status" aria-label="Ouverture de Solar"><canvas ref={canvas} aria-hidden/><img src="/solar-icon.png" alt="" className="solar-launch-fallback"/></div>;
}
