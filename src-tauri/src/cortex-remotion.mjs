// Optional local adapter. No npm scripts, project config, installation or browser download.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,stat,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {inflateSync} from 'node:zlib';

export async function localBrowser(root){
  const candidates=process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium']:['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'];
  for(const candidate of candidates)if((await stat(candidate).catch(()=>undefined))?.isFile())return candidate;
  const search=async(dir,depth)=>{
    if(depth>5)return;
    for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){
      const p=path.join(dir,entry.name);
      if(entry.isFile()&&['chrome-headless-shell','chrome-headless-shell.exe'].includes(entry.name))return p;
      if(entry.isDirectory()){const found=await search(p,depth+1);if(found)return found;}
    }
  };
  return await search(path.join(root,'node_modules/.remotion/chrome-headless-shell'),0)
    ?? await search(path.join(homedir(),'Library/Caches/ms-playwright'),0)
    ?? await search(path.join(homedir(),'.cache/ms-playwright'),0);
}
/** Decode only the renderer's bounded 8-bit RGB/RGBA PNG, sample a 16×16 raster. */
export function samplePng(bytes){
  if(bytes.length>16_000_000||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG de rendu invalide.');
  let width=0,height=0,channels=0;const chunks=[];
  for(let offset=8;offset+12<=bytes.length;){
    const size=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8),end=offset+12+size;
    if(end>bytes.length)throw Error('PNG tronqué.');
    const data=bytes.subarray(offset+8,offset+8+size);
    if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=data[9]===6?4:data[9]===2?3:0;if(data[8]!==8||data[12]!==0)throw Error('Format PNG non pris en charge.');}
    if(kind==='IDAT')chunks.push(data);offset=end;
  }
  if(!channels||width<1||height<1||width*height>3_000_000)throw Error('Dimensions PNG hors limites.');
  const stride=width*channels,decoded=inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});
  if(decoded.length!==(stride+1)*height)throw Error('Données PNG incomplètes.');
  const raster=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=decoded[y*(stride+1)];if(filter>4)throw Error('Filtre PNG invalide.');
    for(let x=0;x<stride;x++){
      const a=x>=channels?raster[y*stride+x-channels]:0,b=y?raster[(y-1)*stride+x]:0,c=y&&x>=channels?raster[(y-1)*stride+x-channels]:0;
      raster[y*stride+x]=(decoded[y*(stride+1)+1+x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;
    }
  }
  const samples=[];
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const i=Math.min(height-1,Math.floor((y+.5)*height/16))*stride+Math.min(width-1,Math.floor((x+.5)*width/16))*channels;
    const alpha=channels===4?raster[i+3]/255:1;for(let c=0;c<3;c++)samples.push(Math.round(raster[i+c]*alpha+255*(1-alpha)));
  }
  return samples;
}
export async function renderRemotionProject(input){
  if(input.authorized!==true)throw Error('Exécution Remotion non autorisée.');
  const root=await realpath(input.root),out=await realpath(input.outputDir);
  const entry=input.entryPoint??['src/index.ts','src/index.tsx','src/remotion/index.ts','src/remotion/index.tsx'].find(p=>input.projectFiles?.includes(p));
  if(typeof entry!=='string'||entry.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'||p.startsWith('.'))||path.isAbsolute(entry))throw Error('Point d’entrée Remotion absent ou hors projet.');
  const resolved=await realpath(path.join(root,entry));if(!resolved.startsWith(root+path.sep))throw Error('Point d’entrée hors projet.');
  const require=createRequire(path.join(root,'package.json'));
  const bundlerPath=require.resolve('@remotion/bundler'),rendererPath=require.resolve('@remotion/renderer');
  const browser=await localBrowser(root);if(!browser)throw Error('Navigateur local absent; aucun téléchargement automatique.');
  const {bundle}=require(bundlerPath),renderer=require(rendererPath);
  const bundleDir=path.join(out,'bundle');await mkdir(bundleDir,{recursive:true});
  // Fixed options only: never import remotion.config.* or execute an npm script.
  const serveUrl=await bundle({entryPoint:resolved,outDir:bundleDir,publicDir:path.join(root,'public'),onProgress:()=>{}});
  const common={serveUrl,browserExecutable:browser,inputProps:{},timeoutInMilliseconds:15_000,onBrowserDownload:()=>{throw Error('Téléchargement navigateur interdit.');}};
  const compositions=await renderer.getCompositions(common);
  const composition=input.compositionId?compositions.find(c=>c.id===input.compositionId):compositions.length===1?compositions[0]:undefined;
  if(!composition)throw Error('Composition absente ou ambiguë; préciser son identifiant.');
  const {id,fps,durationInFrames,width,height}=composition;
  if(!Number.isFinite(fps)||fps<=0||fps>120||!Number.isInteger(durationInFrames)||durationInFrames<2||durationInFrames>432000||width<16||height<16||width>1920||height>1920)throw Error('Métadonnées de composition hors limites.');
  const frames=input.frames??[...new Set([0,.25,.5,.75,1].map(v=>Math.round((durationInFrames-1)*v)))];
  if(!Array.isArray(frames)||!frames.length||frames.length>12||frames.some(f=>!Number.isInteger(f)||f<0||f>=durationInFrames))throw Error('Images clés hors composition.');
  const report={supported:true,captureMode:'remotion',width,height,composition:{id,fps,durationInFrames,width,height},frames:[],errors:[]};
  for(const frame of [...new Set(frames)].sort((a,b)=>a-b)){
    const output=path.join(out,`frame-${frame}.png`);
    await renderer.renderStill({...common,composition,frame,imageFormat:'png',scale:Math.min(1,640/width),output,overwrite:true});
    const bytes=await readFile(output);report.frames.push({timestamp:frame*1000/fps,image:'data:image/png;base64,'+bytes.toString('base64'),elements:[],overflow:0,raster:samplePng(bytes)});
  }
  if(input.exportVideo===true){
    if(input.exportAuthorized!==true)throw Error('Export vidéo non autorisé.');
    const outputLocation=path.join(out,'video.mp4');
    await renderer.renderMedia({...common,composition,codec:'h264',outputLocation,overwrite:true,concurrency:1});
    const file=await stat(outputLocation);if(file.size<1)throw Error('Export vidéo vide.');
    report.export={path:outputLocation,bytes:file.size,codec:'h264'};
  }
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const input=JSON.parse(await readFile(process.argv[2],'utf8'));const report=await renderRemotionProject(input);await writeFile(path.join(input.outputDir,'remotion-report.json'),JSON.stringify(report));}
  catch(error){process.stderr.write(String(error));process.exitCode=1;}
}
