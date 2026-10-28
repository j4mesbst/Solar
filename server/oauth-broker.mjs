// Run behind a TLS reverse proxy. Credentials belong only on this server.
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function createOAuthBroker({ env = process.env, fetcher = fetch } = {}) {
 const transactions = new Map(), rates = new Map();
 const providers = {
  notion: { client:env.NOTION_CLIENT_ID, secret:env.NOTION_CLIENT_SECRET, url:'https://api.notion.com/v1/oauth/token', revoke:'https://api.notion.com/v1/oauth/revoke', redirects:env.NOTION_REDIRECT_URIS },
  discord: { client:env.DISCORD_CLIENT_ID, secret:env.DISCORD_CLIENT_SECRET, url:'https://discord.com/api/oauth2/token', revoke:'https://discord.com/api/oauth2/token/revoke', redirects:env.DISCORD_REDIRECT_URIS },
 };
 return createServer(async (req,res) => {
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try {
   const now=Date.now(); for(const [key,value] of transactions) if(value.expires<now) transactions.delete(key); for(const [key,value] of rates) if(value.until<now) rates.delete(key);
   const ip=req.socket.remoteAddress, rate=rates.get(ip)??{count:0,until:now+60000}; rates.set(ip,rate);
   if(++rate.count>30||rates.size>10000)return reply(429,{error:'rate_limited'});
   // Native desktop requests have no Origin. Never expose this endpoint to
   // arbitrary web pages or reflect an origin. Proxy must preserve POST bodies.
   if(req.method!=='POST'||req.headers.origin||!String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded'))return reply(400,{error:'invalid_request'});
   let body=''; for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>20000)return reply(413,{error:'request_too_large'});}
   const input=new URLSearchParams(body), id=input.get('provider'), p=providers[id];
   if(!p?.client||!p.secret||input.get('client_id')!==p.client)return reply(400,{error:'invalid_client'});
   const route=(req.url??'').split('?')[0], redirect=input.get('redirect_uri');
   if(route==='/oauth/prepare'){
    const state=input.get('state'),challenge=input.get('code_challenge');
    if(!/^[\w-]{32,128}$/.test(state??'')||!/^[\w-]{43}$/.test(challenge??'')||!p.redirects?.split(',').map(x=>x.trim()).includes(redirect)||transactions.has(state)||transactions.size>=1000)return reply(400,{error:'invalid_request'});
    transactions.set(state,{id,redirect,challenge,expires:now+180000});return reply(200,{prepared:true});
   }
   let payload;
   const revoke=route==='/oauth/revoke';
   if(revoke){if(!input.get('token'))return reply(400,{error:'invalid_request'});payload={token:input.get('token')};}
   else if(route==='/oauth/token'&&input.get('grant_type')==='authorization_code'){
    const state=input.get('state'), tx=transactions.get(state), verifier=input.get('code_verifier')??'';
    const digest=createHash('sha256').update(verifier).digest('base64url');
    if(!tx||tx.id!==id||tx.redirect!==redirect||!input.get('code')||!/^[-\w]{43,128}$/.test(verifier)||digest.length!==tx.challenge.length||!timingSafeEqual(Buffer.from(digest),Buffer.from(tx.challenge)))return reply(400,{error:'invalid_grant'});
    transactions.delete(state);payload={grant_type:'authorization_code',code:input.get('code'),redirect_uri:redirect};
   } else if(route==='/oauth/token'&&input.get('grant_type')==='refresh_token'&&input.get('refresh_token'))payload={grant_type:'refresh_token',refresh_token:input.get('refresh_token')};
   else return reply(400,{error:'invalid_request'});
   const headers={Accept:'application/json'};let encoded;
   if(id==='notion'){headers.Authorization=`Basic ${Buffer.from(`${p.client}:${p.secret}`).toString('base64')}`;headers['Content-Type']='application/json';headers['Notion-Version']='2025-09-03';encoded=JSON.stringify(payload);}
   else{headers['Content-Type']='application/x-www-form-urlencoded';encoded=new URLSearchParams({...payload,client_id:p.client,client_secret:p.secret}).toString();}
   const response=await fetcher(revoke?p.revoke:p.url,{method:'POST',headers,body:encoded,redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok)return reply(400,{error:'provider_rejected_request'});
   if(revoke)return reply(200,{revoked:true});
   const data=await response.json();if(typeof data.access_token!=='string')return reply(502,{error:'invalid_provider_response'});
   // Deliberately no token database, logs or arbitrary upstream URL parameter.
   return reply(200,Object.fromEntries(['access_token','refresh_token','expires_in','scope','token_type'].filter(key=>data[key]!==undefined).map(key=>[key,data[key]])));
  }catch{return reply(502,{error:'oauth_exchange_failed'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=createOAuthBroker();server.requestTimeout=25000;server.headersTimeout=10000;server.listen(Number(process.env.PORT??8788),'127.0.0.1',()=>console.log('Solar OAuth broker listening on loopback behind TLS proxy.'));}
