import type { AgentVisualValidation, DomExpectation } from './types.ts';

const selectorSchema={type:'string',minLength:1,maxLength:160};
const expectationSchema={type:'object',minProperties:2,properties:{selector:selectorSchema,text:{type:'string',maxLength:500},value:{type:'string',maxLength:500},visible:{type:'boolean'},attribute:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:60},value:{type:'string',maxLength:200},present:{type:'boolean'}},required:['name'],anyOf:[{required:['value']},{required:['present']}],additionalProperties:false},style:{type:'object',minProperties:1,maxProperties:8,additionalProperties:{type:'string',maxLength:200}}},required:['selector'],additionalProperties:false};
const interaction=(type:'click'|'fill',required=false)=>({type:'object',properties:{selector:selectorSchema,type:{type:'string',const:type},...(type==='fill'?{value:{type:'string',maxLength:1000}}:{}),expect:{type:'array',...(required?{minItems:1,maxItems:2}:{maxItems:8}),items:expectationSchema}},required:['selector','type',...(type==='fill'?['value']:[]),...(required?['expect']:[])],additionalProperties:false});
export const visualValidationSchema={type:'object',properties:{interactions:{type:'array',maxItems:8,items:{oneOf:[interaction('click'),interaction('fill')]}},expectations:{type:'array',maxItems:12,items:expectationSchema},timeline:{type:'array',minItems:1,maxItems:12,items:{type:'number',minimum:0,maximum:10000}},reducedMotion:{type:'boolean'}},additionalProperties:false};
export const requiredVisualValidationSchema={...visualValidationSchema,required:['interactions'],properties:{...visualValidationSchema.properties,interactions:{type:'array',minItems:1,maxItems:2,items:{oneOf:[interaction('click',true),interaction('fill',true)]}}}};
const selector=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[\n\r\0]/.test(value);
function expectation(value:unknown):DomExpectation{
  const e=value as DomExpectation;
  if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(key=>!['selector','text','value','visible','attribute','style'].includes(key))||!selector(e.selector))throw Error('Attente DOM invalide.');
  if(e.text===undefined&&e.value===undefined&&e.visible===undefined&&e.attribute===undefined&&e.style===undefined)throw Error('Une attente DOM doit préciser le comportement attendu.');
  if(e.text!==undefined&&(typeof e.text!=='string'||e.text.length>500)||e.value!==undefined&&(typeof e.value!=='string'||e.value.length>500)||e.visible!==undefined&&typeof e.visible!=='boolean')throw Error('Valeur DOM attendue invalide.');
  if(e.attribute!==undefined){const a=e.attribute;if(!a||typeof a!=='object'||Object.keys(a).some(k=>!['name','value','present'].includes(k))||!/^[-\w]{1,60}$/.test(a.name)||a.value===undefined&&a.present===undefined||a.value!==undefined&&(typeof a.value!=='string'||a.value.length>200)||a.present!==undefined&&typeof a.present!=='boolean'||a.present===false&&a.value!==undefined)throw Error('Attribut DOM attendu invalide. Utilise present pour la présence, value pour une chaîne exacte.');}
  if(e.style!==undefined&&(!e.style||typeof e.style!=='object'||Array.isArray(e.style)||!Object.keys(e.style).length||Object.keys(e.style).length>8||Object.entries(e.style).some(([k,v])=>!/^[-a-zA-Z]{1,60}$/.test(k)||typeof v!=='string'||v.length>200)))throw Error('Style observé invalide.');
  return structuredClone(e);
}
export function parseVisualValidation(value:unknown):AgentVisualValidation{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['interactions','expectations','timeline','reducedMotion'].includes(key)))throw Error('Contrat de validation visuelle invalide.');
  if(JSON.stringify(value).length>14_000)throw Error('Contrat de validation visuelle trop volumineux.');
  const v=value as AgentVisualValidation;
  if(v.interactions!==undefined&&(!Array.isArray(v.interactions)||v.interactions.length>8))throw Error('Trop d’interactions.');
  const interactions=v.interactions?.map(action=>{
    if(!action||!selector(action.selector)||!['click','fill'].includes(action.type)||Object.keys(action).some(key=>!['selector','type','value','expect'].includes(key))||action.value!==undefined&&(typeof action.value!=='string'||action.value.length>1000)||action.expect!==undefined&&(!Array.isArray(action.expect)||action.expect.length>8))throw Error('Interaction hors limites.');
    if(action.type==='click'&&action.value!==undefined)throw Error('value est réservé à fill. Un clic ne simule pas une touche clavier.');
    if(action.type==='fill'&&action.value===undefined)throw Error('Une saisie fill doit préciser value.');
    return {...action,...(action.expect?{expect:action.expect.map(expectation)}:{})};
  });
  if(v.expectations!==undefined&&(!Array.isArray(v.expectations)||v.expectations.length>12))throw Error('Trop d’attentes DOM.');
  if(v.timeline!==undefined&&(!Array.isArray(v.timeline)||!v.timeline.length||v.timeline.length>12||v.timeline.some(time=>!Number.isFinite(time)||time<0||time>10000)))throw Error('Timeline hors limites.');
  if(v.reducedMotion!==undefined&&typeof v.reducedMotion!=='boolean')throw Error('Préférence mouvement réduit invalide.');
  const expectations=v.expectations?.map(expectation);
  const targets=new Set([...(expectations??[]).map(e=>e.selector),...(interactions??[]).flatMap(action=>(action.expect??[]).map(e=>e.selector))]);
  if(targets.size>24)throw Error('Trop de cibles DOM distinctes dans le scénario.');
  return {...v,...(interactions?{interactions}:{}),...(expectations?{expectations}:{})};
}
