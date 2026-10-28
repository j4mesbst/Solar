import type {ToolDefinition} from './toolRegistry.ts';
/** Exact decimal addition of already supplied numbers, not an evaluator and
 * not a parser of untrusted prose. No filesystem, network or code execution. */
export const needsArithmetic=(text:string)=>/calcul|addition|\bsomme\b|\bbudget\b|montant total|total (?:des|de|du)|\bsum\b/i.test(text);
function decimal(value:number){
 if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)throw Error('Valeur numérique non finie ou hors précision sûre.');
 const [coefficient,power='0']=String(value).toLowerCase().split('e');
 const [whole,fraction='']=coefficient.split('.');const scale=fraction.length-Number(power);
 let integer=BigInt(whole+fraction);if(scale<0)integer*=10n**BigInt(-scale);
 return{integer,scale:Math.max(0,scale)};
}
export function computeNumbers(input:unknown,signal:AbortSignal){
 signal.throwIfAborted();const {operation,values}=input as {operation:string;values:number[]};
 if(!['sum','count','min','max'].includes(operation)||!Array.isArray(values)||!values.length||values.length>1000)throw Error('Calcul hors contrat.');
 const numbers=values.map(decimal);let value:string;
 if(operation==='count')value=String(values.length);
 else if(operation==='min'||operation==='max')value=String(operation==='min'?Math.min(...values):Math.max(...values));
 else{const scale=Math.max(...numbers.map(n=>n.scale)),sum=numbers.reduce((n,v)=>n+v.integer*10n**BigInt(scale-v.scale),0n),negative=sum<0n,raw=(negative?-sum:sum).toString().padStart(scale+1,'0');value=(negative?'-':'')+(scale?raw.slice(0,-scale)+'.'+raw.slice(-scale):raw);if(scale)value=value.replace(/0+$/,'').replace(/\.$/,'');}
 return{operation,count:values.length,value,exact:true,note:'Calcul sur les valeurs fournies ; leur correspondance aux sources doit être vérifiée.'};
}
export const gtsComputeTool:ToolDefinition={name:'solar.compute',pluginId:'solar',description:'Calcul local déterministe sur des nombres déjà lus : somme décimale exacte, compte, minimum ou maximum. Recopie toutes les valeurs sources ; ne déduis pas de montant absent. Renvoie value sous forme décimale exacte. Aucun code exécuté.',parameters:{type:'object',properties:{operation:{type:'string',enum:['sum','count','min','max']},values:{type:'array',minItems:1,maxItems:1000,items:{type:'number'}}},required:['operation','values'],additionalProperties:false},permissions:[],risk:'read',externalEffects:false,parallelSafe:true,execute:async(input,signal)=>computeNumbers(input,signal)};
