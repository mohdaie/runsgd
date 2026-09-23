const CACHE='runsgd-shell-v2159';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg'];

async function freshResponse(path){
  const req=new Request(path,{cache:'reload'});
  const res=await fetch(req);
  if(!res.ok)throw new Error('HTTP '+res.status+' '+path);
  return res;
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const results=await Promise.allSettled(SHELL.map(async path=>{
      const res=await freshResponse(path);
      await cache.put(path,res.clone());
    }));
    if(results[0]?.status==='rejected'){
      const previous=await caches.match('/');
      if(previous)await cache.put('/',previous);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();

    // Push already-open stale clients onto the newly activated shell.
    // Never interrupt a user who is visibly on the live Journey screen.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(windows.map(async client=>{
      try{
        const url=new URL(client.url);
        if(url.pathname.startsWith('/jb-test/')||url.hash==='#journey')return;
        url.searchParams.set('_sw',CACHE);
        url.searchParams.set('_refresh',String(Date.now()));
        await client.navigate(url.toString());
      }catch{}
    }));
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='PURGE_OLD_SHELLS'){
    event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
  }
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // Auth callbacks must reach the app untouched.
  if(url.searchParams.has('auth')||url.searchParams.has('code')||url.searchParams.has('error'))return;

  // Deployment truth must never be served from cache.
  if(url.pathname==='/VERSION'){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }

  // HTML probes and navigations are always network-first.
  if(req.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'){
    const key=url.pathname||'/';
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(key,copy));}
      return res;
    }).catch(async()=>{
      if(url.searchParams.has('appv')||url.searchParams.has('_runsgd_probe')){
        return new Response('RunSGD is updating. Reconnect and refresh to load the latest version.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
      }
      const exact=await caches.match(key);
      if(exact)return exact;
      if(key==='/'||key==='/index.html')return caches.match('/');
      return new Response('RunSGD is offline. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }));
    return;
  }

  // Static assets can use cache-first.
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return res;
  })));
});