import assert from 'node:assert/strict';
import { builtinSkills, skillApplies, responseGuidance } from '../src/services/builtinSkills.ts';
assert.equal(builtinSkills.length,6);assert.equal(new Set(builtinSkills.map(s=>s.id)).size,6);
for(const skill of builtinSkills){assert(skill.content.length>200&&skill.content.length<1600);assert(skill.description.length>20)}
assert(skillApplies('solar:artifact-pro',{text:'Un diaporama',artifact:true}));assert(!skillApplies('solar:artifact-pro',{text:'Bonjour'}));
assert(skillApplies('solar:code-max',{text:'Bonjour',workMode:true}));assert(skillApplies('solar:code-max',{text:'Corrige ce bug React'}));assert(!skillApplies('solar:code-max',{text:'Bonjour'}));
assert(skillApplies('solar:data-analyst',{text:'Calcule ce pourcentage'}));assert(skillApplies('custom',{text:'Bonjour'}));
assert(responseGuidance(true).includes('tests réellement exécutés'));assert(responseGuidance(false).includes('incertitude'));
globalThis.window={};let stored=[];globalThis.localStorage={getItem:key=>key.includes('personal-extensions')?JSON.stringify(stored):null,setItem:(key,value)=>{stored=JSON.parse(value)}};
const {personalSkillInstruction,savePersonalExtensions}=await import('../src/services/personalExtensions.ts');
stored=builtinSkills.map(s=>({...s,kind:'skills',enabled:true}));
assert.equal(await personalSkillInstruction({text:'Bonjour'}),'');
let instruction=await personalSkillInstruction({text:'Corrige un bug React'});assert(instruction.includes('Code Max'));assert(!instruction.includes('Artefact Pro'));
await savePersonalExtensions(stored.map(s=>({...s,enabled:false})));assert.equal(await personalSkillInstruction({text:'Corrige ce code',workMode:true}),'');
console.log('skills-contracts: ok (six scoped instructions, custom compatibility, enabled/disabled persistence, no irrelevant prompts)');
