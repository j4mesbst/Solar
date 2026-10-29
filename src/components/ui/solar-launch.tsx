import {useCallback,useState,useEffect,useRef,type ReactNode} from 'react';
import {LiquidGlassLogoReveal} from './liquid-glass-logo-reveal';
import './solar-launch.css';
export function SolarLaunch({children}:{children:ReactNode}){
 const content=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>>();
 const[phase,setPhase]=useState<'glass'|'opening'|'done'>('glass');
 const finish=useCallback(()=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches){setPhase('done');return;}setPhase('opening');},[]);
 useEffect(()=>{content.current?.toggleAttribute('inert',phase!=='done');if(phase==='opening')timer.current=setTimeout(()=>setPhase('done'),650);return()=>clearTimeout(timer.current);},[phase]);
 return <><div ref={content}>{children}</div>{phase==='glass'&&<LiquidGlassLogoReveal onDone={finish}/>}{phase==='opening'&&<div className="solar-opening" aria-hidden><div className="solar-opening-half solar-opening-left"><span className="solar-opening-eyes"/></div><div className="solar-opening-half solar-opening-right"><span className="solar-opening-eyes"/></div></div>}</>;
}
