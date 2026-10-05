// Real app GPS/ETA/rerouting integration; external services are deterministic fixtures.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path==='/'||path==='/app/')path+='index.html';const data=await readFile(new URL('..'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/json'});res.end(data)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.RUNSGD_TEST_BROWSER});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/app/#journey');await page.locator('.nav button[data-page="journey"]').click();await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.evaluate(()=>{
  class MapFixture{constructor(){this.events={};this.heading=0;this.rendering='VECTOR'}getHeading(){return this.heading}getRenderingType(){return this.rendering}getZoom(){return this.zoom}moveCamera(c){this.heading=c.heading;this.zoom=c.zoom}fitBounds(){}}
  class Marker{constructor(o){Object.assign(this,o);this.events={}}setMap(m){this.map=m}getMap(){return this.map||null}setPosition(p){this.position=p}setIcon(i){this.icon=i}setVisible(v){this.visible=v}setLabel(l){this.label=l}}
  window.google={maps:{Map:MapFixture,Marker,TrafficLayer:class{setMap(m){this.map=m}getMap(){return this.map||null}},Polyline:class{constructor(o){Object.assign(this,o)}setPath(p){this.path=p}},LatLngBounds:class{extend(){}},RenderingType:{VECTOR:'VECTOR'},SymbolPath:{CIRCLE:'circle',FORWARD_CLOSED_ARROW:'arrow'},event:{addListener(m,n,f){(m.events[n]??=[]).push(f)}}}};
  window.__encode=points=>{let a=0,b=0,out='';for(const p of points){const c=Math.round(p.lat*1e5),d=Math.round(p.lon*1e5);for(let n of [c-a,d-b]){n=n<0?~(n<<1):n<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5}out+=String.fromCharCode(n+63)}a=c;b=d}return out};
  window.__makeRoute=(from,to,seconds=600,detour=false,mode='DRIVE')=>{const points=detour?[from,{lat:from.lat+.002,lon:from.lon},{lat:to.lat+.002,lon:to.lon},to]:[from,to],polyline=__encode(points),distance=RunSGDTraffic.cache(points).total;return {duration_sec:seconds,distance_m:distance,polyline,legs:[{mode,duration_sec:seconds,distance_m:distance,from:{...from,name:'Start'},to:{...to,name:'End'},polyline,instruction:'Continue on the road'}]}};
  window.__setJourney=(future=[])=>{cancelJourneyTrafficRefresh();window.__resolve=null;const from={lat:1.5,lon:103.75},to={lat:1.5,lon:103.77},route=__makeRoute(from,to);route.legs.push(...future);sgJourney={status:'active',started_at:Date.now(),current_hop:0,destination:{...to,name:'Johor destination'},route};Object.assign(sgJourneyRuntime,{lastLat:from.lat,lastLon:from.lon,roadCache:buildJourneyRoadCache(route),routeProgressM:null,lastAcceptedRouteProgressM:null,lastAcceptedRouteAt:0,lastAcceptedGpsTimestamp:null,currentStepRemainingM:null,currentStepProgressPct:null,stepProgressHop:null,stepProgressM:null,turnConfirmHop:null,turnConfirmCount:0,arrivalConfirmCount:0,gpsAccuracy:8,gpsSpeed:8,gpsHeading:90,gpsUpdatedAt:Date.now(),gpsError:false,hopEntryConfirmed:true,offRouteM:0});setJourneyPlannerState('live');renderSgJourney()};
  window.__fix=(lon=103.75,lat=1.5,accuracy=8)=>handleSgJourneyPosition({timestamp:Date.now(),coords:{latitude:lat,longitude:lon,accuracy,speed:8,heading:90}});
  sb.auth.getSession=async()=>({data:{session:{access_token:'test-session'}}});
  const originalFetch=window.fetch;window.__requests=[];window.__responseKind='same';
  window.fetch=async(url,init={})=>{
   if(String(url).includes('runsgd-route-jb')){const body=JSON.parse(init.body||'{}');if(body.action!=='traffic_refresh')return Response.json({recorded:true});__requests.push(body);
    if(__responseKind==='error')return Response.json({error:'Temporary outage'},{status:503});
    if(__responseKind==='pending')return new Promise((resolve,reject)=>{window.__resolve=()=>resolve(Response.json({current:__makeRoute(body.from,body.to,900),routes:[__makeRoute(body.from,body.to,600,true)],query_count:2}));init.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))});
    const current=__makeRoute(body.from,body.to,900),candidate=__makeRoute(body.from,body.to,__responseKind==='faster'?500:900,__responseKind==='faster',body.travel_mode);
    return Response.json({current,routes:[candidate],query_count:body.via.length?2:1});
   }return originalFetch(url,init)
  };
  document.getElementById('journeyAuthGate').style.display='none';document.getElementById('journeyMemberShell').style.display='block';__setJourney();__fix();
 });
 await page.locator('#sgJourneyProdMapWrap.show').waitFor();
 assert.equal(await page.evaluate(()=>sgJourneyTrafficLayer.getMap()===sgJourneyGoogleMap),true,'Johor traffic layer attached');assert.equal(await page.locator('#sgJourneyErpToggle').isVisible(),false);assert.match(await page.locator('#sgJourneyEta').innerText(),/10 min/);
 await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>__requests.length),1);assert.match(await page.locator('#sgJourneyEta').innerText(),/15 min/,'same road ETA reflects refreshed traffic');
 await page.clock.fastForward(1000);await page.evaluate(()=>__fix(103.76));assert.ok(Math.abs(await page.evaluate(()=>journeyLiveRemainingSeconds())-450)<1,'ETA decreases as route progress advances');
 assert.equal(await page.evaluate(()=>__requests.length),1,'GPS fixes do not make route queries');
 await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>__requests.length),1,'manual refresh respects cooldown');
 for(const theme of ['classic','neobrutalism'])for(const width of [320,390,480]){await page.evaluate(t=>document.documentElement.dataset.runsgdTheme=t,theme);await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 // Auto updates can be disabled and the preference survives a new page.
 await page.locator('#sgJourneyTrafficUpdatesToggle').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.runsgdLiveTrafficUpdates)),false);
 await page.clock.fastForward(600000);await page.evaluate(()=>{__fix(103.76);journeyTrafficRefreshTick()});assert.equal(await page.evaluate(()=>__requests.length),1,'auto-off performs no queries');
 await page.locator('#sgJourneyTrafficUpdatesToggle').click();await page.evaluate(()=>{__fix(103.76);journeyTrafficRefreshTick()});await page.waitForFunction(()=>!sgJourneyTrafficState.controller);assert.equal(await page.evaluate(()=>__requests.length),2,'one periodic check after ten minutes');
 // Faster route comparison preserves future manual and walking stages.
 await page.evaluate(()=>{__setJourney([{mode:'IMMIGRATION',manual:true,to:{lat:1.5,lon:103.77},duration_sec:0},{mode:'WALK',to:{lat:1.5001,lon:103.77},duration_sec:300}]);__responseKind='faster';__fix()});
 await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>sgJourney.reroute_count),1);assert.deepEqual(await page.evaluate(()=>sgJourney.route.legs.map(l=>l.mode)),['DRIVE','IMMIGRATION','WALK']);assert.match(await page.locator('#sgJourneyTrafficStatus').innerText(),/Faster route active/);assert.match(await page.locator('#sgJourneyEta').innerText(),/partial timing/);
 // A response for a route the user has since replaced cannot overwrite it.
 await page.evaluate(()=>{__setJourney();__responseKind='pending';__fix();refreshJourneyTraffic()});await page.waitForFunction(()=>!!window.__resolve);
 await page.evaluate(()=>{sgJourney.route={...sgJourney.route,label:'user-replaced'};__resolve()});await page.waitForFunction(()=>!sgJourneyTrafficState.controller);assert.equal(await page.evaluate(()=>sgJourney.route.label),'user-replaced');assert.equal(await page.evaluate(()=>sgJourney.reroute_count||0),0);
 // Provider failure keeps route geometry, destination and navigation progress.
 await page.evaluate(()=>{__setJourney();__responseKind='error';__fix();window.__oldRoute=sgJourney.route});await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>sgJourney.route===__oldRoute),true);assert.match(await page.locator('#sgJourneyTrafficStatus').innerText(),/unavailable/);
 // Weak or stale GPS never pays for an update.
 await page.evaluate(()=>{__setJourney();__fix(103.75,1.5,80)});const weakCount=await page.evaluate(()=>__requests.length);await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>__requests.length),weakCount);
 await page.evaluate(()=>{__fix();sgJourneyRuntime.gpsUpdatedAt=Date.now()-7000});await page.evaluate(()=>refreshJourneyTraffic());assert.equal(await page.evaluate(()=>__requests.length),weakCount);
 // Three distinct fixes and ten seconds off route initiate one automatic reroute.
 await page.evaluate(()=>{__setJourney();__responseKind='same';__fix(103.75,1.502);journeyTrafficRefreshTick()});const offCount=await page.evaluate(()=>__requests.length);
 await page.clock.fastForward(5000);await page.evaluate(()=>{__fix(103.7501,1.502);journeyTrafficRefreshTick()});assert.equal(await page.evaluate(()=>__requests.length),offCount);
 await page.clock.fastForward(5000);await page.evaluate(()=>{__fix(103.7502,1.502);journeyTrafficRefreshTick()});await page.waitForFunction(()=>!sgJourneyTrafficState.controller);assert.equal(await page.evaluate(()=>__requests.length),offCount+1);assert.equal(await page.evaluate(()=>sgJourney.reroute_count),1);
 assert.match(await page.locator('#sgJourneyTrafficStatus').innerText(),/Route updated from your position/);
 // Ending the journey aborts a pending response.
 await page.evaluate(()=>{__setJourney();__responseKind='pending';__fix();refreshJourneyTraffic()});await page.waitForFunction(()=>!!sgJourneyTrafficState.controller);await page.evaluate(()=>{stopSgJourneyTracking();sgJourney.status='ended'});assert.equal(await page.evaluate(()=>sgJourneyTrafficState.controller),null);
 assert.deepEqual(errors,[]);console.log('Live traffic browser passed: Johor layer, refreshed/progress ETA, cooldown, auto preference, periodic refresh, faster/off-route reroutes, mixed stages, outdated responses, failure retention, GPS quality and cleanup.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
