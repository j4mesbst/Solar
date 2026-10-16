export type ModuleMode='cjs'|'esm'|'bundler';
export function resolveLocalImport(importer:string,specifier:string,paths:Iterable<string>,mode:ModuleMode){
  const parts=importer.split('/').slice(0,-1);
  for(const part of specifier.split('/')){if(part==='..'){if(!parts.length)return {attempted:[],target:undefined};parts.pop();}else if(part&&part!=='.')parts.push(part);}
  const base=parts.join('/'),files=new Set(paths);
  const extensions=mode==='cjs'?['','.js','.json','.node','/index.js','/index.json','/index.node']:mode==='esm'?['']:['','.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','/index.ts','/index.tsx','/index.js','/index.jsx'];
  const attempted=extensions.map(extension=>base+extension);
  return {target:attempted.find(file=>files.has(file)),attempted};
}
export function importMode(importer:string,expression:string,packageType?:string):ModuleMode {
  if(/\brequire\s*\(/.test(expression))return 'cjs';
  return /\.mjs$/.test(importer)||/\.js$/.test(importer)&&packageType==='module'?'esm':'bundler';
}
