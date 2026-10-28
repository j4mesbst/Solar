import { mkdtemp,readFile,writeFile,rm,realpath } from 'node:fs/promises';
import { join,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
const exec=promisify(execFile);
export const SOLAR_ROOT=fileURLToPath(new URL('../../',import.meta.url));

export async function render(html,times,signal,reference,options={}){
  signal.throwIfAborted();
  const dir=await mkdtemp('/private/tmp/solar-bench-webkit-');
  try{
    const input=join(dir,'input.json');await writeFile(input,JSON.stringify({html,times,reference,...options}));
    await exec('/usr/bin/swift',[join(SOLAR_ROOT,'src-tauri/src/cortex-render.swift'),input],{timeout:60_000,signal});
    return JSON.parse(await readFile(join(dir,'report.json'),'utf8'));
  }finally{await rm(dir,{recursive:true,force:true});}
}
export async function renderDirectory(directory,times,signal,options={}){
  signal.throwIfAborted();
  const root=await realpath(directory);
  const server=createServer(async(req,res)=>{
    try{
      const path=await realpath(join(root,decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'index.html'));
      if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
      const body=await readFile(path);if(body.length>10_000_000)throw Error('Asset trop volumineux');
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(path)]??'application/octet-stream','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{return await render('',times,signal,options.reference,{...options,url:`http://127.0.0.1:${server.address().port}/`});}
  finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}
