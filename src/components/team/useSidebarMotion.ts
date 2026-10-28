import {useLayoutEffect,useRef,type RefObject} from 'react';

/** One layout change, then translation only: text never scales or reflows on
 * every frame. CSS owns the interruptible slide and rounded reveal. */
export function useSidebarMotion(collapsed:boolean,main:RefObject<HTMLElement>,sidebar:RefObject<HTMLElement>){
 const previous=useRef<{collapsed:boolean;viewport:number}>(),positions=useRef(new Map<HTMLElement,{left:number;animation?:Animation}>()),blur=useRef<Animation>();
 useLayoutEffect(()=>{
  const node=main.current,panel=sidebar.current;if(!node||!panel)return;
  if(collapsed&&panel.contains(document.activeElement))node.querySelector<HTMLButtonElement>('.team-agent-frame:not([hidden]) .team-conversation-header>button')?.focus({preventScroll:true});
  const old=previous.current,toggled=!!old&&old.collapsed!==collapsed,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  previous.current={collapsed,viewport:innerWidth};
  const duration=300,easing='cubic-bezier(.2,.8,.2,1)';
  for(const [anchor,state] of positions.current)if(!anchor.isConnected){state.animation?.cancel();positions.current.delete(anchor);}
  // Measure the centered content and the header controls independently. Moving
  // the whole resized main panel would make centered text jump by half a dock.
  const anchors=node.querySelectorAll<HTMLElement>('.team-agent-frame:not([hidden]) .atlas-messages,.team-agent-frame:not([hidden]) .atlas-composer-inner,.team-conversation-header>*');
  for(const anchor of anchors){if(!anchor.getClientRects().length)continue;
   const transform=getComputedStyle(anchor).transform,offset=transform==='none'?0:new DOMMatrixReadOnly(transform).m41;
   const target=anchor.getBoundingClientRect().left-offset,before=positions.current.get(anchor);
   const state={left:target,animation:before?.animation};positions.current.set(anchor,state);
   if(!toggled)continue;
   before?.animation?.cancel();
   if(!reduced&&old?.viewport===innerWidth&&before&&Math.abs(before.left-target+offset)>.5)state.animation=anchor.animate([{transform:`translate3d(${before.left-target+offset}px,0,0)`},{transform:'translate3d(0,0,0)'}],{duration,easing});
  }
  if(toggled){const currentBlur=getComputedStyle(panel).filter;blur.current?.cancel();if(!reduced&&!matchMedia('(prefers-reduced-transparency:reduce)').matches)blur.current=panel.animate([{filter:currentBlur==='none'?'blur(0px)':currentBlur},{filter:'blur(3px)',offset:.32},{filter:'blur(0px)'}],{duration,easing});}
 });
 useLayoutEffect(()=>{const media=matchMedia('(prefers-reduced-motion:reduce)'),stop=()=>{if(media.matches){for(const v of positions.current.values())v.animation?.cancel();blur.current?.cancel();}};media.addEventListener('change',stop);return()=>{media.removeEventListener('change',stop);for(const v of positions.current.values())v.animation?.cancel();blur.current?.cancel();};},[]);
}
