import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd();const output=process.env.RUNSGD_SCREENSHOTS||'/tmp/runsgd-landing-check';fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/app'){res.writeHead(301,{Location:'/app/'+url.search});res.end();return}
 let file=path.join(root,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
 try{const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'};res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end('Missing')}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.RUNSGD_TEST_BROWSER,args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block'});const external=[];await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort()});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,700,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/');assert.equal(new URL(page.url()).pathname,'/');
  assert.equal(await page.locator('h1').innerText(),'JB ↔ Singapore travel.\nLess blur. Less leceh.');
  assert.ok(await page.locator('text=Limited Time').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`no overflow at ${width}px`);
  if(width<=700){const positions=await page.locator('#travel-guides a').evaluateAll(as=>as.map(a=>a.getBoundingClientRect().top));assert.ok(positions.every((y,i)=>!i||y>positions[i-1]),'mobile guides stack in one column')}
  const clipped=await page.locator('.button,.price-display,.feature-row,.daily-card').evaluateAll(els=>els.filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.textContent.trim()));assert.deepEqual(clipped,[],`no clipped cards/buttons at ${width}px`);
  const bad=await page.locator('a[href]').evaluateAll(els=>els.map(a=>a.getAttribute('href')).filter(h=>h.startsWith('#')&&!document.querySelector(h)));assert.deepEqual(bad,[]);
  if([390,1440].includes(width)){
   await page.evaluate(()=>{for(const img of document.images)img.loading='eager'});await page.locator('img').evaluateAll(els=>Promise.all(els.map(el=>el.decode())));
   await page.screenshot({path:path.join(output,width===390?'landing-mobile.png':'landing-desktop.png'),fullPage:true});
  }
 }
 assert.deepEqual(external,[],'marketing does not make external requests');
 // Check the actual public HTML without JavaScript, as seen by link preview bots
 // and crawlers that do not run the app. Inspect metadata and linked resources.
 const staticContext=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
 const staticPage=await staticContext.newPage();await staticPage.goto(origin+'/');
 assert.equal(new URL(staticPage.url()).pathname,'/');
 assert.equal(await staticPage.locator('h1').count(),1);
 assert.ok(await staticPage.locator('h1').isVisible());
 const title=await staticPage.title();assert.match(title,/JB.*Singapore.*Journey Planner.*RunSGD/);
 assert.equal(await staticPage.locator('link[rel="canonical"]').count(),1);
 assert.equal(await staticPage.locator('link[rel="canonical"]').getAttribute('href'),'https://runsgd.site/');
 assert.equal(await staticPage.locator('meta[property="og:title"]').getAttribute('content'),title);
 assert.equal(await staticPage.locator('meta[name="twitter:title"]').getAttribute('content'),title);
 const graph=JSON.parse(await staticPage.locator('script[type="application/ld+json"]').textContent())['@graph'];
 const ids=new Set(graph.map(n=>n['@id']));
 function checkReferences(value){if(!value||typeof value!=='object')return;if(Object.keys(value).length===1&&value['@id'])assert.ok(ids.has(value['@id']),'schema reference resolves');for(const child of Object.values(value))checkReferences(child)}
 checkReferences(graph);assert.equal(graph.find(n=>n['@type']==='WebPage').name,title);
 assert.ok(!graph.some(n=>n.aggregateRating),'no invented app reviews');
 const guideLinks=await staticPage.locator('#travel-guides a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
 assert.equal(new Set(guideLinks).size,6);
 const sitemap=fs.readFileSync('sitemap.xml','utf8');
 for(const href of guideLinks){assert.ok(sitemap.includes('https://runsgd.site'+href));const res=await staticContext.request.get(origin+href);assert.equal(res.status(),200);assert.match(await res.text(),new RegExp('rel="canonical" href="https://runsgd\\.site'+href+'"'))}
 const imageURL=new URL(await staticPage.locator('meta[property="og:image"]').getAttribute('content'));
 const imageResponse=await staticContext.request.get(origin+imageURL.pathname);assert.equal(imageResponse.status(),200);
 const imageData=await imageResponse.body();assert.equal(imageData.readUInt32BE(16),512);assert.equal(imageData.readUInt32BE(20),512);
 assert.ok(await staticPage.getByText('Limited Time',{exact:true}).isVisible());
 await staticContext.close();
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/');await page.getByRole('button',{name:'Open menu',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Close menu',exact:true}).getAttribute('aria-expanded'),'true');
 await page.locator('#site-nav a[href="#pricing"]').click();assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).getAttribute('aria-expanded'),'false');
 await page.locator('#faq summary').first().click();assert.equal(await page.locator('#faq details').first().getAttribute('open'),'');
 await page.getByRole('button',{name:'Checkpoint buses',exact:true}).click();assert.match(await page.locator('#landing-question').inputValue(),/checkpoint buses/);
 await page.locator('[data-explore-form] .button').click();await page.waitForURL('**/app/#explore');await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='explore');assert.match(await page.locator('#aiQuestion').inputValue(),/checkpoint buses/);assert.equal(await page.evaluate(()=>sessionStorage.getItem('runsgdLandingQuestion')),null);
 assert.ok(!external.some(u=>u.includes('runsgd-ai')),'question handoff does not trigger AI');
 await page.evaluate(()=>localStorage.setItem('runsgdTheme','neobrutalism'));await page.goto(origin+'/app');assert.equal(new URL(page.url()).pathname,'/app/');assert.equal(await page.evaluate(()=>document.documentElement.dataset.runsgdTheme),'neobrutalism');
 await page.goto(origin+'/#journey');await page.waitForURL('**/app/#journey');await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='journey');
 await page.goto(origin+'/?auth=google&popup=1&return=journey&attempt=fake#access_token=fake');assert.equal(new URL(page.url()).pathname,'/app/');assert.equal(new URL(page.url()).search,'?auth=google&popup=1&return=journey&attempt=fake');assert.equal(new URL(page.url()).hash,'#access_token=fake');
 await page.goto(origin+'/app/?_release_probe=1');assert.match(await page.locator('#appVersionBadge').innerText(),/2\.17\.0/);
 assert.deepEqual(errors,[]);
 console.log('Browser passed: 320–1440px layouts, images, links, mobile menu, FAQ, Explore handoff without AI calls, existing theme, /app redirect, legacy tab and OAuth callback bridge. Screenshots: '+output);
}finally{await browser?.close();await new Promise(r=>server.close(r))}
