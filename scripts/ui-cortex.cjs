const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(path.join(process.env.SOLAR_UI_NODE_MODULES||'../ui-verification/node_modules','playwright'));
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({root:path.resolve(__dirname,'..'),server:{host:'127.0.0.1',port:1443,strictPort:true}});await server.listen();
 const browser=await chromium.launch({headless:true,...(process.env.SOLAR_UI_CHROMIUM?{executablePath:process.env.SOLAR_UI_CHROMIUM}:{})});
 const shots=path.resolve(__dirname,'../output/playwright/cortex');await fs.mkdir(shots,{recursive:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args)};
  if(!localStorage.getItem('solar.data.v3'))localStorage.setItem('solar.data.v3',JSON.stringify({version:3,providers:[{id:'local',name:'Local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',secretRef:'none',enabled:true,connectionState:'connected'}],models:[{id:'local:ornith-1.5:9b',providerId:'local',providerModelId:'ornith-1.5:9b',name:'Solar 9B',displayName:'Solar 9B',displayNameSource:'Solar 9B',capabilities:[],enabled:true,source:'remote'}],conversations:[],messages:[],drafts:[],settings:{theme:'dark',defaultModelId:'local:ornith-1.5:9b',onboardingComplete:true,web:{mode:'off'},skillsMode:'auto'}}));
  const source={'src/value.ts':'export const value = 0;\n','package.json':'{"scripts":{"build":"tsc --noEmit"}}'};
  const directory={kind:'directory',name:'Cortex fixture',async *values(){yield {kind:'directory',name:'src',async *values(){yield {kind:'file',name:'value.ts',getFile:async()=>new File([source['src/value.ts']],'value.ts')}}};yield{kind:'file',name:'package.json',getFile:async()=>new File([source['package.json']],'package.json')};},getDirectoryHandle:async()=>({getFileHandle:async()=>({getFile:async()=>new File([source['src/value.ts']],'value.ts')})}),getFileHandle:async()=>({getFile:async()=>new File([source['package.json']],'package.json')})};
  window.showDirectoryPicker=async()=>directory;
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/solar-ollama/api/tags',r=>r.fulfill({json:{models:[{name:'ornith-1.5:9b'}]}}));
 await page.route('**/solar-ollama/api/ps',r=>r.fulfill({json:{models:[{name:'ornith-1.5:9b'}]}}));
 await page.route('**/solar-ollama/api/show',r=>r.fulfill({json:{capabilities:['completion','tools','thinking','vision'],template:'fixture',details:{quantization_level:'Q4_K_M'}}}));
 await page.route('**/solar-ollama/api/chat',async r=>{
  const body=r.request().postDataJSON();if(!body.messages.length)return r.fulfill({json:{done:true}});requests.push(body);
  const text=body.messages.at(-1).content;let answer;
  if(body.messages[0].content.includes('Solar Cortex'))answer=JSON.stringify({actions:[{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'},{type:'finish',message:'Patch prêt'}]});
  else if(text==='salut')answer='Salut !';else if(text==='ça va déjà ?')answer='Oui, ça va ! Et toi ?';else answer='Le fichier est bien joint.';
  await new Promise(resolve=>setTimeout(resolve,250));
  await r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({message:{content:answer},done:true,done_reason:'stop',eval_count:20})+'\n'});
 });
 await page.goto('http://127.0.0.1:1443');const input=page.getByRole('textbox',{name:'Message à Solar'});await input.waitFor();
 await input.fill('salut');await input.press('Enter');try{await page.getByText('Salut !',{exact:true}).waitFor({timeout:10000});}catch(error){await page.screenshot({path:path.join(shots,'failure.png')});console.error({errors,requests:requests.map(r=>({model:r.model,last:r.messages.at(-1).content})),body:await page.locator('body').innerText(),reply:await page.locator('.response-body').innerHTML(),messages:await page.evaluate(()=>JSON.parse(localStorage.getItem('solar.data.v3')).messages)});throw error;}
 await page.evaluate(async()=>{const {solarStore}=await import('/src/services/store.ts');const conversations=await solarStore.listConversations();const messages=await solarStore.listMessages(conversations[0].id);const assistant=messages.find(m=>m.role==='assistant');await solarStore.saveMessage({...assistant,content:'Je vais préparer une présentation IA 2025 avec huit slides.'});});
 await input.fill('ça va déjà ?');await input.press('Enter');await page.getByText('Oui, ça va ! Et toi ?',{exact:true}).waitFor();
 assert.equal(requests.length,2);assert.equal(requests[1].messages.length,2);assert.equal(requests[1].messages.at(-1).content,'ça va déjà ?');assert.equal(requests[1].options.num_predict,128);assert(!requests[1].messages[0].content.includes('[Skill'));assert(!requests[1].messages[0].content.includes('Planification'));
 await page.screenshot({path:path.join(shots,'chat-dark.png')});
 await page.locator('input[type=file][aria-label="Joindre un fichier"]').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:Buffer.from('Contexte joint de test.')});await input.fill('Lis le fichier joint');await input.press('Enter');await page.getByText('Le fichier est bien joint.',{exact:true}).waitFor();assert(requests.at(-1).messages.at(-1).content.includes('Contexte joint de test.'));
 await page.getByRole('button',{name:'Afficher la barre latérale'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Modèles',exact:true}).click();
 const row=page.locator('.solar-model-row').filter({hasText:'Solar 4B'});await row.getByRole('button',{name:'Télécharger',exact:true}).click();await row.getByText('ollama pull qwen3:4b',{exact:true}).waitFor();await row.getByRole('button',{name:'Copier la commande Solar 4B'}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'ollama pull qwen3:4b');assert(await row.getByRole('button',{name:'Télécharger dans Solar'}).isDisabled());
 await page.screenshot({path:path.join(shots,'models-dark.png')});
 await page.getByRole('button',{name:'Apparence',exact:true}).click();await page.getByRole('button',{name:'Clair',exact:true}).click();await page.getByRole('button',{name:'Modèles',exact:true}).click();await row.getByRole('button',{name:'Télécharger',exact:true}).click();await page.screenshot({path:path.join(shots,'models-light.png')});
 await page.getByRole('button',{name:'Performance',exact:true}).click();await page.getByRole('checkbox',{name:'Activer la mémoire technique Cortex'}).check();assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('solar.data.v3')))).settings.cortexMemory);
 await page.getByRole('button',{name:'Retour au chat'}).click();await page.getByRole('button',{name:'Afficher la barre latérale'}).click();await page.getByRole('button',{name:'Solar Code',exact:true}).click();await page.getByRole('button',{name:'Masquer la barre latérale'}).click();
 await page.getByRole('button',{name:'Choisir un projet',exact:true}).click();await page.getByRole('button',{name:'Fermer le panneau Work'}).click();
 await page.getByRole('button',{name:'Niveau d’effort'}).click();await page.getByRole('button',{name:'Faible',exact:true}).click();await page.keyboard.press('Escape');
 await input.fill('Modifie le fichier src/value.ts pour mettre value à 1.');await input.press('Enter');await page.getByRole('button',{name:'Reprendre Cortex'}).waitFor();
 await page.getByText('Vérifications Cortex',{exact:true}).click();await page.getByText('La compilation de projet nécessite Solar pour macOS.',{exact:true}).count();
 const tasks=await page.evaluate(()=>JSON.parse(localStorage.getItem('solar.cortex.v1')).tasks);assert.equal(tasks.at(-1).phase,'paused');assert.equal(tasks.at(-1).candidates[0].changes.length,1);assert(!tasks.at(-1).candidates[0].finished);
 await page.screenshot({path:path.join(shots,'cortex-paused-light.png')});
 await page.setViewportSize({width:600,height:760});await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement!==document.body));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(shots,'cortex-small-reduced-motion.png')});
 assert.deepEqual(errors,[]);console.log('cortex-ui: ok (normal chat relevance/one pass, attachments, command copy, light/dark, consent, paused task, small window, keyboard, reduced motion)');
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
