import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('sw.js','utf8');
const legacy=execFileSync('git',['show','3ae8f07f8452e9a46733813fa7a3abfd27914729:sw.js'],{encoding:'utf8'});
const admin=fs.readFileSync('admin/index.html','utf8');
assert.equal(fs.readFileSync('update/admin/index.html','utf8'),admin);
const origin='https://runsgd.test';
function harness(code=source){
 const buckets=new Map(),listeners={};let network=async()=>{throw Error('offline')};let calls=0,failWrite=false;
 const key=r=>new URL(typeof r==='string'?r:r.url,origin).href;
 const caches={async keys(){return [...buckets.keys()]},async delete(n){return buckets.delete(n)},async open(n){
  if(!buckets.has(n))buckets.set(n,new Map());const bucket=buckets.get(n);
  return {async put(r,v){if(failWrite)throw Error('quota');bucket.set(key(r),v.clone())},async match(r){return bucket.get(key(r))?.clone()},async keys(){return [...bucket.keys()].map(url=>new Request(url))}};
 },async match(r){for(const n of buckets.keys()){const v=await (await this.open(n)).match(r);if(v)return v}}};
 vm.runInNewContext(code,{URL,Request,Response,Promise,Date,caches,fetch:async(...args)=>{calls++;return network(...args)},self:{location:{origin},addEventListener:(n,f)=>listeners[n]=f,skipWaiting:async()=>{},registration:{navigationPreload:{enable:async()=>{}}},clients:{claim:async()=>{},matchAll:async()=>[]}}});
 return {caches,buckets,setNetwork:f=>network=f,setFailWrite:v=>failWrite=v,get calls(){return calls},async activate(){let p;listeners.activate({waitUntil:v=>p=v});await p},async get(path,{mode='navigate',preload}={}){let response;listeners.fetch({request:{method:'GET',url:origin+path,mode},preloadResponse:Promise.resolve(preload),respondWith:p=>response=p});return response&&await response}};
}
const html=text=>new Response(text,{headers:{'Content-Type':'text/html'}});
const old=harness(legacy);assert.match(await (await old.get('/admin/')).text(),/temporarily unreachable/);
assert.equal(await old.get('/update/admin/'),undefined,'recovery bypasses installed legacy worker');
const h=harness();h.setNetwork(async()=>html('fresh admin'));assert.equal(await (await h.get('/admin/')).text(),'fresh admin');
h.setNetwork(async()=>{throw Error('connection lost')});
for(const path of ['/admin','/admin/','/admin/index.html?check=1'])assert.equal(await (await h.get(path)).text(),'fresh admin');
h.setNetwork(async()=>new Response('server failed',{status:502}));assert.equal(await (await h.get('/admin/')).text(),'fresh admin');
for(const status of [401,403,404]){h.setNetwork(async()=>new Response('restricted',{status}));assert.equal((await h.get('/admin/')).status,status)}
assert.equal(await h.get('/admin/icon.svg',{mode:'cors'}),undefined);
assert.equal(await h.get('/update/admin/'),undefined);
const empty=harness();const error=await empty.get('/admin/');assert.equal(error.status,503);assert.equal(error.headers.get('Cache-Control'),'no-store');assert.match(await error.text(),/href="\/update\/admin\/"/);
empty.setFailWrite(true);empty.setNetwork(async()=>html('network wins'));assert.equal(await (await empty.get('/admin/')).text(),'network wins');
const preload=harness();assert.equal(await (await preload.get('/admin/',{preload:html('preloaded')})).text(),'preloaded');assert.equal(preload.calls,0);
assert.equal(await (await preload.get('/',{preload:html('home')})).text(),'home');assert.equal(preload.calls,0);
const migrate=harness();const shell=await migrate.caches.open('runsgd-shell-v21622');
await shell.put('/admin/index.html/',html('cached dashboard'));await shell.put('/admin/health/index.html/',html('cached health'));await shell.put('/admin/data',new Response('{"private":true}',{headers:{'Content-Type':'application/json'}}));
await migrate.activate();assert.equal(migrate.buckets.has('runsgd-shell-v21622'),false);
assert.equal(await (await migrate.get('/admin/')).text(),'cached dashboard');assert.equal(await (await migrate.get('/admin/health/index.html')).text(),'cached health');
assert.equal(await (await migrate.caches.open('runsgd-admin-shell-v1')).match('/admin/data/'),undefined);
await migrate.activate();assert.equal(await (await migrate.get('/admin/index.html')).text(),'cached dashboard');
console.log('Admin recovery: legacy failure, bypass, aliases, migration, server/permission responses, preload and cache-write failure passed.');
