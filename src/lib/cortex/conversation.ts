/** Source-linked user requirements, not a model's recollection. Whole messages
 * only; an oversized mandatory history is reported rather than silently cut. */
export function conversationRequirements(messages:{id:string;role:string;content:string;supersedes?:string[]}[]){
  const unique=new Set<string>(),entries:string[]=[];
  // Only source-linked, explicit application/user supersession may retire an
  // old turn. A model summary cannot silently decide an obligation is obsolete.
  const retired=new Set<string>();
  for(let index=0;index<messages.length;index++){const message=messages[index];if(message.role==='user')for(const id of message.supersedes??[])if(messages.slice(0,index).some(previous=>previous.role==='user'&&previous.id===id))retired.add(id);}
  for(const message of messages){if(message.role!=='user'||retired.has(message.id)||!message.content.trim()||unique.has(message.content))continue;unique.add(message.content);entries.push(`[message ${message.id}] ${message.content}`);}
  return entries.length?`EXIGENCES DES TOURS PRÉCÉDENTS (citations utilisateur; la demande courante prévaut en cas de changement explicite)\n${entries.join('\n\n')}`:'';
}
/** Exact duplicate paragraphs only; code fences are kept intact. No LLM,
 * paraphrase, inferred expiry, or deletion of a distinct user constraint. */
export function compactRequirements(text:string){
  if(text.includes('```'))return text;
  const seen=new Set<string>();return text.split(/\n{2,}/).filter(part=>{if(seen.has(part))return false;seen.add(part);return true;}).join('\n\n');
}
