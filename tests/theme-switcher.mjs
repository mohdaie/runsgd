// Run with node tests/theme-switcher.mjs (requires Playwright and Chromium).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.RUNSGD_TEST_BROWSER});
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  try{
    const file=path.endsWith('/')?path+'index.html':path;
    const content=await readFile(new URL('..'+file,import.meta.url));
    const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'text/plain';
    res.writeHead(200,{'Content-Type':type});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=process.env.RUNSGD_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const theme=()=>page.evaluate(()=>document.documentElement.dataset.runsgdTheme);
const select=async value=>{await page.locator(`input[name="runsgd-theme"][value="${value}"]`).check();};
try{
  await page.goto(origin+'/#more');
  await page.locator('.nav button[data-page="more"]').click();
  assert.equal(await theme(),'classic','new visitors keep the current theme');
  const original=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.ok(original.includes('radial-gradient'),'existing background is preserved');
  await select('neobrutalism');
  assert.equal(await theme(),'neobrutalism');
  assert.equal(await page.evaluate(()=>localStorage.getItem('runsgdTheme')),'neobrutalism');
  assert.match(await page.locator('#themeStatus').innerText(),/Saved on this device/);
  assert.equal(await page.locator('.themePicker').evaluate(el=>getComputedStyle(el).borderTopWidth),'2px');
  for(const width of [320,390,480,1280]){
    await page.setViewportSize({width,height:844});
    for(const name of ['home','explore','journey','more']){
      await page.locator(`.nav button[data-page="${name}"]`).click();
      assert.equal(await page.locator('.page.active').getAttribute('id'),name);
      const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('.page.active *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,id:el.id,class:el.className,right:el.getBoundingClientRect().right})).slice(0,8));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} fits ${width}px: ${JSON.stringify(overflow)}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  assert.equal(await theme(),'neobrutalism','selection survives a refresh');
  await page.locator('.nav button[data-page="more"]').click();
  assert.equal(await page.locator('input[value="neobrutalism"]').isChecked(),true);
  const second=await context.newPage();
  await second.goto(origin+'/guides/');
  assert.equal(await second.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism','theme follows guide navigation');
  await second.goto(origin+'/admin/');
  assert.equal(await second.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism','admin inherits the preference');
  await second.evaluate(()=>localStorage.setItem('runsgdTheme','classic'));
  await page.waitForFunction(()=>document.documentElement.dataset.runsgdTheme==='classic');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage),original,'switching back fully restores the background');
  await select('neobrutalism');
  await select('classic');
  await page.reload();
  assert.equal(await theme(),'classic');
  await page.evaluate(()=>localStorage.setItem('runsgdTheme','unknown-theme'));
  await page.reload();
  assert.equal(await theme(),'classic','invalid saved preferences fall back safely');
  await page.locator('.nav button[data-page="more"]').click();
  await page.locator('input[value="classic"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await theme(),'neobrutalism','native radio controls work with a keyboard');
  if(process.env.RUNSGD_THEME_SCREENSHOTS)await page.screenshot({path:process.env.RUNSGD_THEME_SCREENSHOTS+'/theme-more.png'});
  await page.locator('.nav button[data-page="home"]').click();
  if(process.env.RUNSGD_THEME_SCREENSHOTS)await page.screenshot({path:process.env.RUNSGD_THEME_SCREENSHOTS+'/theme-home.png'});
  assert.deepEqual(errors,[],'no runtime errors while switching themes or pages');

  const restricted=await browser.newContext({serviceWorkers:'block'});
  await restricted.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await restricted.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new DOMException('Storage blocked','SecurityError');};
    Storage.prototype.setItem=()=>{throw new DOMException('Storage blocked','SecurityError');};
  });
  const minimal=await restricted.newPage();
  // Isolate the theme UI because the existing app itself requires browser storage.
  await minimal.route(origin+'/restricted',route=>route.fulfill({contentType:'text/html',body:'<meta name="theme-color" content="#f8fbff"><script src="/assets/theme.js"></script><label><input name="runsgd-theme" type="radio" value="neobrutalism">Theme</label><div id="themeStatus"></div>'}));
  await minimal.goto(origin+'/restricted');
  await minimal.locator('input').check();
  assert.equal(await minimal.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism');
  assert.match(await minimal.locator('#themeStatus').innerText(),/this page only/);
  console.log('Theme switching passed: mobile/desktop layout, persistence, restoration, guide/admin navigation, cross-tab sync, keyboard access and storage failure.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
