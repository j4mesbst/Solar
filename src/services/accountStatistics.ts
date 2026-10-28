import type {UsageEvent} from './usage';
import {dayKey} from './usage';
import type {AgentMission} from './solarAgentStore';

/** Local calendar streaks, not 24-hour intervals (including DST boundaries). */
export function accountStatistics(events:UsageEvent[],missions:AgentMission[],now=Date.now()){
 const days=new Map<string,number>();let total=0;
 for(const event of events){if(event.pending||event.at>now||!Number.isFinite(event.tokens)||event.tokens<=0)continue;total+=event.tokens;const key=dayKey(new Date(event.at));days.set(key,(days.get(key)??0)+event.tokens);}
 const date=new Date(now);date.setHours(12,0,0,0);
 let current=0,longest=0,run=0;const today=dayKey(date);date.setDate(date.getDate()-1);const yesterday=dayKey(date);
 const keys=[...days.keys()].sort();let previous:string|undefined;
 for(const key of keys){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()-1);run=previous===dayKey(d)?run+1:1;longest=Math.max(longest,run);previous=key;}
 const anchor=days.has(today)?today:days.has(yesterday)?yesterday:undefined;
 if(anchor){const d=new Date(`${anchor}T12:00:00`);while(days.has(dayKey(d))){current++;d.setDate(d.getDate()-1);}}
 const durations=missions.filter(m=>m.status==='completed'&&Date.parse(m.updatedAt)<=now).map(m=>m.usage?.elapsedMs).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
 return {total,peak:Math.max(0,...days.values()),longestTaskMs:durations.length?Math.max(...durations):undefined,longestStreak:longest,currentStreak:current};
}
export const compactTokens=(n:number)=>new Intl.NumberFormat('fr-FR',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n);
export function taskDuration(ms:number|undefined){if(ms===undefined)return '—';const seconds=Math.round(ms/1000);if(seconds<60)return `${seconds} s`;const minutes=Math.floor(seconds/60);return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h${minutes%60?` ${minutes%60} min`:''}`;}
