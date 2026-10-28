import {useEffect,useRef} from 'react';

/** A decorative point sphere: fixed budget, paused offscreen and with reduced motion. */
export function SetupAtmosphere(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const points=Array.from({length:720},(_,i)=>{
   const y=1-2*(i+.5)/720,r=Math.sqrt(1-y*y),angle=i*Math.PI*(3-Math.sqrt(5));
   return {x:Math.cos(angle)*r,y,z:Math.sin(angle)*r,size:i%23===0?3.1:i%7===0?1.8:.8};
  });
  let frame=0,last=0,rotation=0,width=0,height=0;
  const resize=()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  const draw=(time:number)=>{
   if(!width||!height)return;
   if(last&&!motion.matches)rotation+=Math.min(time-last,64)*.000045;
   last=time;
   ctx.clearRect(0,0,width,height);
   const radius=Math.min(width*.43,height*.4),cx=width/2,cy=height/2;
   const cos=Math.cos(rotation),sin=Math.sin(rotation);
   for(const p of points){
    const x=p.x*cos+p.z*sin,z=p.z*cos-p.x*sin,depth=(z+1)/2;
    ctx.beginPath();ctx.arc(cx+x*radius,cy+p.y*radius*.96,p.size*(.5+depth*.6),0,Math.PI*2);
    ctx.fillStyle=`rgba(255,255,255,${.12+depth*.88})`;ctx.fill();
   }
   if(!document.hidden&&!motion.matches)frame=requestAnimationFrame(draw);
  };
  const refresh=()=>{cancelAnimationFrame(frame);last=0;resize();if(!document.hidden)draw(performance.now());};
  const observer=new ResizeObserver(refresh);observer.observe(canvas);
  motion.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);refresh();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();motion.removeEventListener('change',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return <canvas ref={ref} className="setup-atmosphere" aria-hidden="true"/>;
}
