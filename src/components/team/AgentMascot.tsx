import {type CSSProperties,useEffect,useRef} from 'react';
import type {MascotId} from '../../services/solarAgentStore';
export const mascots:{id:MascotId;label:string;color:string}[]=[{id:'orbit',label:'Curieux',color:'#161616'},{id:'drop',label:'Éveillé',color:'#f56c5c'},{id:'spark',label:'Malicieux',color:'#9860df'},{id:'pebble',label:'Calme',color:'#139a88'},{id:'petal',label:'Joueur',color:'#dc4c91'}];
const shapes:Record<Exclude<MascotId,'orbit'>,string>={
 drop:'M32 3C23 3 5 20 5 36a27 27 0 0 0 54 0C59 20 41 3 32 3Z',
 spark:'M32 3C41 3 42 13 49 15C58 17 63 23 59 32C63 41 58 48 49 49C44 58 37 63 29 58C19 62 12 56 12 48C3 44 0 35 6 28C4 18 12 12 20 13C22 6 25 3 32 3Z',
 pebble:'M30 8C46 5 59 17 61 33C63 48 49 58 32 58C14 58 3 50 3 36C3 21 14 10 30 8Z',
 petal:'M32 5C40-1 51 5 51 16C64 17 67 32 57 39C62 52 50 63 39 57C30 67 16 60 17 50C3 51-3 36 7 28C1 16 15 5 25 11C26 7 28 6 32 5Z',
};
export const mascotColor=(kind?:MascotId,color?:string)=>color??mascots.find(m=>m.id===(kind??'orbit'))?.color??'#161616';
export function AgentMascot({kind='orbit',color,size=42,active=false,busy=false}:{kind?:MascotId;color?:string;size?:number;active?:boolean;busy?:boolean}){
 const root=useRef<HTMLSpanElement>(null);const accent=mascotColor(kind,color);
 useEffect(()=>{if(!active)return;const move=(e:PointerEvent)=>{const n=root.current;if(!n||!n.getClientRects().length)return;const r=n.getBoundingClientRect();n.style.setProperty('--look-x',`${Math.max(-3,Math.min(3,(e.clientX-r.x-r.width/2)/100))}px`);n.style.setProperty('--look-y',`${Math.max(-2,Math.min(2,(e.clientY-r.y-r.height/2)/140))}px`);};window.addEventListener('pointermove',move,{passive:true});return()=>window.removeEventListener('pointermove',move);},[active]);
 return <span ref={root} className={`team-mascot living-mascot ${active?'is-active':''} ${busy?'is-working':''}`} data-character={kind} style={{width:size,height:size,'--mascot-color':accent} as CSSProperties} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none">{kind==='orbit'?<circle className="mascot-body" cx="32" cy="32" r="30" fill={accent}/>:<path className="mascot-body" fill={accent} d={shapes[kind]}/>}<g className="team-mascot-face" fill="white"><rect x="18" y="20" width="10" height="23" rx="5" transform="rotate(5 23 31)"/><rect x="37" y="20" width="10" height="23" rx="5" transform="rotate(5 42 31)"/></g></svg></span>;
}
