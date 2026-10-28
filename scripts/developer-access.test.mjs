import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};globalThis.window={__TAURI_INTERNALS__:{},dispatchEvent(){}};Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
const dir=await mkdtemp(path.join(tmpdir(),'solar-dev-access-'));
try{
 const bundle=await build({stdin:{contents:`export * from './src/services/solarPlans.ts';export * from './src/services/usage.ts';export * from './src/services/billingState.ts';export * from './src/services/accountScope.ts';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,define:{'import.meta.env':JSON.stringify({VITE_SOLAR_DEVELOPER_ACCOUNT_ID:'fixture-owner'})}});const file=path.join(dir,'test.mjs');await writeFile(file,bundle.outputFiles[0].text);const s=await import(pathToFileURL(file));
 assert.equal(s.developmentAccess('starter'),false);s.initializeAccountScope('someone-else');assert.equal(s.effectiveSolarLimits('starter').weeklyTokens,125000);
 s.initializeAccountScope('fixture-owner');assert.equal(s.developmentAccess('starter'),true);assert.equal(s.verifiedPlan(),'starter');assert.equal(s.effectiveSolarLimits('starter').agents,Infinity);assert.equal(s.effectiveSolarLimits('starter').concurrent,Infinity);
 const q=s.usageSnapshot({version:2,plan:'starter',events:[{id:'spent',at:Date.now(),local:false,solar:true,tokens:9000000}]}).solarWeekly;assert.equal(q.limit,Infinity);assert.equal(q.used,9000000);assert.equal(q.remainingPercent,100);assert.equal(q.remaining,Infinity);
 const r=await s.beginUsage(false,9000000,true);assert.equal(r.reserved,9000000);await r.settle(500000,false);assert.equal(s.readUsage().events[0].tokens,500000);assert.equal(s.readUsage().plan,'starter');
 delete window.__TAURI_INTERNALS__;assert.equal(s.developmentAccess('starter'),false);window.__TAURI_INTERNALS__={};assert.equal(s.developmentAccess('max'),false);assert.equal(s.effectiveSolarLimits('max').concurrent,6);
 s.acceptBillingStatus({plan:'max',status:'active',subscriptionId:'sub_fixture',currentPeriodEnd:Date.now()+3600000,cancelAtPeriodEnd:false},s.currentAccountScope());assert.equal(s.developmentAccess(s.readUsage().plan),false);assert.equal(s.usageSnapshot(s.readUsage()).solarWeekly.limit,6250000);
 s.initializeAccountScope('someone-else');assert.equal(s.effectiveSolarLimits('starter').agents,5);assert.equal(s.readUsage().events.length,0);
 console.log('PASS temporary access: exact native account only; no fake Max; unbounded offer quotas; measured usage retained; web, guest, other accounts excluded; paid billing restores normal caps.');
}finally{await rm(dir,{recursive:true,force:true});}
