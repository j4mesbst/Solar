import { verifiedPlan } from "./billingState.ts";
import { currentAccountScope, scopedKey } from "./accountScope.ts";
import {SOLAR_PLANS,effectiveSolarLimits,type SolarPlan} from './solarPlans.ts';
export type {SolarPlan} from './solarPlans.ts';
export interface UsageEvent { id: string; at: number; local: boolean; tokens: number; estimated?: boolean; pending?: boolean;solar?:boolean }
export interface UsageState { version: 2; plan: SolarPlan; events: UsageEvent[] }
// Usage measurements stay local; the effective offer comes only from authenticated billing.
export const WEEK = 7 * 24 * 60 * 60 * 1000;
const YEAR = 366 * 24 * 60 * 60 * 1000;
const key = () => scopedKey("solar.usage.v1");
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function usageSnapshot(state: UsageState, now = Date.now()) {
  const events = state.events.filter(e => e.at > now - YEAR && (!e.pending || e.at > now - 30 * 60 * 1000));
  const cloud = events.filter(e => !e.local&&!e.pending), local = events.filter(e => e.local&&!e.pending);
  const current = new Date(now), start = new Date(current.getFullYear(), current.getMonth(), 1).getTime(), end = new Date(current.getFullYear(), current.getMonth() + 1, 1).getTime();
  const budget = (from: number, reset: number) => { const used = cloud.filter(e => e.at >= from).reduce((sum, e) => sum + e.tokens, 0); return { used, limit: null, resetsAt: reset }; };
  const weeklyEvents = cloud.filter(e => e.at > now - WEEK).sort((a, b) => a.at - b.at);
  const daily: Record<string, { tokens: number; estimated: boolean }> = {};
  for (const event of events.filter(e => !e.pending)) { const day = dayKey(new Date(event.at)); const entry = daily[day] ??= { tokens: 0, estimated: false }; entry.tokens += event.tokens; entry.estimated ||= Boolean(event.estimated); }
  const solarEvents=events.filter(e=>e.solar&&!e.local&&e.at<=now&&e.at>now-WEEK).sort((a,b)=>a.at-b.at);
  const limit=effectiveSolarLimits(state.plan).weeklyTokens,used=solarEvents.reduce((n,e)=>n+e.tokens,0);
  const solarWeekly={used,limit,remaining:Math.max(0,limit-used),remainingPercent:Number.isFinite(limit)?Math.max(0,Math.min(100,(limit-used)/limit*100)):100,resetsAt:solarEvents[0]?solarEvents[0].at+WEEK:undefined};
  return { plan: state.plan,solarWeekly, monthly: budget(start, end), weekly: budget(now - WEEK, (weeklyEvents[0]?.at ?? now) + WEEK), cloud: cloud.reduce((s, e) => s + e.tokens, 0), local: local.reduce((s, e) => s + e.tokens, 0), daily, events };
}
export function readUsage(): UsageState {
  const raw = localStorage.getItem(key());
  if (!raw) return { version: 2, plan: verifiedPlan(), events: [] };
  const value = JSON.parse(raw);
  if (![1, 2].includes(value.version) || !Object.hasOwn(SOLAR_PLANS,value.plan) || !Array.isArray(value.events) || value.events.some((e: UsageEvent) => !e || typeof e.id !== "string" || !Number.isFinite(e.at) || typeof e.local !== "boolean" || (e.solar!==undefined&&typeof e.solar!=='boolean') || (value.version === 2 && (!Number.isFinite(e.tokens) || e.tokens < 0)))) throw new Error("Le suivi d’utilisation est illisible. Le stockage local doit être restauré avant de continuer.");
  // Previous records count requests, not tokens. Preserve events without inventing tokens or paid rights.
  const state: UsageState = { version: 2, plan: verifiedPlan(), events: value.version === 1 ? [] : value.events };
  return { ...state, events: usageSnapshot(state).events };
}
function writeUsage(state: UsageState) { localStorage.setItem(key(), JSON.stringify(state)); window.dispatchEvent(new Event("solar-usage-change")); }
export function setPreviewPlan(_plan: SolarPlan): never { throw Error("Les offres sont activées uniquement après confirmation de Stripe."); }
export function reserveUsage(state: UsageState, local: boolean, id: string, now = Date.now(), requested = 1,solar=false): UsageState {
  const snapshot = usageSnapshot(state, now);
  if(solar&&!local&&snapshot.solarWeekly.remaining<1)throw Error('Ton usage Solar de la semaine est épuisé. Consulte Utilisation pour son renouvellement.');
  return { ...state, events: [...snapshot.events, { id, at: now, local, tokens: local ? 0 : Math.min(solar?snapshot.solarWeekly.remaining:Infinity,Math.max(1, Math.ceil(requested))), pending: true,...(solar?{solar:true}:{}) }] };
}
const withLedgerLock = <T>(operation: () => T): Promise<T> => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(key(), operation) : Promise.resolve(operation());
export async function beginUsage(local: boolean, requested = 1,solar=false) {
  const owner=currentAccountScope(),id = crypto.randomUUID();
  let reserved=Infinity;
  try { await withLedgerLock(() => {if(owner!==currentAccountScope())throw Error("Compte Solar modifié.");const previous=readUsage();if(solar&&!local)reserved=Math.min(requested,usageSnapshot(previous).solarWeekly.remaining);const state = reserveUsage(previous, local, id, Date.now(), requested,solar); writeUsage(state); }); }
  catch (error) { if (local) return { reserved: Infinity, settle: async (_tokens: number | null, _estimated = false) => {} }; throw error; }
  let settled = false;
  return { reserved, settle: async (tokens: number | null, estimated = false) => {
    if (settled) return; settled = true;
    if(owner!==currentAccountScope())return;
    try { await withLedgerLock(() => { if(owner!==currentAccountScope())return;const state = readUsage(); writeUsage({ ...state, events: tokens === null ? state.events.filter(e => e.id !== id) : state.events.map(e => e.id === id ? { ...e, tokens: Math.max(0, Math.ceil(tokens)), estimated, pending: false } : e) }); }); }
    catch (error) { if (!local) throw error; }
  } };
}
