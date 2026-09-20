const CACHE='runsgd-shell-v2110';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/privacy.html'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  // Auth callbacks must reach the app unchanged and must never be cached.
  if(url.searchParams.has('auth')||url.searchParams.has('code')||url.searchParams.has('error'))return;
  if(req.mode==='navigate'){
    // Always ask the network for the latest HTML. The cache is offline fallback only.
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok&&!url.searchParams.has('auth')){const copy=res.clone();caches.open(CACHE).then(c=>c.put('/',copy));}
      return res;
    }).catch(()=>caches.match('/')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return res;
  })));
});
