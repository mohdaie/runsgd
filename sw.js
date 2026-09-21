const CACHE='runsgd-shell-v2148';
const SHELL=['/','/index.html','/VERSION','/manifest.webmanifest','/icon.svg','/privacy.html','/admin/','/admin/index.html'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    // Bootstrap older installed PWAs that are still showing stale HTML.
    // Conservatively leave Journey screens alone so live navigation is never interrupted.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(windows.map(async client=>{
      try{
        const u=new URL(client.url);
        if(u.hash==='#journey'||u.pathname.startsWith('/jb-test/'))return;
        u.searchParams.set('_sw',CACHE);
        await client.navigate(u.toString());
      }catch{}
    }));
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  // Auth callbacks must reach the app unchanged and must never be cached.
  if(url.searchParams.has('auth')||url.searchParams.has('code')||url.searchParams.has('error'))return;
  // VERSION is the deployment source of truth and must never come from stale cache.
  if(url.pathname==='/VERSION'){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }
  if(req.mode==='navigate'){
    // Always ask the network for the latest HTML and cache each page separately.
    // /admin/ must never overwrite the root app shell.
    const key=url.pathname||'/';
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(key,copy));}
      return res;
    }).catch(async()=>{
      const exact=await caches.match(key);
      if(exact)return exact;
      if(key==='/'||key==='/index.html')return caches.match('/');
      return new Response('RunSGD is offline. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return res;
  })));
});
