import {currentAccountScope} from './accountScope.ts';
export type SolarPlan='starter'|'pro'|'max';
export const SOLAR_PLANS={
 starter:{name:'Starter',monthlyPrice:0,multiplier:1,weeklyTokens:125000,agents:5,concurrent:2},
 pro:{name:'Pro',monthlyPrice:10,multiplier:10,weeklyTokens:1250000,agents:10,concurrent:3},
 max:{name:'Max',monthlyPrice:50,multiplier:50,weeklyTokens:6250000,agents:Infinity,concurrent:6},
} as const;
export function planName(plan:SolarPlan|undefined){return SOLAR_PLANS[plan??'starter'].name;}

/** Explicit, account-scoped development build. Does not grant a Stripe plan. */
export function developmentAccess(plan:SolarPlan){
 const owner=import.meta.env?.VITE_SOLAR_DEVELOPER_ACCOUNT_ID;
 return plan==='starter'&&typeof owner==='string'&&owner.length>0&&currentAccountScope()===owner&&typeof window!=='undefined'&&Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
}
export function effectiveSolarLimits(plan:SolarPlan){
 return developmentAccess(plan)?{weeklyTokens:Infinity,agents:Infinity,concurrent:Infinity}:{...SOLAR_PLANS[plan],agents:Infinity,concurrent:6};
}
