import { skillApplies, type SkillTask } from "./builtinSkills.ts";
import { routeSkills, solarSkills } from "./skillEngine.ts";
import { scopedKey } from "./accountScope.ts";
export interface PersonalExtension {id:string; kind:"plugins"|"skills"; name:string; content:string; enabled:boolean}
const key=scopedKey("solar.personal-extensions.v1");
const native=()=>Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
let queue=Promise.resolve();
let cachedItems:PersonalExtension[]|null=null;
export async function listPersonalExtensions():Promise<PersonalExtension[]> {
  if(cachedItems)return cachedItems;
  await queue;
  if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(scopedKey("solar.personal")+".json",{defaults:{},autoSave:false});const items=await store.get<PersonalExtension[]>(key)??[];cachedItems=items;return items;}
  const items=JSON.parse(localStorage.getItem(key)??"[]") as PersonalExtension[];cachedItems=items;return items;
}
export function savePersonalExtensions(items:PersonalExtension[]) {
  const task=queue.then(async()=>{if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(scopedKey("solar.personal")+".json",{defaults:{},autoSave:false});await store.set(key,items);await store.save();}else localStorage.setItem(key,JSON.stringify(items));cachedItems=items;});queue=task.catch(()=>{});return task;
}
export async function personalSkillInstruction(task?: SkillTask & { skillsMode?:"auto"|"manual"; manualSkillIds?:string[] }) {
  const extensions=await listPersonalExtensions();
  const route=routeSkills({prompt:task?.text??"",conversationContext:task?.conversationContext,workMode:task?.workMode,artifact:task?.artifact,attachments:task?.attachments,modelName:task?.modelName,providerProtocol:task?.providerProtocol,skillsMode:task?.skillsMode,manualSkillIds:task?.manualSkillIds});
  const disabled=new Set(extensions.filter(item=>item.kind==="skills"&&!item.enabled).map(item=>item.id));
  const selected=route.selected.filter(item=>!disabled.has(item.skill.id));
  let instruction=selected.map(item=>`\n[Skill Solar · ${item.skill.name}]\nSélectionné pour : ${item.reason}.\n${item.injectedContent}`).join("\n");
  const bundledIds=new Set(solarSkills.map(skill=>skill.id));
  const custom=extensions.filter(item=>item.kind==="skills"&&item.enabled&&!bundledIds.has(item.id)&&skillApplies(item.id,task)).slice(0,8);
  for(const item of custom){const available=route.budget-instruction.length-item.name.length-32;if(available<200)break;instruction+=`\n[Skill personnel · ${item.name}]\n${item.content.slice(0,Math.min(available,task?.providerProtocol==="ollama"?1600:5000))}`;}
  return instruction.slice(0,route.budget);
}
export function validatePersonalExtension(kind:PersonalExtension["kind"],name:string,content:string):PersonalExtension {
  if(!name.trim()||name.length>80)throw new Error("Donne un nom de 1 à 80 caractères.");
  if(kind==="plugins"){const url=new URL(content);if(url.protocol!=="https:"||url.username||url.password)throw new Error("Utilise une adresse HTTPS sans identifiants.");content=url.href;}
  else if(!content.trim()||content.length>16000)throw new Error("Le skill doit contenir des instructions, au maximum 16 000 caractères.");
  return {id:crypto.randomUUID(),kind,name:name.trim(),content:content.trim(),enabled:kind==="skills"};
}
