import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { renderDirectory } from './solar-bench/webkit.mjs';
import { verifyBehavior,effectiveInspection } from '../src/lib/cortex/behavior.ts';

const dir=await mkdtemp('/private/tmp/solar-context-react-');
try{
  await writeFile(join(dir,'index.html'),'<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>');
  await build({stdin:{contents:`import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';function App(){const[ready,setReady]=useState(false),[value,setValue]=useState('Idle');useEffect(()=>{const t=setTimeout(()=>setReady(true),200);return()=>clearTimeout(t)},[]);return <main>{ready&&<button id="activate" onClick={()=>setTimeout(()=>setValue('Ready'),180)}>Activate</button>}<p id="result">{value}</p></main>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,format:'iife',outfile:join(dir,'app.js'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  const scenario={interactions:[{type:'click',selector:'#activate',expect:[{selector:'#result',text:'Ready'}]}]};
  const measured=await renderDirectory(dir,[0],new AbortController().signal,effectiveInspection(scenario));
  assert.equal(measured.errors.length,0,JSON.stringify(measured.errors));assert.equal(measured.interactions[0].success,true);assert.equal(measured.interactions[0].readiness,'observed');assert(measured.interactions[0].waitMs>=100);
  assert(verifyBehavior(measured,scenario).every(check=>check.status==='passed'),JSON.stringify(verifyBehavior(measured,scenario)));
  const missing={interactions:[{type:'click',selector:'#activate',expect:[{selector:'#never-created',text:'Required'}]}]};
  const absent=await renderDirectory(dir,[0],new AbortController().signal,effectiveInspection(missing));
  assert.equal(absent.interactions[0].readiness,'timed-out');assert(verifyBehavior(absent,missing).some(check=>check.type==='structure'&&check.status==='failed'));
  console.log('Cortex pre-V5 real WebKit: async React mounting and state observed conditionally; missing structural target remains FAIL — PASS');
}finally{await rm(dir,{recursive:true,force:true});}
