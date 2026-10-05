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
  await page.locator('.nav button[data-page="explore"]').click();
  await page.locator('.kbCard').first().waitFor();
  for(const selector of ['#explore .aiCard','.kbIntro','.kbCard','.kbIcon']){
    const styles=await page.locator(selector).evaluateAll(elements=>elements.map(el=>({background:getComputedStyle(el).backgroundImage,border:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow})));
    assert.ok(styles.length>0,selector+' exists');
    assert.ok(styles.every(s=>s.background==='none'),selector+' uses a flat colour');
    assert.ok(styles.every(s=>parseFloat(s.border)>=1.5),selector+' has a dark outline');
    assert.ok(styles.every(s=>s.shadow.includes('0px 0px')),selector+' uses a hard shadow');
  }
  await page.locator('.kbHead').first().click();
  assert.equal(await page.locator('.kbCard').first().evaluate(el=>el.classList.contains('open')),true,'guides still expand');
  if(process.env.RUNSGD_THEME_SCREENSHOTS)await page.screenshot({path:process.env.RUNSGD_THEME_SCREENSHOTS+'/theme-explore-flat.png',fullPage:true});
  await page.reload();
  assert.equal(await theme(),'neobrutalism','selection survives a refresh');
  await page.locator('.nav button[data-page="more"]').click();
  assert.equal(await page.locator('input[value="neobrutalism"]').isChecked(),true);
  const second=await context.newPage();
  await second.goto(origin+'/guides/');
  assert.equal(await second.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism','theme follows guide navigation');
  // A local SDK fixture exercises the complete admin shell without real account access.
  await second.route('**/assets/vendor/supabase-js-2.117.2.js',route=>route.fulfill({contentType:'application/javascript',body:`
    window.supabase={createClient:()=>({
      auth:{getSession:async()=>({data:{session:{user:{id:'fixture-admin',email:'admin@example.test'}}}})},
      from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'admin',display_name:'Admin'},error:null})})})}),
      rpc:async()=>({data:{views_today:10,visitors_today:4,members:10,views_7d:131,visitors_7d:57,members_7d:3,generated_at:'2026-10-05T02:04:00Z',daily:[3,7,10,12,3,4,3].map((views,i)=>({date:'2026-09-'+String(24+i),views}))},error:null})
    })};
  `}));
  await second.goto(origin+'/admin/');
  assert.equal(await second.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism','admin inherits the preference');
  await second.locator('#adminApp').waitFor({state:'visible'});
  await second.locator('.sparkBar').first().waitFor();
  for(const selector of ['.adminProfile','.monitorCard','.metric','.navCard','.navCard .navIcon','.sparkBar']){
    const styles=await second.locator(selector).evaluateAll(elements=>elements.map(el=>({background:getComputedStyle(el).backgroundImage,border:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow})));
    assert.ok(styles.length>0,selector+' exists');
    assert.ok(styles.every(s=>s.background==='none'),selector+' uses flat colours');
    if(selector!=='.sparkBar'){
      assert.ok(styles.every(s=>parseFloat(s.border)>=1.5),selector+' has a dark outline');
      assert.ok(styles.every(s=>s.shadow.includes('0px 0px')),selector+' has a hard shadow');
    }
  }
  const metricColours=await second.locator('.metric').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).backgroundColor));
  assert.equal(new Set(metricColours).size,3,'admin metrics use three distinct flat colours');
  for(const width of [320,390,1280]){
    await second.setViewportSize({width,height:844});
    assert.equal(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'admin fits '+width+'px');
  }
  await second.setViewportSize({width:390,height:844});
  if(process.env.RUNSGD_THEME_SCREENSHOTS)await second.screenshot({path:process.env.RUNSGD_THEME_SCREENSHOTS+'/theme-admin-flat.png',fullPage:true});
  await second.evaluate(()=>localStorage.setItem('runsgdTheme','classic'));
  await page.waitForFunction(()=>document.documentElement.dataset.runsgdTheme==='classic');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage),original,'switching back fully restores the background');
  await second.reload();
  assert.match(await second.locator('.adminProfile').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/,'Classic keeps its original Admin design');
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
