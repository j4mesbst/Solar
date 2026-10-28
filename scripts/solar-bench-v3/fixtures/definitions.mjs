const pkg = name => ({
  'package.json': JSON.stringify({ name: `solar-bench-v3-${name}`, private: true, type: 'module', scripts: { test: 'node public-test.mjs' } }, null, 2),
});

const task = (id, title, difficulty, prompt, files, solution, meta = {}) => Object.freeze({
  id, title, difficulty, prompt, files: Object.freeze({ ...pkg(id), ...files }), solution: Object.freeze(solution),
  publicCommand: 'npm test', version: 1, ...meta,
});

export const fixtures = Object.freeze([
  task('01-broken-react', 'Broken React Recovery', 2,
    'Répare le projet React/TypeScript. Conserve le compteur, rends la suppression fiable, utilise des clés stables et corrige les imports. Lance npm test et n’enlève aucune fonctionnalité.', {
      'src/types.ts': 'export type Task={id:string;label:string;done:boolean}\n',
      'src/state.ts': `import type {Task} from './types.ts';\nexport const seed:Task[]=[{id:'a',label:'Audit',done:false},{id:'b',label:'Build',done:false}];\nexport function removeTask(items:Task[],id:string){return items.filter((_,index)=>String(index)!==id)}\nexport function increment(value:number){return value--}\n`,
      'src/TaskList.tsx': `import Task from './types';\nexport function TaskList({items,onRemove}:{items:Task[];onRemove:(id:string)=>void}){return <ul>{items.map((item,index)=><li key={index}>{item.label}<button onClick={()=>onRemove(String(index))}>Supprimer</button></li>)}</ul>}\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {seed,removeTask,increment} from './src/state.ts';assert.equal(increment(1),2);assert.deepEqual(removeTask(seed,'a').map(x=>x.id),['b']);console.log('public ok');\n`,
    }, {
      'src/state.ts': `import type {Task} from './types.ts';\nexport const seed:Task[]=[{id:'a',label:'Audit',done:false},{id:'b',label:'Build',done:false}];\nexport function removeTask(items:Task[],id:string){return items.filter(item=>item.id!==id)}\nexport function increment(value:number){return value+1}\n`,
      'src/TaskList.tsx': `import type {Task} from './types';\nexport function TaskList({items,onRemove}:{items:Task[];onRemove:(id:string)=>void}){return <ul>{items.map(item=><li key={item.id}>{item.label}<button onClick={()=>onRemove(item.id)}>Supprimer</button></li>)}</ul>}\n`,
    }, { category: 'recovery' }),

  task('02-multifile-refactor', 'Multifile Refactor', 3,
    'Fais évoluer Product avec currency (EUR ou USD), ajoute formatPrice(product), et adapte tous les producteurs et consommateurs. Les données existantes doivent rester intactes. Lance npm test.', {
      'src/types.ts': `export type Product={id:string;name:string;price:number}\n`,
      'src/data.ts': `import type {Product} from './types.ts';export const products:Product[]=[{id:'p1',name:'Solar Mug',price:18},{id:'p2',name:'Solar Tee',price:32}];\n`,
      'src/format.ts': `import type {Product} from './types.ts';export const label=(p:Product)=>p.name+' · '+p.price;\n`,
      'src/filter.ts': `import type {Product} from './types.ts';export const affordable=(xs:Product[])=>xs.filter(x=>x.price<30);\n`,
      'src/summary.ts': `import type {Product} from './types.ts';export const total=(xs:Product[])=>xs.reduce((n,x)=>n+x.price,0);\n`,
      'src/index.ts': `export {products} from './data.ts';export {label} from './format.ts';export {affordable} from './filter.ts';export {total} from './summary.ts';\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {products,label,affordable,total} from './src/index.ts';assert.equal(products.length,2);assert.match(label(products[0]),/18/);assert.equal(affordable(products).length,1);assert.equal(total(products),50);console.log('public ok');\n`,
    }, {
      'src/types.ts': `export type Currency='EUR'|'USD';export type Product={id:string;name:string;price:number;currency:Currency}\n`,
      'src/data.ts': `import type {Product} from './types.ts';export const products:Product[]=[{id:'p1',name:'Solar Mug',price:18,currency:'EUR'},{id:'p2',name:'Solar Tee',price:32,currency:'EUR'}];\n`,
      'src/format.ts': `import type {Product} from './types.ts';export const formatPrice=(p:Product)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:p.currency}).format(p.price);export const label=(p:Product)=>p.name+' · '+formatPrice(p);\n`,
      'src/index.ts': `export {products} from './data.ts';export {label,formatPrice} from './format.ts';export {affordable} from './filter.ts';export {total} from './summary.ts';\n`,
    }, { category: 'refactor', minFiles: 5 }),

  task('03-feature-integration', 'Complex Feature Integration', 4,
    'Ajoute les favoris de bout en bout : type favorite, action toggleFavorite immuable, filtre favorites, résumé et export public. Préserve recherche et données, puis lance npm test.', {
      'src/types.ts': `export type Note={id:string;title:string;body:string}\n`,
      'src/data.ts': `import type {Note} from './types.ts';export const notes:Note[]=[{id:'1',title:'Alpha',body:'one'},{id:'2',title:'Beta',body:'two'}];\n`,
      'src/store.ts': `import type {Note} from './types.ts';export const rename=(xs:Note[],id:string,title:string)=>xs.map(x=>x.id===id?{...x,title}:x);\n`,
      'src/query.ts': `import type {Note} from './types.ts';export const search=(xs:Note[],q:string)=>xs.filter(x=>x.title.toLowerCase().includes(q.toLowerCase()));\n`,
      'src/index.ts': `export * from './data.ts';export * from './store.ts';export * from './query.ts';\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {notes,search,rename} from './src/index.ts';assert.equal(search(notes,'alp')[0].id,'1');assert.equal(rename(notes,'1','A')[0].title,'A');console.log('public ok');\n`,
    }, {
      'src/types.ts': `export type Note={id:string;title:string;body:string;favorite:boolean}\n`,
      'src/data.ts': `import type {Note} from './types.ts';export const notes:Note[]=[{id:'1',title:'Alpha',body:'one',favorite:false},{id:'2',title:'Beta',body:'two',favorite:false}];\n`,
      'src/store.ts': `import type {Note} from './types.ts';export const rename=(xs:Note[],id:string,title:string)=>xs.map(x=>x.id===id?{...x,title}:x);export const toggleFavorite=(xs:Note[],id:string)=>xs.map(x=>x.id===id?{...x,favorite:!x.favorite}:x);\n`,
      'src/query.ts': `import type {Note} from './types.ts';export const search=(xs:Note[],q:string)=>xs.filter(x=>x.title.toLowerCase().includes(q.toLowerCase()));export const favorites=(xs:Note[])=>xs.filter(x=>x.favorite);\n`,
      'src/summary.ts': `import type {Note} from './types.ts';export const summary=(xs:Note[])=>({total:xs.length,favorites:xs.filter(x=>x.favorite).length});\n`,
      'src/index.ts': `export * from './data.ts';export * from './store.ts';export * from './query.ts';export * from './summary.ts';\n`,
    }, { category: 'feature' }),

  task('04-phased-task', 'Phased Task', 4,
    'Réalise dans cet ordre : (1) modèle Invoice avec statut, (2) calcul des totaux et transition draft→sent→paid, (3) rapport groupé. Les IDs et montants initiaux sont immuables. Lance npm test après chaque phase si ton harnais le permet.', {
      'src/model.ts': `export type Invoice={id:string;amount:number}\nexport const invoices:Invoice[]=[{id:'i1',amount:20},{id:'i2',amount:30}];\n`,
      'src/workflow.ts': `export const total=(xs:{amount:number}[])=>xs.reduce((n,x)=>n+x.amount,0);\n`,
      'src/report.ts': `export const report=(xs:{amount:number}[])=>({count:xs.length,total:xs.reduce((n,x)=>n+x.amount,0)});\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {invoices} from './src/model.ts';import {total} from './src/workflow.ts';assert.equal(total(invoices),50);console.log('public ok');\n`,
    }, {
      'src/model.ts': `export type Status='draft'|'sent'|'paid';export type Invoice={id:string;amount:number;status:Status};export const invoices:Invoice[]=[{id:'i1',amount:20,status:'draft'},{id:'i2',amount:30,status:'draft'}];\n`,
      'src/workflow.ts': `import type {Invoice,Status} from './model.ts';export const total=(xs:Invoice[])=>xs.reduce((n,x)=>n+x.amount,0);const next:Record<Status,Status>={draft:'sent',sent:'paid',paid:'paid'};export const advance=(x:Invoice):Invoice=>({...x,status:next[x.status]});\n`,
      'src/report.ts': `import type {Invoice,Status} from './model.ts';export const report=(xs:Invoice[])=>({count:xs.length,total:xs.reduce((n,x)=>n+x.amount,0),byStatus:Object.fromEntries((['draft','sent','paid'] as Status[]).map(s=>[s,xs.filter(x=>x.status===s).length]))});\n`,
    }, { category: 'planning', modes: ['continuous', 'phase-boundaries', 'human-supervised-separate'] }),

  task('05-non-regression', 'Non-Regression Repair', 2,
    'Corrige uniquement la sélection par ID après tri. Préserve les IDs DOM, les événements add/remove/select et la structure des objets. Lance npm test.', {
      'src/list.ts': `export const items=[{id:'z',label:'Zulu'},{id:'a',label:'Alpha'}];export const sortItems=xs=>[...xs].sort((a,b)=>a.label.localeCompare(b.label));export const select=(xs,id)=>xs[Number(id)];export const add=(xs,item)=>[...xs,item];export const remove=(xs,id)=>xs.filter(x=>x.id!==id);\n`,
      'src/view.html': `<main id="app"><button id="add">Ajouter</button><ul id="items"></ul><output id="selection"></output></main>\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {items,sortItems,add,remove} from './src/list.ts';assert.equal(sortItems(items)[0].id,'a');assert.equal(add(items,{id:'b',label:'Beta'}).length,3);assert.equal(remove(items,'z')[0].id,'a');console.log('public ok');\n`,
    }, { 'src/list.ts': `export const items=[{id:'z',label:'Zulu'},{id:'a',label:'Alpha'}];export const sortItems=xs=>[...xs].sort((a,b)=>a.label.localeCompare(b.label));export const select=(xs,id)=>xs.find(x=>x.id===id);export const add=(xs,item)=>[...xs,item];export const remove=(xs,id)=>xs.filter(x=>x.id!==id);\n` }, { category: 'regression' }),

  task('06-diagnosis-to-fix', 'Diagnosis-to-Fix', 3,
    'Le test reproduit une erreur de cache asynchrone : deux clés différentes se contaminent. Diagnostique avec npm test, corrige la cause sans désactiver le cache, puis valide.', {
      'src/cache.ts': `let cached;export async function memo(key,load){if(cached)return cached;cached=await load(key);return cached}export function clear(){cached=undefined}\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {memo,clear} from './src/cache.ts';clear();assert.equal(await memo('a',async k=>k.toUpperCase()),'A');assert.equal(await memo('b',async k=>k.toUpperCase()),'B','cache leaked across keys');console.log('public ok');\n`,
    }, { 'src/cache.ts': `const cache=new Map();export async function memo(key,load){if(cache.has(key))return cache.get(key);const pending=Promise.resolve(load(key));cache.set(key,pending);try{return await pending}catch(error){cache.delete(key);throw error}}export function clear(){cache.clear()}\n` }, { category: 'diagnosis' }),

  task('07-large-context', 'Large Context and Logs', 4,
    'À partir des logs, corrige le calcul de timezone dans src/time.ts. Ne modifie ni les logs ni les autres modules. Les offsets négatifs et positifs doivent fonctionner. Lance npm test.', {
      'src/time.ts': `export function localHour(utcHour,offsetMinutes){return (utcHour+offsetMinutes)%24}\n`,
      'src/parser.ts': `export const parseLine=line=>Object.fromEntries(line.split(' ').map(x=>x.split('=')));\n`,
      'src/report.ts': `export const summarize=rows=>({count:rows.length,errors:rows.filter(x=>x.level==='ERROR').length});\n`,
      'logs/server.log': Array.from({length:450},(_,i)=>`ts=2026-10-20T${String(i%24).padStart(2,'0')}:00:00Z level=${i===327?'ERROR':'INFO'} request=r${i} offset=-300`).join('\n')+'\n',
      'public-test.mjs': `import assert from 'node:assert/strict';import {localHour} from './src/time.ts';assert.equal(localHour(12,120),14);assert.equal(localHour(2,-300),21);console.log('public ok');\n`,
    }, { 'src/time.ts': `export function localHour(utcHour,offsetMinutes){return ((utcHour+offsetMinutes/60)%24+24)%24}\n` }, { category: 'context' }),

  task('08-api-recovery', 'Hallucinated API Recovery', 3,
    'Le projet utilise la mini-bibliothèque locale SolarDate v2. Corrige l’appel inexistant en consultant docs/API.md et les exports réels. Aucun symbole non documenté. Lance npm test.', {
      'vendor/solar-date/index.ts': `export const formatIso=(date:Date)=>date.toISOString().slice(0,10);export const addDays=(date:Date,n:number)=>new Date(date.getTime()+n*86400000);\n`,
      'docs/API.md': `# SolarDate v2\nExports publics : formatIso(date), addDays(date, days). L'ancien formatDate n'existe plus.\n`,
      'src/deadline.ts': `import {formatDate,addDays} from '../vendor/solar-date/index.ts';export const deadline=(iso:string,days:number)=>formatDate(addDays(new Date(iso),days));\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {deadline} from './src/deadline.ts';assert.equal(deadline('2026-10-01T00:00:00Z',3),'2026-10-04');console.log('public ok');\n`,
    }, { 'src/deadline.ts': `import {formatIso,addDays} from '../vendor/solar-date/index.ts';export const deadline=(iso:string,days:number)=>formatIso(addDays(new Date(iso),days));\n` }, { category: 'api' }),

  task('09-responsive-ui', 'Responsive React Interface', 5,
    'Construis l’interface responsive dans src/App.tsx et src/styles.css : navigation, cartes réutilisables, recherche, filtre, dialogue accessible, grille desktop et pile mobile. Préserve le thème clair/sombre et lance npm test.', {
      'src/App.tsx': `export function App(){return <main><h1>Catalogue</h1></main>}\n`,
      'src/styles.css': `:root{color-scheme:light dark}body{margin:0;font-family:system-ui}\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';const a=await readFile('src/App.tsx','utf8'),c=await readFile('src/styles.css','utf8');for(const x of ['nav','dialog','input'])assert.match(a,new RegExp('<'+x));assert.match(c,/@media/);assert.match(c,/grid/);console.log('public ok');\n`,
    }, {
      'src/App.tsx': `import {useMemo,useState} from 'react';const cards=['Mercury','Venus','Earth'];export function Card({name}:{name:string}){return <article><h2>{name}</h2><button type="button">Détails</button></article>}export function App(){const [q,setQ]=useState(''),[open,setOpen]=useState(false);const shown=useMemo(()=>cards.filter(x=>x.toLowerCase().includes(q.toLowerCase())),[q]);return <><nav aria-label="Principale"><strong>Solar</strong></nav><main><h1>Catalogue</h1><input aria-label="Rechercher" value={q} onChange={e=>setQ(e.target.value)}/><select aria-label="Filtrer"><option>Tous</option></select><section className="grid">{shown.map(x=><Card key={x} name={x}/>)}</section><button onClick={()=>setOpen(true)}>Aide</button><dialog open={open}><h2>Aide</h2><button onClick={()=>setOpen(false)}>Fermer</button></dialog></main></>};\n`,
      'src/styles.css': `:root{color-scheme:light dark}body{margin:0;font-family:system-ui}nav,main{padding:1rem}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}article{border:1px solid currentColor;padding:1rem}@media(max-width:640px){.grid{grid-template-columns:1fr}nav{position:sticky;top:0}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}\n`,
    }, { category: 'ui', visual: true }),

  task('10-long-context', 'Long-Running Context Continuity', 5,
    'Étapes liées : ajoute les rôles owner/editor/viewer, canEdit, invite sans doublon, audit en français et export CSV. Contraintes globales à préserver : IDs en minuscules, fonctions immuables, séparateur CSV point-virgule, aucun Date.now, messages français. Lance npm test.', {
      'src/types.ts': `export type Member={id:string;name:string}\n`,
      'src/access.ts': `export const canView=()=>true;\n`,
      'src/team.ts': `export const invite=(xs,member)=>[...xs,member];\n`,
      'src/audit.ts': `export const audit=(action,id)=>action+':'+id;\n`,
      'src/csv.ts': `export const csv=xs=>xs.map(x=>x.id+','+x.name).join('\\n');\n`,
      'src/index.ts': `export * from './access.ts';export * from './team.ts';export * from './audit.ts';export * from './csv.ts';\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {invite} from './src/team.ts';const a=[{id:'a',name:'Ana'}];assert.equal(invite(a,{id:'b',name:'Bob'}).length,2);assert.equal(a.length,1);console.log('public ok');\n`,
    }, {
      'src/types.ts': `export type Role='owner'|'editor'|'viewer';export type Member={id:string;name:string;role:Role}\n`,
      'src/access.ts': `import type {Member} from './types.ts';export const canView=()=>true;export const canEdit=(m:Member)=>m.role==='owner'||m.role==='editor';\n`,
      'src/team.ts': `import type {Member} from './types.ts';export const invite=(xs:Member[],member:Member)=>xs.some(x=>x.id===member.id)?xs:[...xs,{...member,id:member.id.toLowerCase()}];\n`,
      'src/audit.ts': `export const audit=(action:string,id:string)=>\`Action \${action} pour \${id}\`;\n`,
      'src/csv.ts': `import type {Member} from './types.ts';export const csv=(xs:Member[])=>['id;nom;rôle',...xs.map(x=>[x.id,x.name,x.role].join(';'))].join('\\n');\n`,
    }, { category: 'continuity' }),

  task('11-tool-loop', 'Tool Loop Recovery', 4,
    'npm test répète le même diagnostic tant que normalize ne gère pas les espaces Unicode et la casse turque de façon déterministe. Obtiens une nouvelle preuve, corrige utilement ou déclare le blocage ; ne modifie pas le test.', {
      'src/normalize.ts': `export const normalize=value=>value.trim().toLowerCase();\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {normalize} from './src/normalize.ts';assert.equal(normalize('  SOLAR CODE  '),'solar code');assert.equal(normalize('İSTANBUL'),'istanbul');console.log('public ok');\n`,
    }, { 'src/normalize.ts': `export const normalize=value=>value.normalize('NFKD').replace(/\\u0307/g,'').replace(/[\\s\\u00a0]+/gu,' ').trim().toLocaleLowerCase('en-US');\n` }, { category: 'recovery-loop' }),

  task('12-multilingual', 'Multilingual Real Project', 3,
    'Ajoute el resumen mensual demandé : documentation anglaise, commentaires espagnols et identifiants existants restent inchangés. La sortie est en français, sans traduire calcularTotal ni registros. Lance npm test.', {
      'docs/contract.md': `# Report contract\nGroup records by YYYY-MM and preserve insertion order. Return an array of {month,total,label}.\n`,
      'src/reporte.ts': `// Suma importes sin mutar los registros\nexport const calcularTotal=(registros)=>registros.reduce((n,x)=>n+x.importe,0);\n`,
      'src/index.ts': `export {calcularTotal} from './reporte.ts';\n`,
      'public-test.mjs': `import assert from 'node:assert/strict';import {calcularTotal} from './src/index.ts';assert.equal(calcularTotal([{importe:2},{importe:3}]),5);console.log('public ok');\n`,
    }, {
      'src/reporte.ts': `// Suma importes sin mutar los registros\nexport const calcularTotal=(registros)=>registros.reduce((n,x)=>n+x.importe,0);export const resumenMensual=(registros)=>{const meses=new Map();for(const registro of registros){const mes=registro.fecha.slice(0,7);meses.set(mes,(meses.get(mes)??0)+registro.importe)}return [...meses].map(([month,total])=>({month,total,label:\`Total \${month} : \${total}\`}))};\n`,
      'src/index.ts': `export {calcularTotal,resumenMensual} from './reporte.ts';\n`,
    }, { category: 'multilingual' }),
]);

export const pilotIds = Object.freeze(['01-broken-react', '02-multifile-refactor', '06-diagnosis-to-fix', '10-long-context']);
export const fixtureById = id => fixtures.find(item => item.id === id);
