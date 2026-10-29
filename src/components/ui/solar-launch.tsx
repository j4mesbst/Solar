import {useCallback,useState,useEffect,useRef,type ReactNode} from 'react';
import {LiquidGlassLogoReveal} from './liquid-glass-logo-reveal';
import './solar-launch.css';
export function SolarLaunch({children}:{children:ReactNode}){
 const content=useRef<HTMLDivElement>(null);
 const[finished,setFinished]=useState(false);const finish=useCallback(()=>setFinished(true),[]);
 useEffect(()=>{content.current?.toggleAttribute("inert",!finished);},[finished]);
 return <><div ref={content}>{children}</div>{!finished&&<LiquidGlassLogoReveal onDone={finish}/>}</>;
}
