import fs from 'node:fs';
/** Only test persistence; production native store is SQLite. */
export function fileJobBackend(filename){
 const read=()=>fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):{};
 return {async list(owner){return Object.values(read()).filter(j=>j.ownerId===owner);},async get(owner,id){return structuredClone(read()[owner+':'+id]);},async cas(owner,id,expected,value,event){const data=read(),key=owner+':'+id,old=data[key];if((old?.revision??0)!==expected)return;const revision=expected+1,at=new Date().toISOString(),next={...structuredClone(value),revision,updatedAt:at,checkpoint:{...value.checkpoint,revision},events:[...(old?.events??[]),{seq:revision,at,...event}]};data[key]=next;const temp=filename+'.tmp';fs.writeFileSync(temp,JSON.stringify(data));fs.renameSync(temp,filename);return structuredClone(next);}};
}
