import Stripe from 'stripe';
import {authReturnPage} from './auth-page.mjs';
import {createClient} from '@supabase/supabase-js';
import {billingConfig} from './config.mjs';
import {billingStore} from './store.mjs';
import {createBillingService,BillingError} from './service.mjs';

const RETURN_HTML='<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solar · Abonnement</title><style>body{font:17px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#111113;color:#f8f8fa}main{max-width:460px;padding:32px}h1{font-size:28px}p{line-height:1.6;color:#c4c4ce}</style><main><h1>Retourne dans Solar</h1><p>Solar vérifiera l’état de ton abonnement auprès de Stripe. Si ton paiement est confirmé, ton offre s’activera automatiquement dans l’application.</p><p>Tu peux fermer cette page.</p></main></html>';
export function createBillingHandler({service,config}) {
  return async function handle(request){
    const origin=request.headers.get('origin');
    const headers={'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
    if(origin&&config.origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
    const json=(value,status=200)=>Response.json(value,{status,headers});
    try{
      const url=new URL(request.url),action=url.searchParams.get('action')??'status';
      if(action==='return'&&request.method==='GET')return new Response(RETURN_HTML,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
      if(origin&&!config.origins.has(origin))throw new BillingError('Origine non autorisée.',403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      const expected=action==='status'?'GET':'POST';
      if(request.method!==expected)return json({error:'Méthode non autorisée.'},405);
      if(action==='webhook'){
        const length=Number(request.headers.get('content-length')??0);if(length>1024*1024)throw new BillingError('Requête trop volumineuse.',413);
        const raw=await boundedBody(request,1024*1024);
        await service.webhook(Buffer.from(raw),request.headers.get('stripe-signature'));return json({received:true});
      }
      if(!['status','checkout','portal','cancel'].includes(action))return json({error:'Action inconnue.'},404);
      const bearer=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      const user=await service.authenticate(bearer);
      if(action==='status')return json(await service.status(user));
      if(action==='portal')return json(await service.portal(user));
      if(action==='cancel')return json(await service.cancel(user));
      if(!request.headers.get('content-type')?.startsWith('application/json'))throw new BillingError('JSON requis.',415);
      let body;try{body=JSON.parse(await boundedBody(request,2048));}catch(e){if(e instanceof BillingError)throw e;throw new BillingError('Requête invalide.');}
      return json(await service.checkout(user,body.plan));
    }catch(error){
      // Stripe messages can contain customer data. Classify known failures but
      // never return/log the upstream text or response body.
      if(error instanceof BillingError)return json({error:error.message,code:error.code},error.status);
      if(error?.type==='StripeInvalidRequestError'&&/No valid payment method types|cannot (?:currently )?(?:create|make).*charges|account.*(?:not.*enabled|not.*activated)|payments.*not.*enabled/i.test(error.message??''))return json({error:'Les paiements Solar ne sont pas encore activés par Stripe. La vérification du compte marchand doit être terminée avant de pouvoir s’abonner.',code:'payments_not_enabled'},503);
      const diagnostic={};for(const key of ['type','code','param','requestId'])if(typeof error?.[key]==='string'&&/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(error[key]))diagnostic[key]=error[key];if(Number.isInteger(error?.statusCode))diagnostic.status=error.statusCode;
      console.error('Solar billing operation failed',diagnostic);return json({error:'Le service d’abonnement est temporairement indisponible. Réessaie.',code:'unavailable'},503);
    }
  };
}
async function boundedBody(request,max){
  const reader=request.body?.getReader();if(!reader)return '';const chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new BillingError('Requête trop volumineuse.',413);}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
let handler;
export async function productionBillingHandler(request){
  try{
    if(new URL(request.url).searchParams.get('action')==='auth'&&request.method==='GET')return authReturnPage();
    if(!handler){const config=billingConfig(),db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),stripe=new Stripe(config.stripeKey,{maxNetworkRetries:2,timeout:20000});handler=createBillingHandler({config,service:createBillingService({stripe,store:billingStore(db,config.livemode),auth:db.auth,config})});}
    return await handler(request);
  }catch{return Response.json({error:'Le paiement sera disponible après finalisation du service d’abonnement.',code:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
