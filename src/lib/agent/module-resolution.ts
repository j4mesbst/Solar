export type ModuleMode='cjs'|'esm'|'bundler';
export function resolveLocalImport(importer:string,specifier:string,paths:Iterable<string>,mode:ModuleMode){
  const parts=importer.split('/').slice(0,-1);
  for(const part of specifier.split('/')){if(part==='..'){if(!parts.length)return {attempted:[],target:undefined};parts.pop();}else if(part&&part!=='.')parts.push(part);}
  const base=parts.join('/'),files=new Set(paths);
  const extensions=mode==='cjs'?['','.js','.json','.node','/index.js','/index.json','/index.node']:mode==='esm'?['']:['','.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','/index.ts','/index.tsx','/index.js','/index.jsx'];
  const attempted=extensions.map(extension=>base+extension);
  return {target:attempted.find(file=>files.has(file)),attempted};
}
/** A nearby file is evidence for a repair, not proof that Node can resolve it.
 * In particular, CommonJS does not append .cjs to extensionless requires. */
export function nearbyLocalImports(importer:string,specifier:string,paths:Iterable<string>,mode:ModuleMode){
  if(!specifier.startsWith('./')&&!specifier.startsWith('../'))return [];
  const base=resolveLocalImport(importer,specifier,[],mode).attempted[0];
  if(!base)return [];
  const suffixes=mode==='cjs'?['.cjs','/index.cjs']:mode==='esm'?['.js','.mjs','.cjs']:['.cjs','.mjs','/index.cjs'];
  return [...new Set(paths)].filter(path=>suffixes.some(suffix=>path===base+suffix))
    .map(path=>({path,specifier:specifier+path.slice(base.length)}));
}
export function importMode(importer:string,expression:string,packageType?:string):ModuleMode {
  if(/\brequire\s*\(/.test(expression))return 'cjs';
  return /\.mjs$/.test(importer)||/\.js$/.test(importer)&&packageType==='module'?'esm':'bundler';
}
