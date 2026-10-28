import {connectorActivity,type AtlasConnectorId} from './connectors';
export type ActivityPhase='working'|'completed'|'failed';
export interface ActivityDisplay {id:AtlasConnectorId;tool:string;phase:ActivityPhase;since:number}
type Event={plugin:string;tool:string;status:string};
/** Presentation clock only: never delays a tool or a model response. */
export class ActivityPresentation {
 private pending=new Map<string,{id:AtlasConnectorId;tool:string;count:number}>();
 private shown?:ActivityDisplay;
 private timer?:ReturnType<typeof setTimeout>;
 constructor(private publish:(value:ActivityDisplay|undefined)=>void,private clock=()=>Date.now(),private later=(fn:()=>void,ms:number)=>setTimeout(fn,ms),private cancel=(timer:ReturnType<typeof setTimeout>)=>clearTimeout(timer)){}
 private active(id:AtlasConnectorId,tool:string){return this.pending.has(id+':'+tool);}
 private render(){this.publish(this.shown?{...this.shown}:undefined);}
 private schedule(){
  if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;
  if(!this.shown)return;
  const wait=this.shown.since+2000-this.clock();
  const next=[...this.pending.values()].at(-1);
  if(wait>0&&(this.shown.phase!=='working'||next?.tool!==this.shown.tool||next?.id!==this.shown.id))this.timer=this.later(()=>{this.timer=undefined;this.advance();},wait);
 }
 private advance(){
  const next=[...this.pending.values()].at(-1);
  if(next&&(!this.shown||this.clock()-this.shown.since>=2000))this.shown={id:next.id,tool:next.tool,phase:'working',since:this.clock()};
  else if(this.shown?.phase!=='working')this.shown=undefined;
  this.render();this.schedule();
 }
 observe(event:Event){
  const id=connectorActivity(event.plugin);if(!id||!['started','completed','failed'].includes(event.status))return;
  const key=id+':'+event.tool,previous=this.pending.get(key);
  if(event.status==='started')this.pending.set(key,{id,tool:event.tool,count:(previous?.count??0)+1});
  else{if(!previous)return;if(previous.count>1)this.pending.set(key,{...previous,count:previous.count-1});else this.pending.delete(key);}
  if(!this.shown)this.shown={id,tool:event.tool,phase:'working',since:this.clock()};
  // A newly started write must never retain the preceding read's description.
  if(event.status==='started'&&/(?:^|[._])(?:create|send|reply|post|update|delete|write|add|remove|edit|insert|append|draft)(?:[._]|$)/.test(event.tool))this.shown={id,tool:event.tool,phase:'working',since:this.clock()};
  if(this.shown.id===id&&this.shown.tool===event.tool)this.shown.phase=this.active(id,event.tool)?'working':event.status==='failed'?'failed':'completed';
  if(this.shown.phase==='failed'){this.shown=undefined;this.advance();return;}
  if(this.clock()-this.shown.since>=2000)this.advance();else{this.render();this.schedule();}
 }
 finish(){
  // Readability never delays a response or outlives the real mission.
  this.reset();
 }
 reset(){if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;this.pending.clear();this.shown=undefined;this.render();}
}
