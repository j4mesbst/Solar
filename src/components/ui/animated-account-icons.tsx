// MIT: dmytro / pqoqubbw/icons (User); Avijit Dey / Avijit07x/animateicons (Blocks).
import {motion,useAnimation,useReducedMotion} from 'motion/react';
export function UserIcon({size=24}:{size?:number}){
 const controls=useAnimation(),reduced=useReducedMotion();
 return <span onMouseEnter={()=>{if(!reduced)void controls.start('animate');}} onMouseLeave={()=>void controls.start('normal')}><svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><motion.circle cx="12" cy="8" r="5" animate={controls} initial="normal" variants={{normal:{pathLength:1,pathOffset:0,scale:1},animate:{pathLength:[0,1],pathOffset:[1,0],scale:[.5,1]}}}/><motion.path d="M20 21a8 8 0 0 0-16 0" animate={controls} variants={{normal:{pathLength:1,opacity:1,pathOffset:0},animate:{pathLength:[0,1],opacity:[0,1],pathOffset:[1,0]}}} transition={{delay:.2,duration:.4}}/></svg></span>;
}
export function BlocksIcon({size=24}:{size?:number}){
 const controls=useAnimation(),reduced=useReducedMotion();
 return <span onMouseEnter={()=>{if(!reduced)void controls.start('animate');}} onMouseLeave={()=>void controls.start('normal')}><motion.svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" animate={controls} initial="normal" variants={{normal:{rotate:0,scale:1},animate:{rotate:[0,-2,2,0],scale:[1,1.05,.95,1],transition:{duration:1}}}}><motion.path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" variants={{normal:{pathLength:1,opacity:1},animate:{pathLength:[0,1],opacity:[.5,1],transition:{duration:.8}}}}/><motion.rect x="14" y="2" width="8" height="8" rx="1" variants={{normal:{scale:1},animate:{scale:[1,1.2,.9,1],transition:{duration:1}}}}/></motion.svg></span>;
}
