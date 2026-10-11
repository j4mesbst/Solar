import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {validateArtifact,exportArtifact,artifactInstruction} from '../src/services/artifacts.ts';
const slides=[{title:'Énergie solaire',body:'Du soleil à la prise.'},{title:'Trois étapes',body:'Une conversion progressive.',visual:{type:'process',items:[{label:'Capter',detail:'Les cellules captent la lumière.'},{label:'Convertir',detail:'L’onduleur transforme le courant.'},{label:'Utiliser',detail:'Les appareils reçoivent l’énergie.'}]}},{title:'Comparaison fournie',body:'Valeurs du jeu de données de test.',visual:{type:'chart',unit:'kWh',items:[{label:'Janvier',value:12},{label:'Février',value:24},{label:'Mars',value:18}]}},{title:'Deux leviers',body:'Des concepts avec une hiérarchie.',visual:{type:'cards',items:[{label:'Conception',detail:'Une structure lisible.'},{label:'Export',detail:'Des éléments éditables.'}]}},{title:'Indicateurs fournis',body:'Mesures du jeu de test.',visual:{type:'metrics',items:[{label:'Fichiers',display:'3',detail:'Sources fournies.'},{label:'Slides',display:'5',detail:'Un contenu final.'}]}}];
const a=validateArtifact({kind:'slides',title:'Démo visuelle',slides},'test');assert.equal(a.slides[2].visual.items[1].value,24);
assert.throws(()=>validateArtifact({kind:'slides',title:'Invalide',slides:[{title:'Test',body:'Test',visual:{type:'chart',items:[{label:'a',value:NaN},{label:'b',value:1}]}}]},'t'),/Valeur/);
assert.throws(()=>validateArtifact({kind:'slides',title:'Invalide',slides:[{title:'Test',body:'Test',visual:{type:'html',items:[]}}]},'t'),/Visuel/);
const blob=await exportArtifact(a,'pptx'),zip=await JSZip.loadAsync(await blob.arrayBuffer());
assert.equal(Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).length,5);
const chart=await zip.file('ppt/charts/chart1.xml').async('string');assert(chart.includes('Février')&&chart.includes('<c:v>24</c:v>'));
const process=await zip.file('ppt/slides/slide2.xml').async('string');assert(process.includes('Capter'));assert((process.match(/<p:sp>/g)||[]).length>10);
assert(artifactInstruction('slides').includes('éditables'));assert.equal(zip.file('ppt/media/image1.png'),null);
// Dense decks must retain every editable text box inside its corresponding card.
const dense=validateArtifact({kind:'slides',title:'Six indicateurs',slides:[{title:'Indicateurs',body:'Données fournies',visual:{type:'metrics',items:Array.from({length:6},(_,i)=>({label:`Mesure ${i+1}`,display:String(i+1),detail:`Détail ${i+1}`}))}}]},'dense');
const denseZip=await JSZip.loadAsync(await (await exportArtifact(dense,'pptx')).arrayBuffer()),xml=await denseZip.file('ppt/slides/slide1.xml').async('string');
const shapes=xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g)??[];
const bounds=shape=>{const off=shape.match(/<a:off x="(\d+)" y="(\d+)"/),ext=shape.match(/<a:ext cx="(\d+)" cy="(\d+)"/);return off&&ext?{x:+off[1],y:+off[2],w:+ext[1],h:+ext[2]}:null;};
const cards=shapes.filter(s=>s.includes('prst="roundRect"')).map(bounds).filter(Boolean);assert.equal(cards.length,6);
for(let i=1;i<=6;i++){const b=bounds(shapes.find(s=>s.includes(`Détail ${i}`)));assert(b);assert(cards.some(c=>b.x>=c.x&&b.y>=c.y&&b.x+b.w<=c.x+c.w+2&&b.y+b.h<=c.y+c.h+2),'Detail overflow in a six-card slide');}
console.log('visual-slides: ok (validated schema, editable charts/shapes, five-slide PPTX, no flattened screenshot)');
