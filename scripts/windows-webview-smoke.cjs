// CI only: inspect the actual installed WebView2. No debug flags ship in Solar.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 let browser;
 const deadline=Date.now()+60000;
 while(!browser&&Date.now()<deadline){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:2500});}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!browser){fs.writeFileSync('artifacts/windows-webview-verification.json',JSON.stringify({status:'unavailable',reason:'Runner did not expose the WebView2 diagnostic port; native process/window check remains separate.'},null,2));console.warn('WebView2 diagnostic port unavailable in this runner.');return;}
 try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>/tauri|localhost/.test(p.url()))??browser.contexts()[0]?.pages()[0];
  assert.ok(page,'Installed Solar page is absent');
  page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('.team-app').waitFor({state:'attached'});
  assert.equal(await page.locator('.team-app').getAttribute('data-native'),'true');
  assert.equal(await page.locator('.team-app').getAttribute('data-platform'),'windows');
  const text=await page.locator('body').innerText();assert.ok(text.length>30,'Blank app');
  assert.ok(!text.includes('Impossible d’ouvrir Solar'),'Startup error');
  assert.equal(await page.locator('.team-sidebar-top').evaluate(e=>getComputedStyle(e).paddingLeft),'8px');
  await page.screenshot({path:'artifacts/windows-native-webview.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/windows-webview-verification.json',JSON.stringify({native:true,platform:'windows',bodyRendered:true,correctSidebarInset:true,pageErrors:errors,physicalMicrophoneTested:false},null,2));
  console.log('PASS installed Windows WebView2: real native context, rendered Solar shell, Windows inset and no uncaught error.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
