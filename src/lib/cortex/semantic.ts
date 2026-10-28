import { safeProjectPath } from "../agent/actions.ts";
import type { AgentProject, AgentFileChange } from "../agent/types.ts";

export interface CodeSymbol { id: string; path: string; name: string; kind: string; start: number; end: number; hash: string; startOffset?:number; endOffset?:number; editable:boolean }
export interface SemanticSnapshot { parser: "babel" | "structural-fallback"; hash: string; symbols: CodeSymbol[]; imports: string[]; diagnostics: string[] }
export function sourceHash(text: string) { let hash=2166136261; for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619); return (hash>>>0).toString(16); }
const cache = new Map<string, SemanticSnapshot>();
let parserModule:typeof import("@babel/parser")|undefined;
export async function initializeSemantic(){parserModule??=await import("@babel/parser");}
/** Ignore JSX presentation attributes using their real AST ranges. This is a
 * repair guard only; it never supplies evidence that a node was rendered. */
export function withoutJsxPresentation(source:string){
  if(!parserModule)return source;
  try{
    const ast=parserModule.parse(source,{sourceType:'unambiguous',plugins:['typescript','jsx']});
    const ranges:{start:number;end:number}[]=[];
    const walk=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      const node=value as Record<string,any>;
      if(node.type==='JSXAttribute'&&['style','className','class'].includes(node.name?.name)){ranges.push({start:node.start,end:node.end});return;}
      for(const [key,child] of Object.entries(node))if(!['loc','start','end','comments','tokens'].includes(key)){
        if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child);
      }
    };
    walk(ast.program);
    let result=source;for(const range of ranges.sort((a,b)=>b.start-a.start))result=result.slice(0,range.start)+result.slice(range.end);
    return result;
  }catch{return source;}
}
/** Real JS/TS/TSX AST; Swift/Rust keep a named conservative fallback. */
export function semanticSource(path: string, text: string): SemanticSnapshot {
  const hash=sourceHash(text), cached=cache.get(path); if(cached?.hash===hash&&(!parserModule||cached.parser==="babel"||!/\.[cm]?[jt]sx?$/.test(path)))return cached;
  const symbols:CodeSymbol[]=[],imports:string[]=[],diagnostics:string[]=[];
  const add=(name:string,kind:string,start:number,end:number,startOffset?:number,endOffset?:number)=>symbols.push({id:`${path}:${start}-${end}#${hash}`,path,name,kind,start,end,hash,startOffset,endOffset,editable:startOffset!==undefined&&endOffset!==undefined});
  let parser:SemanticSnapshot["parser"]="structural-fallback";
  if(/\.[cm]?[jt]sx?$/.test(path)&&parserModule) {
    parser="babel";
    try {
      const ast=parserModule.parse(text,{sourceType:"unambiguous",plugins:["typescript","jsx","decorators-legacy"]});
      const walk=(value:unknown,parent?:Record<string,any>,grandparent?:Record<string,any>):void=>{
        if(!value||typeof value!=="object")return;
        const node=value as Record<string,any>;
        if(["FunctionDeclaration","ClassDeclaration","TSInterfaceDeclaration","TSTypeAliasDeclaration","VariableDeclarator"].includes(node.type)&&node.id?.type==="Identifier"&&node.loc){
          const declaration=node.type==="VariableDeclarator"?parent:node;
          const container=node.type==="VariableDeclarator"?grandparent:parent;
          const range=container?.type==="ExportNamedDeclaration"||container?.type==="ExportDefaultDeclaration"?container:declaration;
          const safe=node.type!=="VariableDeclarator"||parent?.declarations?.length===1;
          add(node.id.name,node.type,node.loc.start.line,node.loc.end.line,safe?range?.start:undefined,safe?range?.end:undefined);
        }
        if(node.type==="AssignmentExpression"&&node.left?.type==="MemberExpression"&&node.loc){
          const standalone=node.operator==='='&&parent?.type==='ExpressionStatement'&&grandparent?.type==='Program';
          if(node.left.object?.name==="exports"&&!node.left.computed&&node.left.property?.name)add(node.left.property.name,"CommonJSExport",node.loc.start.line,node.loc.end.line,standalone?parent.start:undefined,standalone?parent.end:undefined);
          if(node.left.object?.name==="module"&&!node.left.computed&&node.left.property?.name==="exports"&&node.right?.type==="ObjectExpression")for(const prop of node.right.properties??[])if(!prop.computed&&prop.key?.name&&prop.loc)add(prop.key.name,"CommonJSExport",prop.loc.start.line,prop.loc.end.line,standalone?prop.start:undefined,standalone?prop.end:undefined);
        }
        if((node.type==="ImportDeclaration"||node.type==="ExportNamedDeclaration"||node.type==="ExportAllDeclaration")&&node.source)imports.push(node.source.value);
        if(node.type==="CallExpression"&&node.callee?.name==="require"&&typeof node.arguments?.[0]?.value==="string")imports.push(node.arguments[0].value);
        for(const [key,child] of Object.entries(node)){if(["loc","start","end","tokens","comments"].includes(key))continue;if(Array.isArray(child))child.forEach(item=>walk(item,node,parent));else if(child&&typeof child==="object")walk(child,node,parent);}
      };walk(ast.program);
    }catch(error){diagnostics.push(error instanceof Error?error.message:String(error));}
  } else {
    text.split("\n").forEach((line,index)=>{const match=line.match(/\b(func|fn|struct|enum|class)\s+([\w$]+)/);if(match)add(match[2],match[1],index+1,index+1);});
  }
  const result={parser,hash,symbols:symbols.slice(0,160),imports:[...new Set(imports)],diagnostics}; cache.set(path,result);
  while(cache.size>300)cache.delete(cache.keys().next().value!);return result;
}
export async function findSymbols(query:string,project:AgentProject,changes:AgentFileChange[],signal:AbortSignal){
  await initializeSemantic();
  const staged=new Map(changes.map(change=>[change.path,change.after]));const found:CodeSymbol[]=[];
  for(const path of [...new Set([...project.files,...staged.keys()])].filter(safeProjectPath).slice(0,80)){
    signal.throwIfAborted(); if(!/\.(?:[cm]?[jt]sx?|swift|rs)$/.test(path))continue;
    const source=staged.get(path)??await project.readFile(path,signal);if(source.length>300_000)continue;
    found.push(...semanticSource(path,source).symbols.filter(symbol=>symbol.name.toLowerCase().includes(query.toLowerCase())));
    if(found.length>=20)break;
  }return found.slice(0,20);
}

/**
 * Return the exact symbol identifiers that are usable against the current
 * staged sources.  Runtime schemas use this bounded inventory instead of
 * inviting the model to invent an opaque id.
 */
export async function availableSymbols(project:AgentProject,changes:AgentFileChange[],paths:string[],signal:AbortSignal,limit=20){
  await initializeSemantic();
  const staged=new Map(changes.map(change=>[change.path,change.after]));
  const available=new Set([...project.files,...staged.keys()]);
  const selected=[...new Set(paths)].filter(path=>available.has(path)&&safeProjectPath(path)).slice(0,80);
  const found:CodeSymbol[]=[];
  for(const path of selected){
    signal.throwIfAborted();
    if(!/\.(?:[cm]?[jt]sx?|swift|rs)$/.test(path))continue;
    const source=staged.get(path)??await project.readFile(path,signal);
    if(source.length>300_000)continue;
    found.push(...semanticSource(path,source).symbols);
    if(found.length>=limit)break;
  }
  return found.slice(0,limit);
}
