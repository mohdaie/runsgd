const CACHE='runsgd-shell-v21602';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/assets/landmarks/jb/bangunan-sultan-iskandar.webp','/assets/landmarks/jb/sultan-ibrahim-stadium.webp','/assets/landmarks/jb/istana-besar-johor.webp','/assets/landmarks/jb/sultan-abu-bakar-state-mosque.webp','/assets/landmarks/jb/johor-bahru-old-chinese-temple.webp','/admin/','/admin/health/','/admin/keys/','/admin/developer/','/admin/people/','/admin/ui/','/admin/affiliate-members/','/admin/community-business/','/admin/detailed-health/'];

async function freshResponse(path){
  const req=new Request(new URL(path,self.location.origin).href,{cache:'reload'});
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
        if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')||url.pathname.startsWith('/jb-test/'))return;
        if(url.hash==='#journey'){
          client.postMessage({type:'RUNSGD_SHELL_READY',cache:CACHE});
          return;
        }
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

  // The rescue page must always bypass the service worker, including during stale-cache recovery.
  if(url.pathname==='/update'||url.pathname.startsWith('/update/'))return;

  // Admin shell is network-first, with a cached fallback. This keeps the admin UI
  // reachable from the installed PWA when a fresh navigation is temporarily blocked,
  // while all admin data/auth checks still run live against Supabase.
  if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')){
    const key=url.pathname.endsWith('/')?url.pathname:(url.pathname+'/');
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok&&req.mode==='navigate'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(key,copy));}
      return res;
    }).catch(async()=>{
      const cached=await caches.match(key);
      if(cached)return cached;
      return new Response('RunSGD Admin is temporarily unreachable. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }));
    return;
  }

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