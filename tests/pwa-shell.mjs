import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sw=read('sw.js'),html=read('index.html'),version=read('VERSION').trim();

// Public installs must not precache the admin panel; admin stays network-first with on-visit caching.
const shell=JSON.parse(sw.match(/const SHELL=(\[[^\]]*\]);/)[1].replaceAll("'",'"'));
assert.ok(!shell.some(p=>p.startsWith('/admin')),'admin pages are not precached');
for(const p of shell){
 const file=p==='/'?'index.html':p.split('?')[0].replace(/^\//,'')+(p.endsWith('/')?'index.html':'');
 assert.ok(existsSync(new URL('../'+file,import.meta.url)),'precached file exists: '+p);
}

// The worker serves HTML as published: no version relabelling or markup rewriting.
assert.ok(!/publicShellResponse|replaceAll\(|html\.replace\(/.test(sw),'service worker does not rewrite HTML');

// Unreleased landmark collection is hidden in the shell itself, not by the worker.
assert.match(html,/<article class="card landmarkCollectionCard" hidden>/);
assert.match(html,/\[hidden\]\{display:none!important\}/);

// One release version everywhere.
const [major,minor,patch]=version.split('.');
assert.ok(sw.includes(`const CACHE='runsgd-shell-v${major}${minor}${patch.padStart(2,'0')}';`),'sw cache matches VERSION');
assert.ok(html.includes(`const RUNSGD_VERSION='${version}';`),'index.html version matches VERSION');
assert.equal((html.match(new RegExp('v'+version.replaceAll('.','\\.')+'<','g'))||[]).length,3,'index.html badges match VERSION');

console.log('PWA shell checks passed: no admin precache, no HTML rewriting, landmark hidden in shell, versions aligned.');

// Every page uses the self-hosted, pinned supabase-js, and only the app registers a versioned worker URL.
const root=new URL('../',import.meta.url);
const pages=[];
(function walk(dir){for(const name of readdirSync(new URL(dir,root))){
 if(name==='.git'||name==='node_modules')continue;
 const rel=dir+name;if(statSync(new URL(rel,root)).isDirectory())walk(rel+'/');else if(name.endsWith('.html'))pages.push(rel);
}})('');
for(const page of pages){
 const src=read(page);
 assert.ok(!src.includes('supabase-js@2"'),page+' does not load unpinned supabase-js@2 from a CDN');
 if(src.includes('window.supabase.createClient'))assert.ok(src.includes('<script src="/assets/vendor/supabase-js-2.117.2.js"></script>'),page+' loads the vendored supabase-js');
 if(page!=='index.html')assert.ok(!/serviceWorker\.register\('\/sw\.js\?v=/.test(src),page+' does not register a hard-coded sw.js version');
}
console.log(`Checked ${pages.length} pages: pinned self-hosted supabase-js, no stale service worker URLs.`);
for(const page of pages)assert.ok(!/\b(const|let|var)\s+(URL|URLSearchParams|Request|Response|Headers|fetch)\s*=/.test(read(page)),page+' does not shadow a browser global that supabase-js relies on');

// Admin badges read the deployed version at runtime instead of hard-coding one that drifts.
for(const page of pages.filter(p=>p.startsWith('admin/'))){
 const src=read(page);
 assert.ok(!/class="badge"[^>]*>[^<]*v\d+\.\d+\.\d+/.test(src),page+' has no hard-coded version badge');
 if(src.includes('data-runsgd-badge'))assert.ok(src.includes('<script src="/assets/version-badge.js" defer></script>'),page+' loads the version badge script');
}
console.log('Admin version badges follow /VERSION.');

// App icons: real PNGs at the declared sizes, separate "any" and "maskable" entries, and an iOS touch icon.
const pngSize=p=>{const b=readFileSync(new URL('../'+p.replace(/^\//,''),import.meta.url));assert.equal(b.toString('ascii',1,4),'PNG',p+' is a PNG');return b.readUInt32BE(16)+'x'+b.readUInt32BE(20)};
const manifest=JSON.parse(read('manifest.webmanifest'));
for(const icon of manifest.icons.filter(i=>i.type==='image/png'))assert.equal(pngSize(icon.src),icon.sizes,icon.src+' matches its declared size');
for(const purpose of ['any','maskable'])for(const size of ['192x192','512x512'])
 assert.ok(manifest.icons.some(i=>i.purpose===purpose&&i.sizes===size&&i.type==='image/png'),`manifest has a ${size} ${purpose} PNG`);
assert.ok(!manifest.icons.some(i=>/any maskable|maskable any/.test(i.purpose||'')),'no icon is shared between any and maskable');
assert.equal(pngSize('/icons/apple-touch-icon.png'),'180x180');
for(const page of pages){
 const src=read(page);
 if(src.includes('rel="icon"'))assert.ok(src.includes('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180">'),page+' has the PNG apple-touch-icon');
}
console.log('App icons: PNG sizes match the manifest, any + maskable split, iOS touch icon on every page.');
