import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const dir=await mkdtemp(path.join(tmpdir(),'solar-direct-contract-'));
const values=new Map(),vault=new Map();
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.sessionStorage=globalThis.localStorage;
const env={VITE_GOOGLE_DESKTOP_CLIENT_ID:'google-public',VITE_MICROSOFT_CLIENT_ID:'ms-public',VITE_GITHUB_APP_CLIENT_ID:'github-public',VITE_SLACK_CLIENT_ID:'slack-public',VITE_LINEAR_CLIENT_ID:'linear-public'};
let opened,requests=[],forceIdentityFailure=false,refreshCount=0,refreshGate,omitScope=false,deviceTesting=false,devicePolls=0;
globalThis.window={dispatchEvent(){},__TAURI_INTERNALS__:{async invoke(command,args){
 if(command==='plugin:store|load')return 1;
 if(command==='plugin:store|get')return [null,false];
 if(command==='secret_get')return vault.get(args.key)??null;
 if(command==='secret_set'){vault.set(args.key,args.value);return;}
 if(command==='secret_delete'){vault.delete(args.key);return;}
 if(command==='oauth_begin')return args.port??19875;
 if(command==='oauth_open'){opened=new URL(args.url);return;}
 if(command==='oauth_wait')return `${new URL(opened.searchParams.get('redirect_uri')).pathname}?code=fixture-code&state=${opened.searchParams.get('state')}`;
 if(command==='oauth_cancel')return;
 if(command==='integration_cancel')return;
 if(command==='oauth_google_token'){assert(!args.body.includes('client_secret'));args={...args,url:'https://oauth2.googleapis.com/token'};}else if(command!=='integration_request')throw Error('Unexpected '+command);
 const url=new URL(args.url),body=args.body?new URLSearchParams(args.body):new URLSearchParams();requests.push(args);
 assert.equal(body.has('client_secret'),false);assert.equal(url.protocol,'https:');
 let result={ok:true};
 if(url.pathname==='/login/device/code')return {status:200,headers:{'content-type':'application/json'},body:JSON.stringify({device_code:'fixture-device',user_code:'FIXT-TEST',verification_uri:'https://github.com/login/device',expires_in:900,interval:5})};
 if(url.pathname.endsWith('/token')||url.pathname.endsWith('oauth.v2.access')||url.pathname==='/login/oauth/access_token'){
  if(body.get('grant_type')==='urn:ietf:params:oauth:grant-type:device_code'){devicePolls++;return {status:200,headers:{'content-type':'application/json'},body:JSON.stringify(devicePolls===1?{error:'authorization_pending'}:{access_token:'FAKE_DEVICE',refresh_token:'FAKE_REFRESH',expires_in:3600})};}
  if(body.get('grant_type')==='authorization_code'){
   assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),opened.searchParams.get('code_challenge'));
   assert.equal(opened.searchParams.get('code_challenge_method'),'S256');assert.equal(body.get('redirect_uri'),opened.searchParams.get('redirect_uri'));
  }else {refreshCount++;await refreshGate;}
  result={access_token:'FAKE_ACCESS_ONLY',refresh_token:'FAKE_REFRESH_ONLY',expires_in:3600,scope:opened?.searchParams.get('scope')??'read,write'};
  if(omitScope)delete result.scope;
  if(url.hostname==='slack.com')result={ok:true,authed_user:result};
 }else if(url.hostname==='api.github.com')result={login:'fixture-github'};
 else if(url.hostname==='openidconnect.googleapis.com')result={email:forceIdentityFailure?undefined:'fixture@example.invalid'};
 else if(url.hostname==='graph.microsoft.com')result={id:'fixture',mail:'fixture@example.invalid'};
 else if(url.hostname==='gmail.googleapis.com')result={emailAddress:'fixture@example.invalid'};
 else if(url.hostname==='slack.com')result={ok:true,team:'Fixture',user:'fixture'};
 else if(url.hostname==='api.linear.app')result={data:{viewer:{id:'fixture',name:'Fixture',organization:{name:'Fixture'}}}};
 return {status:200,headers:{'content-type':'application/json'},body:JSON.stringify(result)};
}}};
try{
 const result=await build({stdin:{contents:'export * from "./src/services/pluginCatalog.ts";export * from "./src/services/solarConnect.ts";export * from "./src/services/integrationTools.ts";export * from "./src/services/pluginRuntime.ts";export * from "./src/services/directOAuth.ts";export * from "./src/services/toolSchema.ts";export * from "./src/services/accountScope.ts";export * from "./src/services/integrationApi.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':JSON.stringify(env)}});
 const file=path.join(dir,'services.mjs');await writeFile(file,result.outputFiles[0].text);const s=await import(pathToFileURL(file));
 assert.equal(s.pluginCatalog.length,32);assert.equal(s.pluginCatalog.filter(x=>x.connection==='direct').length,16);assert.equal(s.pluginCatalog.filter(x=>x.connection==='key').length,16);
 assert.deepEqual(s.pluginCatalog.filter(x=>x.group==='popular').map(x=>x.id),['gmail','outlook','linear','slack','github','google-drive']);
 const toolNames=s.integrationTools.map(x=>x.name);assert.equal(new Set(toolNames).size,toolNames.length);
 for(const p of s.pluginCatalog){assert(s.integrationTools.some(t=>t.pluginId===p.id),p.id+' must expose real tools');assert(s.roots[p.id]);}
 for(const p of s.pluginCatalog.filter(x=>x.connection==='direct'&&x.id!=='github')){
  assert(s.oauthConfiguration(p.id).ready,p.id);await s.connectOAuth(p.id,new AbortController().signal);
  assert.equal(opened.searchParams.has('client_secret'),false);assert.equal(opened.searchParams.get('response_type'),'code');
  if(p.id==='slack'){assert.equal(opened.searchParams.has('scope'),true,'Slack must override configured bot scopes for a desktop redirect');assert.equal(opened.searchParams.get('scope'),'');assert(opened.searchParams.get('user_scope').includes('search:read'));}
  if(s.directOAuthProfile(p.id)?.provider==='microsoft'){assert.equal(new URL(opened.searchParams.get('redirect_uri')).pathname,'/');assert(opened.searchParams.get('scope').includes('offline_access'));}
  const a=await s.savedConnection(p.id);assert(a?.identity);assert.equal(a.oauthFlow,'pkce');assert.equal(a.auth,'oauth');
 }
 omitScope=true;await s.connectOAuth('google-drive',new AbortController().signal);assert((await s.savedConnection('google-drive')).scopes.includes('https://www.googleapis.com/auth/drive.readonly'),'scope omis = scopes demandés selon OAuth2');omitScope=false;
 const originalTimer=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>originalTimer(fn,delay>=5000?0:delay,...args);try{let displayed='';await s.connectGitHub(code=>displayed=code,new AbortController().signal);assert.equal(displayed,'FIXT-TEST');assert.equal(devicePolls,2);assert.equal((await s.savedConnection('github')).identity,'fixture-github');assert.equal((await s.savedConnection('github')).oauthFlow,'device');}finally{globalThis.setTimeout=originalTimer;}
 assert.notEqual((await s.savedConnection('google-calendar')).id,(await s.savedConnection('google-contacts')).id,'separate service records');
 const before=await s.savedConnection('google-docs');forceIdentityFailure=true;
 await assert.rejects(s.connectOAuth('google-docs',new AbortController().signal),/confirmé/);assert.equal((await s.savedConnection('google-docs')).id,before.id);forceIdentityFailure=false;
 assert(s.missingOAuthScopes(s.directOAuthProfile('outlook'),'User.Read Mail.Read').includes('Mail.Send'));
 const a=await s.savedConnection('outlook');await s.saveConnection('outlook',{...a,expiresAt:1});
 let release;refreshGate=new Promise(r=>release=r);const first=s.connectionToken('outlook'),second=s.connectionToken('outlook');setTimeout(release,10);await Promise.all([first,second]);assert.equal(refreshCount,1,'single-flight refresh');
 await s.saveConnection('github',{accessToken:'old',refreshToken:'refresh',expiresAt:1,identity:'fixture',auth:'oauth',oauthFlow:'device',clientId:'github-public',tokenEndpoint:'https://github.com/login/oauth/access_token'});await s.connectionToken('github');assert.equal(refreshCount,2,'Device Flow refresh without a secret');
 const ended=await s.savedConnection('outlook');await s.saveConnection('outlook',{...ended,expiresAt:1});refreshGate=new Promise(r=>release=r);const pending=s.connectionToken('outlook');await new Promise(r=>setTimeout(r,10));await s.removeConnection('outlook');release();await assert.rejects(pending,/changé/);assert.equal(await s.savedConnection('outlook'),null,'disconnection cannot be resurrected');
 s.initializeAccountScope('someone-else');assert.equal(await s.savedConnection('google-docs'),null,'per Solar account isolation');s.initializeAccountScope('');
 const checks=[['Regarde mes 3 derniers mails',['gmail']],['Lis mes mails Outlook',['outlook']],['Lis mes e-mails Outlook',['outlook']],['Lis mon calendrier Outlook',['ms-calendar']],['Ajoute une tâche dans Google Tasks',['google-tasks']],['Lis mes Google Contacts',['google-contacts']],['Lis mes fichiers OneDrive',['onedrive']],['Résume Slack et Linear',['linear','slack']]];
 for(const [prompt,ids]of checks)assert.deepEqual(s.requestedPluginServices(prompt).sort(),ids.sort(),prompt);
 assert.deepEqual(await s.resolveRequestedPlugins('Quels sont les trois derniers du coup ?',['Regarde mes trois derniers mails']),['gmail'],'reprise de la demande de mails sans répéter Gmail');
 for(const bad of ['/../other','//evil.invalid','/%2e%2e/other','/files#fragment'])await assert.rejects(s.integrationRequest('google-docs',bad),/Chemin/);
 for(const t of s.integrationTools){const schema=t.parameters;assert.deepEqual(s.validateToolParameters({},schema).length===0,(schema.required??[]).length===0,t.name+' schema');if(t.risk!=='read')assert(t.externalEffects&&t.permissions.some(p=>p.endsWith('.write')),t.name);}
 // Verify exact payloads and header dialects against fixed official destinations.
 delete window.__TAURI_INTERNALS__;const calls=[];
 globalThis.fetch=async(request)=>{calls.push({url:request.url,headers:Object.fromEntries(request.headers),body:await request.text(),method:request.method});return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});};
 for(const [id,header,prefix]of [['figma','x-figma-token',''],['brevo','api-key',''],['clickup','authorization',''],['monday','authorization',''],['readwise','authorization','Token ']]){await s.saveConnection(id,{accessToken:'FAKE',identity:'Fixture',auth:'api-key'});await s.integrationRequest(id,'/fixture');assert.equal(calls.at(-1).headers[header],prefix+'FAKE',id);}
 await s.saveConnection('onenote',{accessToken:'FAKE',identity:'Fixture',auth:'oauth'});const page=s.integrationTools.find(x=>x.name==='onenote.create_page');await page.execute({sectionId:'section',title:'<Title>',content:'<script>alert(1)</script>'},new AbortController().signal);assert(calls.at(-1).body.includes('&lt;script&gt;'));assert(calls.at(-1).headers['content-type'].startsWith('text/html'));
 const fixture={notion:{id:'bot',bot:{workspace_name:'Fixture'}},discord:{id:'bot',username:'Fixture',bot:true},todoist:{email:'fixture@example.invalid'},airtable:{id:'usrFixture'},figma:{email:'fixture@example.invalid'},asana:{data:{email:'fixture@example.invalid'}},clickup:{user:{email:'fixture@example.invalid'}},monday:{data:{me:{email:'fixture@example.invalid'}}},gitlab:{username:'Fixture'},hubspot:{portalId:123},vercel:{user:{email:'fixture@example.invalid'}},netlify:{email:'fixture@example.invalid'},cloudflare:{success:true,result:{id:'fixture',status:'active'}},webflow:{authorization:{id:'fixture'}},brevo:{email:'fixture@example.invalid'},readwise:{ok:true}};
 for(const p of s.pluginCatalog.filter(x=>x.connection==='key')){globalThis.fetch=async()=>new Response(JSON.stringify(fixture[p.id]),{headers:{'content-type':'application/json'}});assert(await s.identifyIntegration(p.id,'FAKE',p.id==='discord'?'bot':'api-key',new AbortController().signal),p.id);}
 globalThis.fetch=async()=>new Response(JSON.stringify({username:'person',bot:false}),{headers:{'content-type':'application/json'}});await assert.rejects(s.identifyIntegration('discord','FAKE','bot'),/bot officiel/);
 globalThis.fetch=async()=>new Response('{}',{headers:{'content-type':'application/json'}});await assert.rejects(s.identifyIntegration('monday','FAKE','api-key'),/confirmé/);
 console.log('Plugins directs PASS : 32 services, 15 parcours PKCE simulés, droits, identité, refresh concurrent/Device Flow, déconnexion, isolation, routage, schémas et destinations officielles. Aucun compte réel utilisé.');
}finally{await rm(dir,{recursive:true,force:true});}
