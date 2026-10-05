import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd();const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/app'){res.writeHead(301,{Location:'/app/'+url.search});res.end();return}
 let file=path.join(root,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
 try{const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'};res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(path.extname(file)==='.html'?fs.readFileSync(file,'utf8').replace(/<link[^>]+https:\/\/fonts\.[^>]+>/g,''):fs.readFileSync(file))}catch{res.statusCode=404;res.end('Missing')}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.RUNSGD_TEST_BROWSER,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',e=>console.log('page error',e.message));await page.goto(origin+'/');
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return r?.active?.state==='activated'&&(await caches.match('/app/'))});
 await page.goto(origin+'/app/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);try{await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='home',{},{timeout:10000})}catch(e){console.log('boot state',await page.evaluate(()=>({url:location.href,active:document.querySelector('.page.active')?.id,title:document.title,body:document.body.innerText.slice(0,1200)})));throw e};
 assert.match(await page.locator('#appVersionBadge').innerText(),/2\.17\.0/);
 await context.setOffline(true);await page.goto(origin+'/app/index.html',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('body[data-runsgd-app]').count(),1);assert.equal(await page.locator('.hero-copy').count(),0);
 await page.goto(origin+'/');assert.equal(await page.locator('.hero-copy').count(),1);assert.equal(await page.locator('body[data-runsgd-app]').count(),0);
 assert.equal(await page.locator('.hero-art img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
 await page.goto(origin+'/#more',{waitUntil:'domcontentloaded'});try{await page.waitForURL(u=>u.pathname==='/app/'&&u.hash==='#more',{waitUntil:'domcontentloaded',timeout:8000})}catch(e){console.log('offline deep link',await page.evaluate(()=>({url:location.href,title:document.title,entry:typeof RunSGDEntry,body:document.body.innerText.slice(0,1200),scripts:[...document.scripts].map(s=>s.src)})));throw e};await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='more');assert.equal(await page.locator('body[data-runsgd-app]').count(),1);
 await context.setOffline(false);
 const appContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await appContext.addInitScript(()=>{const media=window.matchMedia;window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true}:media.call(window,query)});await appContext.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const installed=await appContext.newPage();await installed.goto(origin+'/');await installed.waitForURL('**/app/');assert.equal(await installed.locator('body[data-runsgd-app]').count(),1);
 console.log('Real-worker browser passed: app/index alias offline, distinct landing cache and artwork offline, old root tab offline, and installed root PWA enters /app/.');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
