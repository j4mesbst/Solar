import {authClient} from './auth';
import {currentAccountScope} from './accountScope';
import {providerFetch} from './transport';
import {acceptBillingStatus,billingSnapshot,resetBillingStatus,type BillingStatus} from './billingState';
import type {SolarPlan} from './solarPlans';
export {billingSnapshot};
export class BillingClientError extends Error{constructor(message:string,readonly code='billing_error'){super(message);}}
const base=()=>{
 const value=import.meta.env.VITE_SOLAR_BILLING_URL as string|undefined;
 if(!value)throw new BillingClientError('Le paiement n’est pas encore disponible sur cette installation.','not_ready');
 const url=new URL(value);if(url.protocol!=='https:'&&!(import.meta.env.DEV&&['localhost','127.0.0.1'].includes(url.hostname)))throw new BillingClientError('Le service de paiement doit utiliser HTTPS.');
 return value.replace(/\/$/,'');
};
export const billingConfigured=()=>Boolean(import.meta.env.VITE_SOLAR_BILLING_URL);
export async function billingRequest(action:string,body?:unknown){
 if(!authClient)throw new BillingClientError('Connecte-toi à ton compte Solar pour continuer.','sign_in');
 const scope=currentAccountScope(),{data,error}=await authClient.auth.getSession();
 if(error||!data.session)throw new BillingClientError('Connecte-toi à ton compte Solar pour continuer.','sign_in');
 let response:Response;
 try{response=await providerFetch(`${base()}?action=${action}`,{method:action==='status'?'GET':'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});}catch(reason){if(reason instanceof BillingClientError)throw reason;throw new BillingClientError('Impossible de vérifier ton abonnement. Vérifie ta connexion et réessaie.');}
 const payload=await response.json().catch(()=>null);
 if(scope!==currentAccountScope())throw new BillingClientError('Le compte Solar a changé. Réessaie.');
 if(!response.ok)throw new BillingClientError(payload?.error??'Le service d’abonnement est indisponible.',payload?.code);
 if(!payload||typeof payload!=='object')throw new BillingClientError('Réponse du service d’abonnement invalide.');
 return {payload,scope};
}
let pending:Promise<BillingStatus>|undefined;
export function refreshBilling():Promise<BillingStatus>{
 if(pending)return pending;
 pending=(async()=>{if(!authClient||!billingConfigured()){resetBillingStatus();return billingSnapshot();}const {data}=await authClient.auth.getSession();if(!data.session){resetBillingStatus();return billingSnapshot();}const {payload,scope}=await billingRequest('status');acceptBillingStatus(payload,scope);return billingSnapshot();})().finally(()=>{pending=undefined;});return pending;
}
export async function beginCheckout(plan:Exclude<SolarPlan,'starter'>){return (await billingRequest('checkout',{plan})).payload as {url:string;kind:'checkout'|'portal'};}
export async function customerPortal(){return (await billingRequest('portal')).payload as {url:string};}
export async function cancelSubscription(){const {payload,scope}=await billingRequest('cancel');acceptBillingStatus(payload,scope);return billingSnapshot();}
export function validateStripeUrl(value:string){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new BillingClientError('Lien de paiement invalide.');return url.href;}
export async function openStripePage(value:string){
 const url=validateStripeUrl(value);
 if((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__){const {invoke}=await import('@tauri-apps/api/core');await invoke('oauth_open',{url});}
 else{const tab=window.open(url,'_blank','noopener,noreferrer');void tab;}
}
export function initializeBilling(){
 const refresh=()=>{void refreshBilling().catch(()=>{});};refresh();window.addEventListener('focus',refresh);const visible=()=>{if(document.visibilityState==='visible')refresh();};document.addEventListener('visibilitychange',visible);const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
 return ()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);window.clearInterval(timer);};
}
