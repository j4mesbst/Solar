import { scopedKey } from "./accountScope.ts";
export interface PersonalExtension {id:string; kind:"plugins"|"skills"; name:string; content:string; enabled:boolean}
const key=scopedKey("solar.personal-extensions.v1");
const native=()=>Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
let queue=Promise.resolve();
export async function listPersonalExtensions():Promise<PersonalExtension[]> {
  await queue;
  if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(scopedKey("solar.personal")+".json",{defaults:{},autoSave:false});return await store.get<PersonalExtension[]>(key)??[];}
  return JSON.parse(localStorage.getItem(key)??"[]");
}
export function savePersonalExtensions(items:PersonalExtension[]) {
  const task=queue.then(async()=>{if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(scopedKey("solar.personal")+".json",{defaults:{},autoSave:false});await store.set(key,items);await store.save();}else localStorage.setItem(key,JSON.stringify(items));});queue=task.catch(()=>{});return task;
}
export async function personalSkillInstruction() {
  return (await listPersonalExtensions()).filter(x=>x.kind==="skills"&&x.enabled).slice(0,8).map(x=>`\nCompétence ajoutée par l’utilisateur : ${x.name}\n${x.content.slice(0,16000)}`).join("").slice(0,64000);
}
export function validatePersonalExtension(kind:PersonalExtension["kind"],name:string,content:string):PersonalExtension {
  if(!name.trim()||name.length>80)throw new Error("Donne un nom de 1 à 80 caractères.");
  if(kind==="plugins"){const url=new URL(content);if(url.protocol!=="https:"||url.username||url.password)throw new Error("Utilise une adresse HTTPS sans identifiants.");content=url.href;}
  else if(!content.trim()||content.length>16000)throw new Error("Le skill doit contenir des instructions, au maximum 16 000 caractères.");
  return {id:crypto.randomUUID(),kind,name:name.trim(),content:content.trim(),enabled:kind==="skills"};
}
