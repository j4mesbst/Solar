/** Names describe an identity, never a task. Atlas is reserved for the manager. */
export const AGENT_NAMES=['Milo','Nova','Luma','Elio','Nora','Lina','Theo','Jules','Robin','Sacha','Clara','Oscar','Felix','Alice','Louis','Simon','Hugo','Lucas','Nolan','Milan','Noemi','Sofia','Chloe','Aaron','Elias','Gabriel','Samuel','Julian','Ethan','Leonie'] as const;
export const isAgentName=(value:string)=>/^[\p{L}]{4,7}$/u.test(value)&&!['atlas','veille','github','agenda','emails','projet','taches'].includes(value.toLocaleLowerCase());
export function agentName(value:string,used:Set<string>){
 const candidate=value.trim();
 const name=isAgentName(candidate)&&!used.has(candidate.toLocaleLowerCase())?candidate:AGENT_NAMES.find(n=>!used.has(n.toLocaleLowerCase()));
 if(!name)throw Error('Choisis un prénom court disponible pour ce nouvel agent.');
 used.add(name.toLocaleLowerCase());return name;
}
