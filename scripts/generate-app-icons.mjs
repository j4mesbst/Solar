// Derive the desktop icon from the editable Solar/Atlas vector, without AI raster edits.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),work=path.join(root,'output/solar-gts3-release/icon-generation');
await mkdir(work,{recursive:true});
const source=await readFile('public/solar-mark.svg','utf8');
// Native macOS canvas: transparent outer corners, a full-sized rounded tile,
// and the same vector artwork scaled together rather than cropped.
const native=source.replace('<rect width="1024" height="1024" fill="#111113"/>','<rect x="100" y="100" width="824" height="824" rx="184" fill="#111113"/>').replace('translate(77 77) scale(13.6)','translate(162 162) scale(10.94)');
await writeFile('src-tauri/icons/solar-app.svg',native);
function generate(input,out,args=[]){
 const result=spawnSync(path.join(root,'node_modules/.bin/tauri'),['icon',input,'--output',out,...args],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Icon generation failed');
}
generate('src-tauri/icons/solar-app.svg',path.join(work,'native'));
for(const file of ['32x32.png','64x64.png','128x128.png','128x128@2x.png','icon.png','icon.icns','icon.ico'])await copyFile(path.join(work,'native',file),path.join(root,'src-tauri/icons',file));
generate('public/solar-mark.svg',path.join(work,'brand'),['--png','512']);
await copyFile(path.join(work,'brand','512x512.png'),'public/solar-icon.png');
console.log('Solar/Atlas brand and desktop icons generated.');
