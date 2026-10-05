import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const legacy=execFileSync('git',['show','3ae8f07f8452e9a46733813fa7a3abfd27914729:sw.js'],{encoding:'utf8'});
const root=process.cwd();let upgraded=false,adminFails=true;
const minimal=code=>code.replace(/const SHELL=\[[^\n]+\];/,"const SHELL=['/fixture.html'];").replace("if(url.pathname==='/admin'||", "if(url.pathname==='/fixture.html'||url.pathname==='/admin'||");
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/legacy-sw.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');res.end(minimal(upgraded?fs.readFileSync('sw.js','utf8'):legacy));return}
 if(url.pathname==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Worker test</title>Worker test');return}
 if(url.pathname.startsWith('/admin/')&&adminFails){req.socket.destroy();return}
 let file=path.join(root,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
 try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/plain');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end('missing')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.RUNSGD_TEST_BROWSER||undefined,headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 await page.goto(origin+'/fixture.html');await page.evaluate(async()=>{await navigator.serviceWorker.register('/legacy-sw.js',{scope:'/'});await navigator.serviceWorker.ready});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 let result=await page.goto(origin+'/admin/');assert.equal(result.status(),503);assert.match(await page.locator('body').innerText(),/temporarily unreachable/);
 upgraded=true;await page.goto(origin+'/update/admin/');await page.waitForFunction(()=>document.getElementById('gateText')?.textContent.includes('Sign in'));
 assert.equal(await page.locator('#adminApp').isVisible(),false,'recovery keeps auth guard');
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return r&&await r.navigationPreload.getState().then(s=>s.enabled)});
 adminFails=false;await page.goto(origin+'/admin/');await page.waitForFunction(()=>document.getElementById('gateText')?.textContent.includes('Sign in'));
 adminFails=true;result=await page.goto(origin+'/admin/index.html');assert.equal(result.status(),200);await page.waitForFunction(()=>document.getElementById('gateText')?.textContent.includes('Sign in'));
 assert.equal(await page.locator('#adminApp').isVisible(),false);
 console.log('Browser passed: legacy Admin 503 reproduced; recovery bypassed it, kept auth guard and updated worker; directory cache served index.html during network failure.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
