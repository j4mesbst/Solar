import {AgentMascot} from "../team/AgentMascot";
import { useEffect, useRef } from "react";
import { ATLAS_CONNECTORS, type AtlasActivity } from "./connectors";
import AnimatedShinyText from '../ui/animated-text-01';
import type {ActivityPhase} from './activityPresentation';

/** Presentation only: the caller owns the actual operation lifecycle. */
export function ToolActivity({ mascot,activity,phase='working',tool }: { mascot?:import("../../services/solarAgentStore").MascotId;activity: AtlasActivity;phase?:ActivityPhase;tool?:string }) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=root.current;if(!node)return;
    let offscreen=false;
    const update=()=>node.toggleAttribute("data-paused",document.hidden||offscreen);
    const observer=new IntersectionObserver(([entry])=>{offscreen=!entry.isIntersecting;update();});
    observer.observe(node);document.addEventListener("visibilitychange",update);update();
    return()=>{observer.disconnect();document.removeEventListener("visibilitychange",update);};
  },[]);
  const def=ATLAS_CONNECTORS[activity],label=`Utilise ${def.name}…`;
  return <div ref={root} role="status" aria-label={`${label} · ${def.name}`} className="atlas-tool-activity" data-activity={activity} data-phase={phase}>
    <AgentMascot kind={mascot} size={24} active busy/>
    <AnimatedShinyText>{label}</AnimatedShinyText>
  </div>;
}
