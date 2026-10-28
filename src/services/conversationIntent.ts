/** Recognise only a self-contained social greeting. A greeting followed by a
 * real request must retain the normal agent/tool path; no classifier LLM call. */
export function isSocialGreeting(text:string,agentName='Atlas'){
 const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,' ').replace(/[!?.,;:\u{1F44B}\u{1F600}-\u{1F64F}]/gu,' ').replace(/[-\s]+/g,' ').trim();
 const value=normalize(text),name=normalize(agentName);
 if(!value||value.length>140)return false;
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const greeting='(?:salut|bonjour|bonsoir|coucou|hello|hey|hi|yo|bon matin)';
 const checkIn='(?:comment (?:ca va|vas tu|allez vous|tu vas)|ca va(?: bien)?|tu vas bien|how are you)';
 const addressee=escaped?`(?: ${escaped})?`:'';
 return new RegExp(`^(?:${greeting}${addressee}(?: ${checkIn})?|${checkIn}${addressee})$`,'u').test(value);
}
