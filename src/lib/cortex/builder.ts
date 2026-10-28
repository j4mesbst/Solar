import type { AgentFileChange } from '../agent/types.ts';
import type { CortexVerification } from './types.ts';
import { importMode, resolveLocalImport } from '../agent/module-resolution.ts';
import { sourceHash } from './semantic.ts';

export interface BuilderFacts {
  path:string; hash:string; parser:'babel'|'unavailable';
  entry:boolean; components:{name:string;props:string[];uses:string[]}[];
  hooks:string[]; types:string[]; exports:string[]; imports:{source:string;names:string[];target?:string}[];
  scripts:Record<string,string>; diagnostics:string[];
}
const cache=new Map<string,BuilderFacts>();
const identifier=(node:any):string=>node?.type==='Identifier'?node.name:node?.type==='StringLiteral'?node.value:'';
const jsxName=(node:any):string=>node?.type==='JSXIdentifier'?node.name:node?.type==='JSXMemberExpression'?`${jsxName(node.object)}.${jsxName(node.property)}`:'';
function walk(node:any,visit:(node:any)=>void){
  if(!node||typeof node!=='object')return;
  visit(node);
  for(const [key,value] of Object.entries(node))if(!['loc','start','end','comments','tokens'].includes(key)){
    if(Array.isArray(value))value.forEach(item=>walk(item,visit));else if(value&&typeof value==='object')walk(value,visit);
  }
}
/** Source observations only: JSX usage is not evidence of a mounted component. */
export async function inspectBuilderSource(path:string,source:string,paths:string[]):Promise<BuilderFacts> {
  const hash=sourceHash(source),key=`${path}:${hash}:${sourceHash(paths.join('\n'))}`;
  const cached=cache.get(key);if(cached)return structuredClone(cached);
  const facts:BuilderFacts={path,hash,parser:'unavailable',entry:/(?:^|\/)(?:main|index|App|Root)\.[jt]sx?$/.test(path),components:[],hooks:[],types:[],exports:[],imports:[],scripts:{},diagnostics:[]};
  if(path==='package.json'){
    try{const pkg=JSON.parse(source);for(const [key,value] of Object.entries(pkg.scripts??{}))if(typeof value==='string')facts.scripts[key]=value.slice(0,180);}catch{facts.diagnostics.push('Manifest JSON invalide.');}
  }else if(/\.[cm]?[jt]sx?$/i.test(path)&&source.length<=300_000){
    try{
      const {parse}=await import('@babel/parser');
      const ast=parse(source,{sourceType:'unambiguous',plugins:['typescript','jsx','decorators-legacy']});facts.parser='babel';
      walk(ast.program,node=>{
        if(node.type==='ImportDeclaration')facts.imports.push({source:node.source.value,names:node.specifiers.map((s:any)=>identifier(s.imported)||s.local?.name).filter(Boolean),target:resolveLocalImport(path,node.source.value,paths,importMode(path,source.slice(node.start,node.end))).target});
        if(['TSInterfaceDeclaration','TSTypeAliasDeclaration'].includes(node.type))facts.types.push(node.id.name);
        if(node.type==='CallExpression'&&/^use[A-Z]/.test(identifier(node.callee)))facts.hooks.push(identifier(node.callee));
        if(node.type==='ExportNamedDeclaration'){
          if(node.declaration?.id)facts.exports.push(identifier(node.declaration.id));
          for(const declaration of node.declaration?.declarations??[])facts.exports.push(identifier(declaration.id));
          for(const spec of node.specifiers??[])facts.exports.push(identifier(spec.exported));
        }
        if(node.type==='ExportDefaultDeclaration')facts.exports.push('default');
        const name=node.type==='FunctionDeclaration'?identifier(node.id):node.type==='VariableDeclarator'?identifier(node.id):'';
        const body=node.type==='VariableDeclarator'?node.init:node;
        if(!/^[A-Z]/.test(name)||!body)return;
        const uses=new Set<string>();walk(body,(child:any)=>{if(child.type==='JSXOpeningElement')uses.add(jsxName(child.name));});
        if(!uses.size)return;
        const first=body.params?.[0];
        const props=first?.type==='ObjectPattern'?first.properties.map((p:any)=>identifier(p.key)).filter(Boolean):first?.type==='Identifier'?[`${first.name}${first.typeAnnotation?.typeAnnotation?.typeName?.name?':'+first.typeAnnotation.typeAnnotation.typeName.name:''}`]:[];
        facts.components.push({name,props,uses:[...uses].filter(Boolean).slice(0,16)});
      });
    }catch(error){facts.diagnostics.push(String(error).slice(0,200));}
  }
  facts.hooks=[...new Set(facts.hooks)].slice(0,20);facts.types=[...new Set(facts.types)].slice(0,20);facts.exports=[...new Set(facts.exports)].filter(Boolean).slice(0,30);facts.imports=facts.imports.slice(0,40);facts.components=facts.components.slice(0,16);
  cache.set(key,structuredClone(facts));while(cache.size>160)cache.delete(cache.keys().next().value!);
  return facts;
}
export function builderContext(facts:BuilderFacts[],maximum=1800){
  let result='PROJET REACT/TS (AST, pas preuve de fonctionnement)\n';
  for(const fact of facts){
    const consumers=facts.filter(other=>other.imports.some(item=>item.target===fact.path)).map(other=>other.path);
    const line=JSON.stringify({path:fact.path,entry:fact.entry||undefined,components:fact.components.length?fact.components:undefined,hooks:fact.hooks.length?fact.hooks:undefined,types:fact.types.length?fact.types:undefined,exports:fact.exports.length?fact.exports:undefined,dependencies:fact.imports.filter(item=>item.target).map(item=>item.target),consumers,scripts:Object.keys(fact.scripts).length?fact.scripts:undefined});
    if(result.length+line.length+1>maximum)continue;result+=line+'\n';
  }
  return result;
}
export function builderEvidence(changes:AgentFileChange[],checks:CortexVerification[]){
  const passed=(type:string)=>checks.some(check=>check.type===type&&check.hardConstraint!==false)&&checks.filter(check=>check.type===type&&check.hardConstraint!==false).every(check=>check.status==='passed');
  return {generated:changes.length>0,syntaxValid:passed('syntax'),compiled:passed('build'),functionallyVerified:checks.some(check=>check.hardConstraint!==false&&check.origin!=='model-suggestion'&&check.status==='passed'&&(check.type==='tests'||check.category==='functional'))&&!checks.some(check=>check.hardConstraint!==false&&check.status!=='passed'&&(check.type==='tests'||check.category==='functional')),requestVerified:checks.some(check=>check.origin==='user-requirement'&&check.hardConstraint!==false)&&checks.filter(check=>check.origin==='user-requirement'&&check.hardConstraint!==false).every(check=>check.status==='passed')};
}
