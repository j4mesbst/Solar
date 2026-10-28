// Deterministic reference and counterexample validation. No model or network.
import assert from 'node:assert/strict';
import {advancedFixtures,selectFixtures} from './solar-bench/registry.mjs';
import {advancedContracts} from './solar-bench/advanced-private.mjs';
import {validateAdvancedFixture} from './solar-bench/advanced-validator.mjs';
import {scoreChecks} from './solar-bench/scoring.mjs';
import {SOLAR_ROOT} from './solar-bench/webkit.mjs';

assert.equal(advancedFixtures.length,10);
assert.deepEqual(selectFixtures({preset:'advanced'}).map(item=>item.id),advancedFixtures.map(item=>item.id));
assert.equal(selectFixtures({fixture:'advanced-react-dashboard'})[0].id,'advanced-react-dashboard');
assert.equal(selectFixtures({domain:'remotion'}).length,2);
assert.equal(new Set(advancedFixtures.map(item=>item.id)).size,10);
assert.deepEqual(Object.keys(advancedContracts).sort(),advancedFixtures.map(item=>item.id).sort());
for(const fixture of advancedFixtures){assert.equal(fixture.preset,'advanced');assert(!JSON.stringify(fixture).includes('referenceThreshold'));const criteria=advancedContracts[fixture.id].criteria;assert(criteria.length>=7);assert.equal(new Set(criteria.map(item=>item.id)).size,criteria.length);}
const unavailable=scoreChecks([{criterionId:'a',status:'passed'}],[{id:'a',dimension:'functionality',points:10,label:'A'},{id:'b',dimension:'visual',points:10,label:'B'}]);
assert.equal(unavailable.quality,undefined);assert.equal(unavailable.dimensions.visual.score,undefined);

const signal=new AbortController().signal;
const byId=id=>advancedFixtures.find(item=>item.id===id);
const validate=(id,files)=>validateAdvancedFixture(byId(id),Object.entries(files).map(([path,after])=>({path,after})),{signal,root:SOLAR_ROOT});

const dashboard=`import{useMemo,useState}from'react';
const clients=[{name:'Mina',status:'active'},{name:'Noah',status:'paused'},{name:'Léa',status:'active'}];
function Metric({label,value}:{label:string;value:string}){return <article className="metric"><span>{label}</span><strong>{value}</strong></article>}
export default function App(){const[view,setView]=useState('overview');const[q,setQ]=useState('');const[status,setStatus]=useState('all');const rows=useMemo(()=>clients.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())&&(status==='all'||c.status===status)),[q,status]);const title=view==='clients'?'Clients':view==='activity'?'Activité':'Vue d’ensemble';return <div className="shell"><nav><button id="nav-overview" onClick={()=>setView('overview')}>Vue d’ensemble</button><button id="nav-clients" onClick={()=>setView('clients')}>Clients</button><button id="nav-activity" onClick={()=>setView('activity')}>Activité</button></nav><main><h1 id="page-title">{title}</h1><section className="metrics"><Metric label="Revenu" value="84k €"/><Metric label="Clients" value="3"/></section>{view==='clients'&&<><input id="search" aria-label="Rechercher" value={q} onChange={e=>setQ(e.target.value)}/><select id="status-filter" aria-label="Statut" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tous</option><option value="active">Actifs</option><option value="paused">Pause</option></select><div id="results">{rows.map(c=><span key={c.name}>{c.name}</span>)}</div></>}</main></div>}`;
const dashboardCss=`*{box-sizing:border-box}body{margin:0;font-family:system-ui}.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}nav{padding:24px;background:#172033;display:flex;flex-direction:column;gap:10px}nav button{padding:12px;color:white;background:#2d3850;border:0;border-radius:10px}main{padding:32px}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.metric{padding:20px;border:1px solid #ddd;border-radius:16px}.metric strong,.metric span,#results span{display:block}input,select{padding:12px;margin:20px 10px 10px 0}@media(max-width:600px){.shell{display:block}nav{flex-direction:row;overflow:auto}main{padding:18px}.metrics{grid-template-columns:1fr}}`;
const dashboardGood=await validate('advanced-react-dashboard',{'src/App.tsx':dashboard,'src/styles.css':dashboardCss});
assert(dashboardGood.checks.find(item=>item.criterionId==='navigation')?.status==='passed',JSON.stringify(dashboardGood.checks));
assert(dashboardGood.checks.find(item=>item.criterionId==='responsive')?.status==='passed');
const dashboardBad=await validate('advanced-react-dashboard',{'src/App.tsx':'export default function App(){return <main>vide</main>}'});
assert(dashboardBad.checks.some(item=>item.status==='failed'));

const responsive=`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui}#app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}#sidebar{background:#172033;color:white;padding:24px;width:240px}#content{padding:24px}#team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{border:1px solid #ddd;border-radius:14px;padding:20px}#mobile-nav{display:none}dialog{border:0;border-radius:16px}@media(max-width:600px){#app{display:block}#sidebar{display:none}#content{padding:16px}#team-grid{grid-template-columns:1fr}#mobile-nav{display:block}}</style></head><body><div id="app"><aside id="sidebar">Équipe</aside><main id="content"><button id="mobile-nav">Menu</button><button id="invite" onclick="document.querySelector('#invite-dialog').showModal()">Inviter</button><section id="team-grid"><article class="card">Mina</article><article class="card">Noah</article><article class="card">Léa</article></section><dialog id="invite-dialog"><p>Invitation</p><button id="close-dialog" onclick="this.closest('dialog').close()">Fermer</button></dialog></main></div></body></html>`;
const responsiveGood=await validate('advanced-responsive-interface',{'index.html':responsive});
assert(responsiveGood.checks.find(item=>item.criterionId==='dialog')?.status==='passed',JSON.stringify(responsiveGood.checks));
assert(responsiveGood.checks.find(item=>item.criterionId==='mobile')?.status==='passed');

const gsap=`import{gsap}from'gsap';import'./style.css';document.querySelector('#app').innerHTML='<main><p id="eyebrow">Nouveau</p><h1 id="hero-title">Solar Motion</h1><p id="hero-copy">Une timeline coordonnée</p><button id="primary-action">Découvrir</button><section><article id="f1" class="feature">Rapide</article><article id="f2" class="feature">Précis</article><article id="f3" class="feature">Fiable</article></section></main>';const nodes=['#eyebrow','#hero-title','#hero-copy','#primary-action','.feature'];if(matchMedia('(prefers-reduced-motion: reduce)').matches){gsap.set(nodes,{opacity:1,y:0});window.__cortexGsapTimeline=gsap.timeline({paused:true});}else{const tl=gsap.timeline({paused:true});tl.fromTo('#eyebrow',{opacity:0,y:24},{opacity:1,y:0,duration:.35}).fromTo('#hero-title',{opacity:0,y:34},{opacity:1,y:0,duration:.45},'<+.12').fromTo('#hero-copy',{opacity:0,y:28},{opacity:1,y:0,duration:.4},'<+.12').fromTo('#primary-action',{opacity:0,y:22},{opacity:1,y:0,duration:.35},'<+.12').fromTo('.feature',{opacity:0,y:30},{opacity:1,y:0,duration:.45,stagger:.12},'<+.1');window.__cortexGsapTimeline=tl;}`;
const gsapCss=`body{margin:0;font-family:system-ui;background:#101728;color:white}main{padding:80px}h1{font-size:64px}section{display:flex;gap:16px}.feature{padding:24px;background:#27334a;border-radius:16px}`;
const gsapGood=await validate('advanced-gsap-timeline',{'src/main.js':gsap,'src/style.css':gsapCss});
assert(gsapGood.checks.find(item=>item.criterionId==='timeline')?.status==='passed',JSON.stringify(gsapGood.checks));
assert(gsapGood.checks.find(item=>item.criterionId==='movement')?.status==='passed',JSON.stringify(gsapGood.checks));

const remotion=`import React from'react';import{AbsoluteFill,Composition,Easing,Sequence,interpolate,registerRoot,useCurrentFrame}from'remotion';const Scene=()=>{const f=useCurrentFrame();const x=interpolate(f,[0,75,150,225,299],[-180,0,180,0,-80],{easing:Easing.inOut(Easing.cubic)});const opacity=interpolate(f,[0,20,245,275],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <AbsoluteFill style={{background:f<100?'#172033':f<210?'#f4b63e':'#f4f6f9',color:f<100?'white':'#172033',alignItems:'center',justifyContent:'center'}}><Sequence from={0} durationInFrames={100}><h1 style={{fontSize:110,transform:\`translateX(\${x}px)\`,opacity}}>Imagine</h1></Sequence><Sequence from={100} durationInFrames={110}><h1 style={{fontSize:100,transform:\`scale(\${interpolate(f,[100,210],[.6,1.2])})\`}}>Build faster</h1></Sequence><Sequence from={210} durationInFrames={90}><h1 style={{fontSize:82,opacity}}>Powered by Solar Cortex</h1></Sequence></AbsoluteFill>};const Root=()=> <Composition id="SolarAd" component={Scene} durationInFrames={300} fps={30} width={1920} height={1080}/>;registerRoot(Root);`;
const remotionGood=await validate('advanced-remotion-ad',{'src/index.tsx':remotion});
const remotionBuild=remotionGood.checks.find(item=>item.criterionId==='build');
assert(['passed','unavailable'].includes(remotionBuild?.status),JSON.stringify(remotionGood.checks));
if(remotionBuild.status==='passed'){assert(remotionGood.checks.find(item=>item.criterionId==='metadata')?.status==='passed');assert(remotionGood.checks.find(item=>item.criterionId==='ending')?.status==='passed');}

console.log('solar-bench advanced: 10 isolated definitions, scoring exclusions, React/WebKit/GSAP/Remotion reference acceptance and counterexample rejection — ok');
