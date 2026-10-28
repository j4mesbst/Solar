export const LIVE_PRICES = Object.freeze({pro:'price_1UUW4G7PzVyAuG56JA0WXtkN', max:'price_1UUW4N7PzVyAuG56VJquOUH0'});
export const VAT_EXEMPT_FOOTER='TVA non applicable, art. 293 B du CGI.';
export const AMOUNTS = Object.freeze({pro:1000,max:5000});
export function billingConfig(env=process.env) {
  env=Object.fromEntries(Object.entries(env).map(([key,value])=>[key,typeof value==='string'?value.trim():value]));
  const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STRIPE_RESTRICTED_KEY','STRIPE_WEBHOOK_SECRET','SOLAR_BILLING_PUBLIC_URL'];
  if(required.some(k=>!env[k])) throw Error('Billing server configuration is incomplete');
  const base=new URL(env.SOLAR_BILLING_PUBLIC_URL);
  if(base.protocol!=='https:' && !['localhost','127.0.0.1'].includes(base.hostname))throw Error('Billing requires HTTPS');
  const livemode=env.STRIPE_LIVEMODE==='true';
  if(!/^[rs]k_(live|test)_/.test(env.STRIPE_RESTRICTED_KEY)||env.STRIPE_RESTRICTED_KEY.includes('_live_')!==livemode)throw Error('Stripe mode/key mismatch');
  const prices=livemode?LIVE_PRICES:{pro:env.STRIPE_PRO_PRICE_ID,max:env.STRIPE_MAX_PRICE_ID};
  if(!prices.pro||!prices.max||prices.pro===prices.max)throw Error('Two distinct monthly Stripe prices are required');
  // This is a deliberate deployment decision, never inferred from Tax settings alone.
  if(!['exempt','automatic'].includes(env.SOLAR_TAX_MODE))throw Error('Confirm tax treatment before enabling Checkout');
  return {supabaseUrl:env.SUPABASE_URL,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY,stripeKey:env.STRIPE_RESTRICTED_KEY,webhookSecret:env.STRIPE_WEBHOOK_SECRET,base:base.origin,livemode,prices,taxMode:env.SOLAR_TAX_MODE,portalConfiguration:env.STRIPE_PORTAL_CONFIGURATION_ID??(livemode?'bpc_1UUXDL7PzVyAuG56v6fxX1Bz':undefined),origins:new Set([base.origin,'tauri://localhost','http://tauri.localhost','https://tauri.localhost',...(env.SOLAR_BILLING_ALLOWED_ORIGINS??'').split(',').filter(Boolean)])};
}
