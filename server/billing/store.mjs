export function billingStore(db,livemode) {
  const unwrap=({data,error})=>{if(error)throw Error('Billing database unavailable');return data;};
  const table=()=>db.from('solar_billing_accounts');
  return {
    async account(userId){return unwrap(await table().select('*').eq('user_id',userId).eq('livemode',livemode).maybeSingle());},
    async byCustomer(customerId){return unwrap(await table().select('*').eq('customer_id',customerId).eq('livemode',livemode).maybeSingle());},
    async ensure(userId){unwrap(await table().upsert({user_id:userId,livemode},{onConflict:'user_id,livemode',ignoreDuplicates:true}));},
    async claim(userId,token){return unwrap(await db.rpc('solar_billing_claim',{p_user:userId,p_live:livemode,p_token:token}));},
    async save(userId,token,values){const data=unwrap(await table().update(values).eq('user_id',userId).eq('livemode',livemode).eq('lease_token',token).select('user_id'));if(!data?.length)throw Error('Billing operation lease expired');},
    async release(userId,token){unwrap(await table().update({lease_until:null,lease_token:null}).eq('user_id',userId).eq('livemode',livemode).eq('lease_token',token));},
    async event(eventId,customerId,state){unwrap(await db.from('solar_billing_events').upsert({event_id:eventId,livemode,customer_id:customerId,verified_state:state},{onConflict:'event_id,livemode',ignoreDuplicates:true}));}
  };
}
