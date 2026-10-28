import assert from 'node:assert/strict';
import {inspectBuilderSource,builderContext,builderEvidence} from '../src/lib/cortex/builder.ts';
import {engineeringDiagnostics} from '../src/lib/cortex/engineering.ts';
import {compareReference,referenceContext} from '../src/lib/cortex/visual-intelligence.ts';
import {assessMotionContracts,assessVideoMotion,validateMotionContracts,motionGuidance} from '../src/lib/cortex/motion-engine.ts';
import {adaptivePolicy,newModelExperience} from '../src/lib/cortex/adaptive.ts';
import {parseTaskGraph,verifyTaskGraph} from '../src/lib/cortex/task-graph.ts';
import {sourceHash} from '../src/lib/cortex/semantic.ts';
import {assessRender} from '../src/lib/cortex/verification.ts';
import {classifyRepair} from '../src/lib/cortex/repair.ts';

const paths=['src/App.tsx','src/Card.tsx','src/Card.css','package.json'];
const card='import "./Card.css"; export type CardProps={title:string}; export function Card({title}:CardProps){return <article>{title}</article>}';
const app='import {Card} from "./Card"; export default function App(){const state=useState(0);return <Card title="Hello"/>}';
const a=await inspectBuilderSource('src/App.tsx',app,paths),c=await inspectBuilderSource('src/Card.tsx',card,paths);
assert.equal(a.parser,'babel');assert.equal(a.entry,true);assert.equal(a.components[0].name,'App');assert(a.hooks.includes('useState'));
assert.equal(a.imports[0].target,'src/Card.tsx');assert.equal(c.imports[0].target,'src/Card.css');assert(c.exports.includes('Card'));assert(c.types.includes('CardProps'));
assert(builderContext([a,c],1800).includes('src/App.tsx'));
assert.equal((await inspectBuilderSource('src/Card.tsx','export function Card( {',paths)).parser,'unavailable');
const pkg=await inspectBuilderSource('package.json','{"scripts":{"build":"tsc -b","test":"node test.js"}}',paths);assert.equal(pkg.scripts.build,'tsc -b');

const passed=(type,extras={})=>({type,status:'passed',success:true,output:'OK',...extras});
const failed=(type,extras={})=>({type,status:'failed',success:false,output:'Défaut',...extras});
assert.deepEqual(builderEvidence([{path:'src/App.tsx',before:app,after:app+' '}],[passed('syntax'),passed('build'),passed('tests',{category:'functional'}),passed('intent',{origin:'user-requirement'})]),{generated:true,syntaxValid:true,compiled:true,functionallyVerified:true,requestVerified:true});
assert.equal(builderEvidence([], [passed('tests'),failed('tests')]).functionallyVerified,false);
const queue=engineeringDiagnostics([failed('visual',{origin:'vision-advice'}),failed('temporal'),failed('structure'),failed('build')]);
assert.deepEqual(queue.map(x=>x.priority),[0,2,4,5]);assert.equal(queue.at(-1).blocking,false);
const missing=failed('structure',{file:'src/App.tsx',output:'DOM requis : #save.'});
assert.equal(classifyRepair([failed('build',{output:'TS2304: Missing type'}),missing],[]).kind,'tests');
assert.equal(classifyRepair([failed('imports',{file:'src/App.tsx',output:'Import local introuvable : ./Card'}),missing],[]).kind,'imports');
assert.equal(classifyRepair([failed('tests',{category:'functional',output:'Le clic ne sauvegarde pas.'}),missing],[]).kind,'structure','La cible DOM absente est un prérequis du comportement');
assert.equal(classifyRepair([failed('visual',{output:'Couleur'}),missing],[]).kind,'structure');

const base={supported:true,width:640,height:400,errors:[],frames:[]};
const measured={...base,referenceComparison:{aspectCompatible:true,meanError:.12,cells:[{x:0,y:0,width:16,height:10,error:.28},{x:16,y:0,width:16,height:10,error:.04}]}};
assert.equal(compareReference(measured)[0].status,'passed');assert.equal(compareReference(measured,.1)[0].status,'failed');
assert.equal(compareReference({...measured,referenceComparison:{...measured.referenceComparison,aspectCompatible:false}},.1)[0].status,'unavailable');
assert.equal(compareReference(base,.1)[0].status,'unavailable');
assert(referenceContext({width:640,height:400,method:'raster-64x40',palette:[],cells:[]}).includes('pas des composants'));
assert.throws(()=>compareReference(measured,1.2));

const frames=[0,500,1000,1200].map((timestamp,index)=>({timestamp,elements:[{selector:'#box',x:[0,50,100,100][index]}],raster:index===0?[0,0]:[20,20],reducedMotion:false}));
const contract={id:'move',selector:'#box',property:'x',startMs:0,endMs:1000,from:0,to:100,requireMovement:true,settle:true};
assert.equal(assessMotionContracts({...base,frames},[contract])[0].status,'passed');
assert.equal(assessMotionContracts({...base,frames:frames.map(f=>({...f,elements:[{selector:'#box',x:0}]}))},[contract])[0].status,'failed');
assert.equal(assessMotionContracts({...base,frames:frames.slice(0,2)},[contract])[0].status,'unavailable');
assert.equal(assessMotionContracts({...base,frames:frames.map(f=>({...f,reducedMotion:true,elements:[{selector:'#box',x:0}]})),reducedMotionEmulated:true},[{...contract,id:'reduce',from:0,to:0,settle:false,reducedMotion:true}])[0].status,'passed');
assert.equal(assessMotionContracts({...base,frames,reducedMotionEmulated:true},[{...contract,id:'reduce',reducedMotion:true}])[0].status,'unavailable');
assert.throws(()=>validateMotionContracts([contract,contract]));
assert.equal(assessVideoMotion({...base,captureMode:'remotion',frames})[0].status,'passed');
assert.equal(assessRender({...base,captureMode:'remotion',frames},false)[0].status,'failed','Un tableau de pixels sans PNG ne démontre pas un rendu vidéo');
assert.equal(assessVideoMotion({...base,captureMode:'remotion',frames:frames.map(f=>({...f,raster:[0,0]}))})[0].status,'failed');
assert(motionGuidance('GSAP et Remotion',[]).includes('non confirmé'));

const facts={endpoint:'local',modelId:'large',contextWindow:32768,tools:true,vision:true};
const profile=newModelExperience(facts);assert.equal(adaptivePolicy(profile,'deep',16*2**30,facts).maxActions,8);
assert.equal(adaptivePolicy(profile,'deep',4*2**30,facts).maxActions,2);
assert.equal(adaptivePolicy(profile,'deep',16*2**30).maxActions,2);

const graph=parseTaskGraph({steps:[{id:'card',objective:'Créer une carte',files:['src/Card.tsx'],dependsOn:[],criteria:[{id:'build',kind:'check',target:'build'}]},{id:'app',objective:'Relier la carte',files:['src/App.tsx'],dependsOn:['card'],criteria:[{id:'file',kind:'file',target:'src/App.tsx'}]}]});
const project={id:'v5',files:paths,readFile:async p=>p==='src/Card.tsx'?card:app};
let graphChecks=await verifyTaskGraph(graph,[],[passed('build',{file:'src/App.tsx'})],project,new AbortController().signal);
assert.equal(graphChecks[0].status,'failed','Un build attesté pour un autre fichier ne vérifie pas cette étape');
graphChecks=await verifyTaskGraph(graph,[],[passed('build',{file:'src/Card.tsx'})],project,new AbortController().signal);
assert.equal(graphChecks[0].status,'passed');assert.equal(graph.nodes[0].status,'verified');
await verifyTaskGraph(graph,[{path:'src/Card.tsx',before:card,after:card+'\n'}],[passed('build',{file:'src/Card.tsx'})],project,new AbortController().signal);
assert.equal(graph.nodes[0].proof.sources['src/Card.tsx'],sourceHash(card+'\n'));
console.log('Cortex V5 deterministic: builder facts, stage evidence, issue priority, visual observations, motion contracts, capacity policy and graph invalidation — PASS');
