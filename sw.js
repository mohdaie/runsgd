const CACHE='runsgd-shell-v21700';
const ADMIN_CACHE='runsgd-admin-shell-v1';
const adminPath=p=>p.replace(/\/index\.html\/?$/,'/').replace(/^(\/admin(?:\/[^.]+)*)$/,'$1/');
const isAdmin=p=>p==='/admin'||p.startsWith('/admin/');
const appPath=p=>p==='/app'||p==='/app/'||p==='/app/index.html';
const pageKey=p=>appPath(p)?'/app/':p==='/index.html'?'/':p;
const SHELL=['/app/','/','/assets/theme.js?v=2.17.0','/assets/themes.css?v=2.17.0','/assets/singapore-road-alerts.js?v=2.17.0','/assets/live-traffic.js?v=2.17.0','/assets/singapore-erp.json?v=2.17.0','/assets/regions.js','/assets/vendor/supabase-js-2.117.2.js','/assets/app-entry.js?v=2.17.0','/assets/landing/landing.css?v=2.17.0','/assets/landing/landing.js?v=2.17.0','/assets/landing/approved-top.webp','/assets/landing/approved-middle.webp','/assets/landing/approved-bottom.webp','/manifest.webmanifest','/icon.svg','/assets/landmarks/jb/bangunan-sultan-iskandar.webp','/assets/landmarks/jb/sultan-ibrahim-stadium.webp','/assets/landmarks/jb/istana-besar-johor.webp','/assets/landmarks/jb/sultan-abu-bakar-state-mosque.webp','/assets/landmarks/jb/johor-bahru-old-chinese-temple.webp'];

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
      // Keep the installed worker and its assets if the replacement app cannot load.
      // Never activate a marketing-only shell over an existing offline app.
      if(!await cache.match('/app/'))throw new Error('New app shell unavailable');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    // Preserve already-visited public Admin HTML before replacing the app shell.
    // Auth checks and dashboard data still load live; no API responses are copied.
    const admin=await caches.open(ADMIN_CACHE);
    for(const name of keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE)){
      const old=await caches.open(name);
      for(const req of await old.keys()){
        const url=new URL(req.url);if(!isAdmin(url.pathname))continue;
        const res=await old.match(req);
        if(res?.ok&&res.headers.get('Content-Type')?.includes('text/html'))await admin.put(adminPath(url.pathname),res);
      }
    }
    await Promise.all(keys.filter(k=>k.startsWith('runsgd-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
    try{await self.registration.navigationPreload?.enable()}catch{}
    await self.clients.claim();

    // Push already-open stale clients onto the newly activated shell.
    // Never interrupt a user who is visibly on the live Journey screen.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(windows.map(async client=>{
      try{
        const url=new URL(client.url);
        if(url.pathname!=='/'&&url.pathname!=='/index.html'&&!appPath(url.pathname))return;
        if(url.hash==='#journey'){
          client.postMessage({type:'RUNSGD_SHELL_READY',cache:CACHE});
          return;
        }
        // Fresh root visits stay on the landing page; explicit old app links migrate.
        if(!appPath(url.pathname)&&(['#home','#explore','#community','#more','#signin'].includes(url.hash)||['appv','resume','mobile','auth','code'].some(k=>url.searchParams.has(k))))url.pathname='/app/';
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

  // Admin HTML has its own on-visit cache, independent of public app updates.
  if(isAdmin(url.pathname)){
    if(req.mode!=='navigate'&&!url.pathname.endsWith('.html'))return;
    const key=adminPath(url.pathname);
    event.respondWith((async()=>{
      let res;
      try{res=await event.preloadResponse}catch{}
      if(!res){try{res=await fetch(req,{cache:'no-store'})}catch{}}
      if(res?.ok){
        if(res.headers.get('Content-Type')?.includes('text/html')){
          try{await (await caches.open(ADMIN_CACHE)).put(key,res.clone())}catch{}
        }
        return res;
      }
      // Preserve real permission/not-found responses; only recover network/server outages.
      if(res&&res.status<500)return res;
      let cached;try{cached=await (await caches.open(ADMIN_CACHE)).match(key)}catch{}
      if(cached)return cached;
      return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reconnect to RunSGD Admin</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fbff;color:#17213b;font:16px system-ui}main{width:min(420px,100%);padding:26px;border:2px solid #17213b;border-radius:24px;background:#fff;box-shadow:6px 6px #17213b}h1{font-size:24px}p{line-height:1.6}a,button{display:block;width:100%;margin-top:14px;padding:14px;border:2px solid #17213b;border-radius:14px;font:700 16px system-ui;text-align:center;text-decoration:none;color:#17213b;background:#ffe16a}button{background:#1456f0;color:#fff}</style><main><b>runSGD.</b><h1>Admin connection interrupted</h1><p>The dashboard couldn’t load. Retry, or open the recovery page to bypass the app cache.</p><button onclick="location.reload()">Retry Admin</button><a href="/update/admin/">Open Admin recovery</a><a href="/update/?auth=rescue">Repair app cache</a><a href="/app/">Back to RunSGD</a></main></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    })());
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
  if(req.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'||appPath(url.pathname)){
    const key=pageKey(url.pathname)||'/';
    event.respondWith(Promise.resolve(event.preloadResponse).catch(()=>null).then(res=>res||fetch(req,{cache:'no-store'})).then(async res=>{
      if(res.status>=500)throw new Error('HTML server unavailable');
      if(res.ok){try{await (await caches.open(CACHE)).put(key,res.clone())}catch{}}
      return res;
    }).catch(async()=>{
      if(url.searchParams.has('appv')||url.searchParams.has('_runsgd_probe')){
        return new Response('RunSGD is updating. Reconnect and refresh to load the latest version.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
      }
      const exact=await caches.match(key);
      if(exact)return exact;
      // Never serve the marketing page as the app, or the app as marketing.
      if(key==='/app/')return new Response('RunSGD app is offline. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
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
