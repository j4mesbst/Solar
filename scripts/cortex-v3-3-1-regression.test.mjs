// Deterministic integrations, handwritten inputs, no inference or benchmark campaign.
import assert from 'node:assert/strict';
import { fixtures } from './solar-bench/registry.mjs';
import { validateFixture } from './solar-bench/validators.mjs';
import { render, SOLAR_ROOT } from './solar-bench/webkit.mjs';
const signal=new AbortController().signal;
const wrap=body=>`<!doctype html><html><style>body{margin:0;font:16px system-ui}main{padding:24px}button{margin:8px}textarea{max-width:100%}</style><body>${body}</body></html>`;
const sources={
 'swift-debug':{'Value.swift':'func double(_ x: Int) -> Int { x * 2 }'},
 'swift-safe-average':{'Value.swift':'func average(_ xs: [Double]) -> Double? { xs.isEmpty ? nil : xs.reduce(0,+) / Double(xs.count) }'},
 'js-stable-sort':{'src/value.cjs':'exports.sortByScore=items=>[...items].sort((a,b)=>a.score-b.score);'},
 refactor:{'src/value.cjs':'exports.sumPositive=xs=>xs.filter(x=>x>0).reduce((a,b)=>a+b,0);'},
 'ui-description':{'index.html':wrap('<aside>Navigation</aside><main><textarea></textarea><button>A</button><button>B</button><button>C</button></main>')},
 'ui-tabs':{'index.html':wrap(`<main><button id="tab-one" onclick="document.querySelector('#panel').textContent='Un'">Un</button><button id="tab-two" onclick="document.querySelector('#panel').textContent='Deux'">Deux</button><section id="panel">Un</section></main>`)},
 'ui-chat-interaction':{'index.html':wrap(`<aside>Chat</aside><main><textarea id="message"></textarea><button id="send" onclick="document.querySelector('#last-message').textContent=document.querySelector('#message').value;document.querySelector('#message').value=''">Envoyer</button><p id="last-message"></p></main>`)},
 'motion-complex':{'index.html':wrap('<style>button{animation:appear 400ms ease-out both}button:nth-child(2){animation-delay:40ms}button:nth-child(3){animation-delay:80ms}@keyframes appear{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){button{animation:none}}</style><main><button>A</button><button>B</button><button>C</button></main>')},
};
for(const [id,files] of Object.entries(sources)){
 const fixture=fixtures.find(f=>f.id===id);
 const changes=Object.entries(files).map(([path,after])=>({path,after,before:fixture.files[path]}));
 const checks=await validateFixture(fixture,changes,{signal,render,root:SOLAR_ROOT});
 assert(checks.every(c=>c.status==='passed'),id+JSON.stringify(checks.map(({renderReport,...c})=>c)));
 console.log('non-regression',id,'ok');
}
// JS must see reduced-motion before its first script executes.
const js='<button id="motion">Test</button><script>if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.querySelector("button").animate([{opacity:0},{opacity:1}],{duration:400,fill:"both"})</script>';
const reduced=await render(js,[0,500],signal,undefined,{reducedMotion:true});
assert.deepEqual(reduced.errors,[]);assert(reduced.frames.every(f=>f.elements.find(e=>e.selector==='#motion').opacity===1));
const normal=await render(js,[0,500],signal);assert(normal.frames[0].elements.find(e=>e.selector==='#motion').opacity<.1);assert(normal.frames[1].elements.find(e=>e.selector==='#motion').opacity>.95);
console.log('document-start reduced motion and WAAPI timeline — ok');
const transition='<style>#panel{opacity:0;transform:scale(.94);filter:blur(8px);transition:opacity .4s,transform .4s,filter .4s}#panel.open{opacity:1;transform:scale(1);filter:blur(0)}</style><button id="toggle" onclick="document.querySelector(\'#panel\').classList.toggle(\'open\')">Toggle</button><section id="panel">Panel</section>';
const moved=await render(transition,[0,200,500],signal,undefined,{interactions:[{type:'click',selector:'#toggle'}]});
assert.deepEqual(moved.errors,[]);assert(moved.frames[0].elements.find(e=>e.selector==='#panel').opacity<.1);assert(moved.frames[2].elements.find(e=>e.selector==='#panel').opacity>.95);
const dialog=await render('<button id="open" onclick="document.querySelector(\'dialog\').showModal()">Open</button><dialog><button id="close">Close</button></dialog>',[0],signal,undefined,{interactions:[{type:'click',selector:'#open'}]});
assert.deepEqual(dialog.errors,[]);assert(!dialog.frames[0].telemetry.some(t=>t.issue==='collision'));
console.log('CSS transition trigger/clock and modal hit-layer — ok');
