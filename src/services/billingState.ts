import {currentAccountScope} from './accountScope.ts';
import type {SolarPlan} from './solarPlans.ts';
export interface BillingStatus {plan:SolarPlan;status:string;cancelAtPeriodEnd:boolean;currentPeriodEnd:number|null;subscriptionId?:string}
const free=():BillingStatus=>({plan:'starter',status:'none',cancelAtPeriodEnd:false,currentPeriodEnd:null});
let owner='',value=free();
// Paid status is deliberately kept in memory only, populated by the authenticated API.
// Never migrate preview selections or trust a localStorage subscription flag.
export function billingSnapshot(){
 const state=owner===currentAccountScope()?value:free();
 return state.plan!=='starter'&&(!state.currentPeriodEnd||state.currentPeriodEnd<=Date.now())?{...state,plan:'starter' as const}:state;
}
export function verifiedPlan():SolarPlan {const state=billingSnapshot();return state.plan!=='starter'&&(!state.currentPeriodEnd||state.currentPeriodEnd<=Date.now())?'starter':state.plan;}
export function acceptBillingStatus(status:BillingStatus,scope:string){
 if(scope!==currentAccountScope())return;
 if(!['starter','pro','max'].includes(status.plan)||typeof status.status!=='string'||typeof status.cancelAtPeriodEnd!=='boolean'||(status.currentPeriodEnd!==null&&!Number.isFinite(status.currentPeriodEnd)))throw Error('Réponse d’abonnement invalide.');
 if(status.plan!=='starter'&&(!status.currentPeriodEnd||!status.subscriptionId||!['active','past_due'].includes(status.status)))throw Error('Confirmation d’abonnement invalide.');
 owner=scope;value={...status};window.dispatchEvent(new Event('solar-billing-change'));window.dispatchEvent(new Event('solar-usage-change'));
}
export function resetBillingStatus(){owner=currentAccountScope();value=free();window.dispatchEvent(new Event('solar-billing-change'));window.dispatchEvent(new Event('solar-usage-change'));}
