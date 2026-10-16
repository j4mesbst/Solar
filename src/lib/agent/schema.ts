/** Small local validator for the JSON Schema subset emitted by Cortex. No
 * repair/coercion: an unsupported contract fails closed before staging. */
export function validateSchema(value:unknown,schema:unknown,path='$'):string[]{
  const s=schema as Record<string,any>;if(!s||typeof s!=='object')return [`${path}: schéma invalide`];
  const supported=new Set(['type','oneOf','anyOf','const','enum','minLength','maxLength','minimum','maximum','minItems','maxItems','items','minProperties','maxProperties','required','properties','additionalProperties','description','title','$schema']);
  if(Object.keys(s).some(key=>!supported.has(key)))return [`${path}: mot-clé de schéma non pris en charge; validation refusée`];
  const errors:string[]=[];
  if(s.oneOf&&s.oneOf.filter((branch:unknown)=>!validateSchema(value,branch,path).length).length!==1)errors.push(`${path}: une seule variante d’action doit correspondre`);
  if(s.anyOf&&!s.anyOf.some((branch:unknown)=>!validateSchema(value,branch,path).length))errors.push(`${path}: champ attendu absent`);
  if(s.const!==undefined&&value!==s.const)errors.push(`${path}: valeur constante attendue`);
  if(s.enum&&!s.enum.includes(value))errors.push(`${path}: valeur non autorisée`);
  if(s.type){const valid=s.type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):s.type==='array'?Array.isArray(value):s.type==='integer'?Number.isInteger(value):s.type==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===s.type;if(!valid)return [...errors,`${path}: type ${s.type} requis`];}
  if(typeof value==='string'&&(s.minLength!==undefined&&value.length<s.minLength||s.maxLength!==undefined&&value.length>s.maxLength))errors.push(`${path}: longueur hors limites`);
  if(typeof value==='number'&&(s.minimum!==undefined&&value<s.minimum||s.maximum!==undefined&&value>s.maximum))errors.push(`${path}: nombre hors limites`);
  if(Array.isArray(value)){if(s.minItems!==undefined&&value.length<s.minItems||s.maxItems!==undefined&&value.length>s.maxItems)errors.push(`${path}: nombre d’éléments hors limites`);if(s.items)value.forEach((item,i)=>errors.push(...validateSchema(item,s.items,`${path}[${i}]`)));}
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    const object=value as Record<string,unknown>,keys=Object.keys(object);
    if(s.minProperties!==undefined&&keys.length<s.minProperties||s.maxProperties!==undefined&&keys.length>s.maxProperties)errors.push(`${path}: propriétés hors limites`);
    for(const key of s.required??[])if(!Object.hasOwn(object,key))errors.push(`${path}.${key}: champ requis`);
    for(const key of keys){if(s.properties?.[key])errors.push(...validateSchema(object[key],s.properties[key],`${path}.${key}`));else if(s.additionalProperties===false)errors.push(`${path}.${key}: champ interdit`);else if(s.additionalProperties&&typeof s.additionalProperties==='object')errors.push(...validateSchema(object[key],s.additionalProperties,`${path}.${key}`));}
  }
  return errors;
}
export function validateActionEnvelope(raw:string,schema:unknown){
  const value=JSON.parse(raw.trim().replace(/^```json\s*\n([\s\S]*?)\n```$/i,'$1'));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('CORTEX_ACTION_FORMAT: objet d’actions requis.');
  // A model suggestion is validated separately and cannot poison file edits.
  const {validation:_suggestion,...actions}=value;
  const contract=structuredClone(schema) as Record<string,any>;
  if(contract.properties)delete contract.properties.validation;
  contract.required=(contract.required??[]).filter((key:string)=>key!=='validation');
  const issues=validateSchema(actions,contract);if(issues.length)throw Error(`CORTEX_ACTION_FORMAT: ${issues.slice(0,4).join('; ')}. replaceFile exige content; patchFile exige oldText et newText. Aucun champ n’est converti.`);
}
