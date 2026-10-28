import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
const ajv=new Ajv2020({strict:false,allErrors:false,validateFormats:false,ownProperties:true,addUsedSchema:false});
const draft7=new Ajv({strict:false,allErrors:false,validateFormats:false,ownProperties:true,addUsedSchema:false});
const cache=new WeakMap<object,ReturnType<typeof ajv.compile>>();
export function validateToolParameters(value:unknown,schema:Record<string,unknown>):string[]{
 try{
  const text=JSON.stringify(schema);if(text.length>80000||text.includes('"$async":true'))return ["Schéma trop volumineux ou asynchrone non pris en charge."];
  const refs=(item:unknown,depth=0):boolean=>{if(depth>40)return false;if(!item||typeof item!=="object")return true;return Object.entries(item).every(([key,value])=>key==="$ref"?typeof value==="string"&&value.startsWith("#"):refs(value,depth+1));};
  if(!refs(schema))return ["Référence de schéma externe ou profondeur excessive interdite."];
  let validate=cache.get(schema);if(!validate){validate=(JSON.stringify(schema).includes("draft-07") ? draft7 : ajv).compile(schema);cache.set(schema,validate);}
  return validate(value)?[]:(validate.errors??[]).slice(0,3).map(error=>`${error.instancePath||"/"} : ${error.message??"paramètre invalide"}${error.keyword==="required"?` (${String(error.params.missingProperty).slice(0,100)})`:""}`).concat(validate.errors?.length?[]:["Paramètres hors schéma."]);
 }catch{return ["Schéma de l’outil invalide ou non pris en charge."];}
}
