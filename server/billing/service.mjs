import {randomUUID,createHash} from 'node:crypto';
import {AMOUNTS,VAT_EXEMPT_FOOTER} from './config.mjs';
export class BillingError extends Error {constructor(message,status=400,code='billing_error'){super(message);this.status=status;this.code=code;}}
const id=value=>typeof value==='string'?value:value?.id;
const linePrice=line=>id(line.pricing?.price_details?.price??line.price);
const recognized=(config,price)=>Object.keys(config.prices).find(plan=>config.prices[plan]===price);
export const starter=()=>({plan:'starter',status:'none',cancelAtPeriodEnd:false,currentPeriodEnd:null});
const supportedSubscriptions=new Set(['active','past_due','unpaid','trialing','paused','incomplete']);
export function createBillingService({stripe,store,auth,config,now=()=>Date.now()}) {
  async function authenticate(token){
    if(!token)throw new BillingError('Connecte-toi à ton compte Solar pour continuer.',401,'sign_in');
    const {data,error}=await auth.getUser(token);
    if(error||!data?.user)throw new BillingError('Ta session a expiré. Reconnecte-toi.',401,'sign_in');
    if(!data.user.email_confirmed_at)throw new BillingError('Confirme ton adresse e-mail avant de t’abonner.',403,'confirm_email');
    return data.user;
  }
  async function subscriptions(customer){
    const rows=[];for await(const s of stripe.subscriptions.list({customer,status:'all',limit:100})){
      if(s.livemode!==config.livemode)throw Error('Stripe mode mismatch');
      if(s.items.data.some(item=>recognized(config,id(item.price))))rows.push(s);
    }return rows;
  }
  async function stateForCustomer(customer){
    const states=[];
    for(const sub of await subscriptions(customer)){
      if(!['active','past_due'].includes(sub.status)||sub.pause_collection)continue;
      // Paid invoice lines, rather than an active/trial status or a browser redirect,
      // prove which tier and dates have actually been paid for. Unpaid upgrades retain the old tier.
      const invoices=await stripe.invoices.list({customer,subscription:sub.id,status:'paid',limit:10});
      for(const invoice of invoices.data){
        if(invoice.livemode!==config.livemode)throw Error('Stripe mode mismatch');
        for await(const line of stripe.invoices.listLineItems(invoice.id,{limit:100})){
          const plan=recognized(config,linePrice(line)),end=line.period?.end,start=line.period?.start;
          if(plan&&line.amount>=0&&line.quantity===1&&start<=now()/1000&&end>now()/1000){
            states.push({plan,status:sub.status,cancelAtPeriodEnd:Boolean(sub.cancel_at_period_end||sub.cancel_at),currentPeriodEnd:Math.min(end,sub.cancel_at??Infinity)*1000,subscriptionId:sub.id,paidStart:start});
          }
        }
      }
    }
    const best=states.filter(s=>s.currentPeriodEnd>now()).sort((a,b)=>b.paidStart-a.paidStart||AMOUNTS[b.plan]-AMOUNTS[a.plan])[0];
    if(best){const {paidStart,...value}=best;return value;}
    const existing=(await subscriptions(customer)).find(s=>supportedSubscriptions.has(s.status));
    return {...starter(),status:existing?.status??'none',subscriptionId:existing?.id};
  }
  async function status(user){const row=await store.account(user.id);return row?.customer_id?stateForCustomer(row.customer_id):starter();}
  async function locked(user,operation){
    await store.ensure(user.id);const token=randomUUID();
    if(!await store.claim(user.id,token))throw new BillingError('Une opération est déjà en cours. Réessaie dans quelques instants.',409,'busy');
    try{return await operation(await store.account(user.id),token);}finally{await store.release(user.id,token);}
  }
  async function portalForCustomer(customer,sub,plan){
    const session=await stripe.billingPortal.sessions.create({customer,return_url:config.base+'/api/billing?action=return',...(config.portalConfiguration?{configuration:config.portalConfiguration}:{}),...(sub&&plan?{flow_data:{type:'subscription_update_confirm',subscription_update_confirm:{subscription:sub.id,items:[{id:sub.items.data[0].id,price:config.prices[plan],quantity:1}]},after_completion:{type:'redirect',redirect:{return_url:config.base+'/api/billing?action=return'}}}}:{})});
    return {url:session.url,kind:'portal'};
  }
  async function checkout(user,plan){
    if(!Object.hasOwn(config.prices,plan))throw new BillingError('Offre inconnue.');
    return locked(user,async(row,lease)=>{
      const price=await stripe.prices.retrieve(config.prices[plan]);
      if(!price.active||price.unit_amount!==AMOUNTS[plan]||price.currency!=='eur'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.tax_behavior!=='inclusive'||price.livemode!==config.livemode)throw Error('Stripe monthly price configuration mismatch');
      if(config.taxMode==='automatic'){
        const settings=await stripe.tax.settings.retrieve(),registrations=await stripe.tax.registrations.list({status:'active',limit:1});
        if(settings.status!=='active'||!registrations.data.length)throw new BillingError('La configuration fiscale du paiement doit être finalisée.',503,'not_ready');
      }
      if(!row.customer_id){
        const hash=createHash('sha256').update(user.id).digest('hex');
        const customer=await stripe.customers.create({email:user.email,...(config.taxMode==='exempt'?{invoice_settings:{footer:VAT_EXEMPT_FOOTER}}:{})},{idempotencyKey:`solar-customer-${config.livemode}-${hash}`});
        await store.save(user.id,lease,{customer_id:customer.id});row.customer_id=customer.id;
      }
      const allSubscriptions=await subscriptions(row.customer_id);
      const existing=allSubscriptions.find(s=>supportedSubscriptions.has(s.status));
      if(existing?.status==='past_due'||existing?.status==='unpaid')return portalForCustomer(row.customer_id);
      if(existing)return portalForCustomer(row.customer_id,existing,existing.items.data.length===1&&existing.status==='active'?plan:undefined);
      const createSession=(tier,requestId)=>stripe.checkout.sessions.create({mode:'subscription',managed_payments:{enabled:false},customer:row.customer_id,line_items:[{price:config.prices[tier],quantity:1}],success_url:config.base+'/api/billing?action=return',cancel_url:config.base+'/api/billing?action=return&canceled=1',billing_address_collection:'required',customer_update:{address:'auto'},...(config.taxMode==='automatic'?{automatic_tax:{enabled:true}}:{}),integration_identifier:`solar_desktop_${createHash('sha256').update(requestId).digest('hex').replace(/[0-9]/g,'a').slice(0,8)}`},{idempotencyKey:`solar-checkout-${requestId}`});
      // Persist the intent before Stripe is called. Retries after a lost response use
      // the same idempotency key and identical parameters, even across server instances.
      if(row.checkout_id||row.checkout_request){
        const open=row.checkout_id?await stripe.checkout.sessions.retrieve(row.checkout_id):await createSession(row.checkout_plan,row.checkout_request);
        if(open.customer!==row.customer_id)throw Error('Checkout ownership mismatch');
        const previousSubscription=allSubscriptions.find(s=>s.id===id(open.subscription));
        if(open.status==='complete'&&!previousSubscription)throw new BillingError('Ton paiement est en cours de confirmation. Actualise ton offre dans quelques instants.',409,'payment_pending');
        if(open.status==='open'){
          if(row.checkout_plan===plan){await store.save(user.id,lease,{checkout_id:open.id});return {url:open.url,kind:'checkout'};}
          await stripe.checkout.sessions.expire(open.id);
        }
      }
      const requestId=randomUUID();
      await store.save(user.id,lease,{checkout_request:requestId,checkout_id:null,checkout_plan:plan});
      const session=await createSession(plan,requestId);
      await store.save(user.id,lease,{checkout_id:session.id});
      return {url:session.url,kind:'checkout'};
    });
  }
  async function portal(user){const row=await store.account(user.id);if(!row?.customer_id)throw new BillingError('Aucun abonnement à gérer.',404);return portalForCustomer(row.customer_id);}
  async function cancel(user){return locked(user,async(row)=>{
    if(!row.customer_id)throw new BillingError('Aucun abonnement à résilier.',404);
    const subs=(await subscriptions(row.customer_id)).filter(s=>supportedSubscriptions.has(s.status));
    if(!subs.length)throw new BillingError('Aucun abonnement à résilier.',404);
    for(const sub of subs)if(!sub.cancel_at_period_end)await stripe.subscriptions.update(sub.id,{cancel_at_period_end:true},{idempotencyKey:`solar-cancel-${sub.id}-${Math.floor(now()/30000)}`});
    return stateForCustomer(row.customer_id);
  });}
  async function webhook(raw,signature){
    let event;try{event=stripe.webhooks.constructEvent(raw,signature,config.webhookSecret);}catch{throw new BillingError('Signature Stripe invalide.',400,'invalid_signature');}
    if(event.livemode!==config.livemode)throw new BillingError('Environnement Stripe incorrect.',400);
    if(!/^(checkout\.session\.(completed|async_payment_succeeded|async_payment_failed|expired)|customer\.subscription\.(created|updated|deleted|paused|resumed)|invoice\.(paid|payment_failed|payment_action_required))$/.test(event.type))return;
    const customer=id(event.data.object.customer);
    if(!customer)return;
    const row=await store.byCustomer(customer);if(!row)return;
    // Fetch current Stripe state, never apply a stale event's plan. Audit only after reconciliation succeeds.
    const state=await stateForCustomer(customer);await store.event(event.id,customer,state);
  }
  return {authenticate,status,checkout,portal,cancel,webhook,stateForCustomer};
}
