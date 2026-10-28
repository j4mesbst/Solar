import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,readFile,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {renderRemotionProject,samplePng} from '../src-tauri/src/cortex-remotion.mjs';
import {assessVideoMotion} from '../src/lib/cortex/motion-engine.ts';

const installed=process.env.CORTEX_TEST_REMOTION_ROOT;
const dir=await mkdtemp('/private/tmp/solar-cortex-v5-remotion-test-');
try{
  const root=join(dir,'project'),outputDir=join(dir,'render');await mkdir(join(root,'src'),{recursive:true});await mkdir(join(root,'public'));await mkdir(outputDir);
  await writeFile(join(root,'package.json'),JSON.stringify({name:'solar-v5-test',version:'1.0.0',dependencies:{react:'*',remotion:'*'}}));
  await writeFile(join(root,'src/index.ts'),`import React from 'react';import {Composition,registerRoot,useCurrentFrame} from 'remotion';function Scene(){const f=useCurrentFrame();return React.createElement('div',{style:{width:'100%',height:'100%',background:f<5?'#112233':'#eeddcc'}})}function Root(){return React.createElement(Composition,{id:'Test',component:Scene,durationInFrames:10,fps:10,width:160,height:90})}registerRoot(Root);`);
  const input={root,outputDir,entryPoint:'src/index.ts',compositionId:'Test',frames:[0,5,9],projectFiles:['src/index.ts'],authorized:true};
  await assert.rejects(renderRemotionProject({...input,authorized:false}),/non autorisée/);
  await assert.rejects(renderRemotionProject({...input,entryPoint:'../escape.ts'}),/hors projet|absent/);
  if(!installed){console.log('Cortex V5 Remotion: access controls PASS; rendering SKIP (CORTEX_TEST_REMOTION_ROOT absent)');}
  else {
    await symlink(resolve(installed,'node_modules'),join(root,'node_modules'));
    const report=await renderRemotionProject(input);
    assert.equal(report.captureMode,'remotion');assert.equal(report.composition.id,'Test');assert.deepEqual(report.frames.map(f=>f.timestamp),[0,500,900]);
    assert.equal(report.frames.length,3);assert.equal(report.frames[0].raster.length,768);
    assert.equal(assessVideoMotion(report)[0].status,'passed');
    assert.equal(samplePng(await readFile(join(outputDir,'frame-0.png'))).length,768);
    await assert.rejects(renderRemotionProject({...input,exportVideo:true,exportAuthorized:false}),/non autorisé/);
    const exported=await renderRemotionProject({...input,frames:[0,9],exportVideo:true,exportAuthorized:true});
    assert(exported.export.bytes>100);assert((await stat(join(outputDir,'video.mp4'))).size>100);
    console.log('Cortex V5 Remotion: local composition, actual keyframes, measured motion, authorized MP4 and denials — PASS');
  }
}finally{await rm(dir,{recursive:true,force:true});}
