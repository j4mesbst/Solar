/** Inspect structured pagination/partial flags only. External prose is never
 * interpreted as a control instruction. Unknown pages stay visible to the LLM. */
export function incompleteEvidence(value:unknown,depth=0):boolean{
 if(depth>12||!value||typeof value!=='object')return false;
 if(Array.isArray(value))return value.some(item=>incompleteEvidence(item,depth+1));
 return Object.entries(value).some(([key,item])=>
  (['partial','hasNextPage','truncated'].includes(key)&&item===true)||
  (['nextPageToken','nextCursor','@odata.nextLink'].includes(key)&&typeof item==='string'&&item.length>0)||
  incompleteEvidence(item,depth+1));
}
export function incompleteToolResult(text:string){
 if(text==='[not retained]')return true;
 try{return incompleteEvidence(JSON.parse(text));}catch{return false;}
}
