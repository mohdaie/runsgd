import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sw=read('sw.js'),html=read('index.html'),version=read('VERSION').trim();

// Public installs must not precache the admin panel; admin stays network-first with on-visit caching.
const shell=JSON.parse(sw.match(/const SHELL=(\[[^\]]*\]);/)[1].replaceAll("'",'"'));
assert.ok(!shell.some(p=>p.startsWith('/admin')),'admin pages are not precached');
for(const p of shell){
 const file=p==='/'?'index.html':p.replace(/^\//,'')+(p.endsWith('/')?'index.html':'');
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
assert.ok(read('admin/health/index.html').includes('SYSTEM HEALTH · v'+version),'admin health badge matches VERSION');

console.log('PWA shell checks passed: no admin precache, no HTML rewriting, landmark hidden in shell, versions aligned.');
