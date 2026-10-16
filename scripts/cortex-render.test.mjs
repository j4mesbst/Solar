import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { assessRender } from '../src/lib/cortex/verification.ts';

if(process.platform!=='darwin'){console.log('cortex-render: skipped (macOS WebKit required)');process.exit(0);}
const dir=await mkdtemp(join(tmpdir(),'solar-cortex-render-test-'));
try {
  const html='<!doctype html><html><head><style>body{margin:0;background:#f6f6f6;color:#202020;font:20px system-ui}main{padding:60px}button{padding:16px 24px;border-radius:24px;border:0;background:#222;color:white;animation:enter 650ms cubic-bezier(.22,1,.36,1) both}@keyframes enter{from{transform:translateY(24px);opacity:0;filter:blur(8px)}to{transform:translateY(0);opacity:1;filter:blur(0)}}</style></head><body><main><h1>Solar Cortex</h1><button data-cortex>Questionnaire</button></main></body></html>';
  const input=join(dir,'input.json');await writeFile(input,JSON.stringify({html,times:[0,80,160,280,420,650,1000]}));
  await new Promise((resolve,reject)=>{const child=spawn('/usr/bin/swift',[new URL('../src-tauri/src/cortex-render.swift',import.meta.url).pathname,input],{stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',chunk=>err+=chunk);const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('WebKit timeout'));},60000);child.on('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(Error(err));});child.on('error',reject);});
  const report=JSON.parse(await readFile(join(dir,'report.json'),'utf8'));assert.equal(report.frames.length,7);assert(report.frames.every(f=>f.image.startsWith('data:image/jpeg;base64,')));assert.deepEqual(report.errors,[]);
  const checks=assessRender(report,true);assert(checks.every(c=>c.status==='passed'),JSON.stringify(checks));
  const button=report.frames.map(f=>f.elements.find(e=>e.selector.startsWith('button')));assert(button[0].opacity<button.at(-1).opacity);assert(button[0].y>button.at(-1).y);
  console.log('cortex-render: ok (7 real WebKit screenshots, geometry, opacity, transform, filter, temporal assessment)');
}finally{await rm(dir,{recursive:true,force:true});}
