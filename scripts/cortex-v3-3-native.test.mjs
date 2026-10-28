// Technical integration only: handwritten sources, no model, no benchmark run.
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { render,renderDirectory,SOLAR_ROOT } from './solar-bench/webkit.mjs';
import { createProgressStore } from './solar-bench/progress-store.mjs';
const exec=promisify(execFile),signal=new AbortController().signal;
const dir=await mkdtemp('/private/tmp/cortex-v33-technical-');
try{
  const publish=createProgressStore([join(dir,'progress.json')],{runId:'technical'});
  publish({type:'start',total:25,completed:3,passed:2,failed:1,fixtureId:'example'});publish({type:'tick',elapsedMs:1000});await publish.flush();
  const state=JSON.parse(await readFile(join(dir,'progress.json'),'utf8'));assert.equal(state.total,25);assert.equal(state.passed,2);assert.equal(state.elapsedMs,1000);
  const html='<html><style>body{margin:0}#panel{width:200px;height:80px;opacity:0;transform:scale(.94);filter:blur(8px)}#panel.open{animation:enter 400ms ease-out both}@keyframes enter{from{opacity:0;transform:scale(.94);filter:blur(8px)}to{opacity:1;transform:scale(1);filter:blur(0)}}@media(prefers-reduced-motion:reduce){#panel.open{animation:none;opacity:1;transform:none;filter:none}}</style><button id="toggle" onclick="document.querySelector(\'#panel\').classList.toggle(\'open\')">Open</button><section id="panel">Panel</section></html>';
  const options={interactions:[{type:'click',selector:'#toggle'}],viewport:{width:390,height:844}};
  const motion=await render(html,[0,100,200,400,650],signal,undefined,options);assert.equal(motion.width,390);assert.deepEqual(motion.errors,[]);assert.equal(motion.interactions[0].success,true);
  const frames=motion.frames.map(f=>f.elements.find(e=>e.selector==='#panel'));assert(frames[0].opacity<.1);assert(frames.at(-1).opacity>.95);assert.notEqual(frames[0].filter,frames.at(-1).filter);
  const reduced=await render(html,[0,650],signal,undefined,{...options,reducedMotion:true});assert.deepEqual(reduced.errors,[]);assert.equal(reduced.frames[0].elements.find(e=>e.selector==='#panel').opacity,1);assert.equal(reduced.frames.at(-1).elements.find(e=>e.selector==='#panel').opacity,1);
  await mkdir(join(dir,'src'));await symlink(join(SOLAR_ROOT,'node_modules'),join(dir,'node_modules'),'dir');
  await writeFile(join(dir,'package.json'),'{"type":"module","scripts":{"build":"vite build"}}');
  await writeFile(join(dir,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>');
  await writeFile(join(dir,'src/main.jsx'),'import React from "react";import{createRoot}from"react-dom/client";function App(){const [value,set]=React.useState(0);return <main><h1>Built React</h1><button id="add" onClick={()=>set(value+1)}>Add</button><p id="count">{value}</p></main>}createRoot(document.getElementById("root")).render(<App/>);');
  await exec(join(SOLAR_ROOT,'node_modules/.bin/vite'),['build'],{cwd:dir,timeout:30_000});
  const react=await renderDirectory(join(dir,'dist'),[0],signal,{interactions:[{type:'click',selector:'#add'}]});assert.deepEqual(react.errors,[]);assert.equal(react.frames[0].elements.find(e=>e.selector==='#count')?.text,'1');
  console.log('cortex-v3.3-native: atomic monitor snapshots, real WebKit click/scale/opacity/blur, narrow viewport, reduced motion, Vite assets + React interaction — ok');
}finally{await rm(dir,{recursive:true,force:true});}
