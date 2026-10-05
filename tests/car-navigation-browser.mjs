// Run with RUNSGD_TEST_BROWSER=/path/to/chromium node tests/car-navigation-browser.mjs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 try{
  const file=path.endsWith('/')?path+'index.html':path;
  const content=await readFile(new URL('..'+file,import.meta.url));
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/plain'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.RUNSGD_TEST_BROWSER});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(origin+'/#journey');
 await page.locator('.nav button[data-page="journey"]').click();
 // Exercise the real app and Google event wiring with deterministic renderer fixtures.
 await page.evaluate(()=>{
  class MapFixture{
   constructor(){window.__navMap=this;this.events={};this.heading=0;this.rendering='VECTOR';this.moves=[];this.ignoreRotation=false;}
   emit(name){for(const fn of this.events[name]||[])fn();}
   getHeading(){return this.heading;}
   getRenderingType(){return this.rendering;}
   getZoom(){return this.zoom;}
   moveCamera(camera){this.moves.push(camera);this.zoom=camera.zoom;if(!this.ignoreRotation){this.heading=camera.heading;this.emit('heading_changed');}}
   fitBounds(){}
  }
  class MarkerFixture{
   constructor(options){Object.assign(this,options);this.events={};}
   setMap(map){this.map=map;}
   getMap(){return this.map||null;}
   setPosition(position){this.position=position;}
   setIcon(icon){this.icon=icon;}
   setVisible(visible){this.visible=visible;}
   setLabel(label){this.label=label;}
  }
  window.google={maps:{Map:MapFixture,TrafficLayer:class{setMap(map){this.map=map;}getMap(){return this.map||null;}},Marker:MarkerFixture,Polyline:class{constructor(options){Object.assign(this,options);}setPath(path){this.path=path;}},LatLngBounds:class{extend(){}},RenderingType:{VECTOR:'VECTOR'},SymbolPath:{FORWARD_CLOSED_ARROW:'arrow',CIRCLE:'circle'},event:{addListener(map,name,fn){(map.events[name]??=[]).push(fn);}}}};
  function encode(points){let a=0,b=0,out='';for(const point of points){const c=Math.round(point.lat*1e5),d=Math.round(point.lon*1e5);for(let n of [c-a,d-b]){n=n<0?~(n<<1):n<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5;}out+=String.fromCharCode(n+63);}a=c;b=d;}return out;}
  const points=[{lat:1.3,lon:103.8},{lat:1.30045,lon:103.8},{lat:1.30045,lon:103.802}];
  const legs=[{mode:'DRIVE',polyline:encode(points.slice(0,2)),to:{name:'Turn',...points[1]},duration_sec:20},{mode:'DRIVE',polyline:encode(points.slice(1)),to:{name:'Destination',...points[2]},duration_sec:60}];
  sgJourney={status:'active',started_at:Date.now(),current_hop:0,destination:{name:'Camera test',...points[2]},route:{polyline:encode(points),legs}};
  Object.assign(sgJourneyRuntime,{roadCache:buildJourneyRoadCache(sgJourney.route),routeProgressM:30,offRouteM:0,lastLat:1.30027,lastLon:103.8,gpsUpdatedAt:Date.now(),gpsAccuracy:8,gpsSpeed:10,gpsHeading:0,currentStepRemainingM:20});
  // Navigation is a member feature; expose its shell without accessing an account.
  document.getElementById('journeyAuthGate').style.display='none';
  document.getElementById('journeyMemberShell').style.display='block';
  setJourneyPlannerState('live');renderSgJourney();
 });
 await page.locator('#sgJourneyProdMapWrap.show').waitFor();
 assert.equal(await page.evaluate(()=>__navMap.heading),0,'northbound before the corner');
 await page.evaluate(()=>__navMap.emit('dragstart'));
 assert.equal(await page.locator('#sgJourneyProdMapBadge').innerText(),'Following paused');
 assert.equal(await page.locator('#sgJourneyProdRecenter').innerText(),'Resume');
 const pausedMoves=await page.evaluate(()=>__navMap.moves.length);
 await page.evaluate(()=>{sgJourneyRuntime.gpsHeading=90;updateJourneyGoogleMapLive.lastAt=0;updateJourneyGoogleMapLive();});
 assert.equal(await page.evaluate(()=>__navMap.moves.length),pausedMoves);
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapVehicle.icon.rotation),90);
 // A route redraw must leave the user's browse state intact.
 await page.evaluate(async()=>{sgJourney.current_hop=1;await renderJourneyGoogleMap(true,sgJourney.route.legs[1],1,sgJourney.route.legs);});
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapFollowing),false);
 await page.locator('#sgJourneyProdRecenter').click();
 assert.equal(await page.evaluate(()=>__navMap.heading),90);
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapVehicle.icon.rotation),0);
 await page.evaluate(()=>{__navMap.heading=35;__navMap.emit('heading_changed');});
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapVehicle.icon.rotation),55,'actual heading event realigns marker');
 await page.evaluate(()=>{__navMap.ignoreRotation=true;__navMap.heading=0;sgJourneyRuntime.gpsHeading=180;updateJourneyGoogleMapLive.lastAt=0;updateJourneyGoogleMapLive();});
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapVehicle.icon.rotation),-180,'renderer ignoring heading does not mislead arrow');
 await page.evaluate(()=>{__navMap.ignoreRotation=false;__navMap.rendering='RASTER';__navMap.emit('renderingtype_changed');});
 assert.match(await page.locator('#sgJourneyProdMapBadge').innerText(),/North-up/);
 assert.equal(await page.evaluate(()=>__navMap.moves.at(-1).heading),0);
 await page.evaluate(()=>{document.getElementById('sgJourneyProdMap').dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:document.body}),new Touch({identifier:2,target:document.body})]}));});
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapFollowing),false,'pinch begins browse mode');
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.evaluate(()=>{document.getElementById('sgJourneyProdMap').dispatchEvent(new TouchEvent('touchend',{touches:[]}));});
 await page.clock.fastForward(7999);
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapFollowing),false);
 await page.clock.fastForward(1);
 assert.equal(await page.evaluate(()=>sgJourneyGoogleMapFollowing),true,'pinch ends and following resumes after eight seconds');
 for(const theme of ['classic','neobrutalism']){
  await page.evaluate(value=>{document.documentElement.dataset.runsgdTheme=value;pauseJourneyGoogleMapFollowing();},theme);
  for(const width of [320,390,480]){
   await page.setViewportSize({width,height:844});
   const boxes=await page.evaluate(()=>{const badge=document.getElementById('sgJourneyProdMapBadge').getBoundingClientRect(),button=document.getElementById('sgJourneyProdRecenter').getBoundingClientRect();return {badgeRight:badge.right,buttonLeft:button.left,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(boxes.badgeRight<=boxes.buttonLeft,'paused badge and resume button do not overlap at '+width+'px in '+theme+': '+JSON.stringify(boxes));
   assert.equal(boxes.overflow,false);
  }
 }
 // Singapore road layers use the real bundled LTA data and actual GPS reconciliation.
 await page.evaluate(async()=>{
  await loadSingaporeErpLocations();
  const line=sgJourneyErpData.gantries[0].lines[0],lat=(line[0][1]+line[1][1])/2,lon=(line[0][0]+line[1][0])/2;
  const dx=(line[1][0]-line[0][0])*Math.cos(lat*Math.PI/180),dy=line[1][1]-line[0][1],len=Math.hypot(dx,dy);
  const east=dy/len,north=-dx/len;
  const point=m=>({lat:lat+north*m/110540,lon:lon+east*m/(111320*Math.cos(lat*Math.PI/180))});
  const points=[point(-600),point(150)];
  function encode(points){let a=0,b=0,out='';for(const point of points){const c=Math.round(point.lat*1e5),d=Math.round(point.lon*1e5);for(let n of [c-a,d-b]){n=n<0?~(n<<1):n<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5;}out+=String.fromCharCode(n+63);}a=c;b=d;}return out;}
  const leg={mode:'DRIVE',from:points[0],to:{name:'ERP test end',...points[1]},polyline:encode(points),duration_sec:75,distance_m:750};
  sgJourney={status:'active',started_at:Date.now()+2,current_hop:0,destination:leg.to,route:{polyline:leg.polyline,legs:[leg]}};
  Object.assign(sgJourneyRuntime,{roadCache:buildJourneyRoadCache(sgJourney.route),routeProgressM:null,lastAcceptedRouteProgressM:null,lastAcceptedRouteAt:0,lastAcceptedGpsTimestamp:null,lastLat:points[0].lat,lastLon:points[0].lon,gpsUpdatedAt:0,gpsAccuracy:null,gpsError:false});
  window.__erpFix=m=>{const p=point(m);handleSgJourneyPosition({timestamp:Date.now(),coords:{latitude:p.lat,longitude:p.lon,accuracy:8,speed:10,heading:journeyBearing(points[0].lat,points[0].lon,points[1].lat,points[1].lon)}});};
  await renderJourneyGoogleMap(true,leg,0,[leg]);
  __erpFix(-400);
 });
 assert.equal(await page.locator('#sgJourneyRoadLayers').isVisible(),true);
 assert.equal(await page.evaluate(()=>sgJourneyTrafficLayer.getMap()===sgJourneyGoogleMap),true);
 assert.equal(await page.evaluate(()=>sgJourneyErpMarkers.filter(m=>m.getMap()).length),101);
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),false,'first fix does not warn');
 await page.clock.fastForward(1000);await page.evaluate(()=>__erpFix(-390));
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),true,'two accepted GPS fixes confirm ERP approach');
 assert.match(await page.locator('#sgJourneyErpWarningTitle').innerText(),/ERP location ahead/);
 assert.match(await page.locator('#sgJourneyErpWarningDetail').innerText(),/ERP 36/);
 for(const theme of ['classic','neobrutalism'])for(const width of [320,390,480]){
  await page.evaluate(value=>document.documentElement.dataset.runsgdTheme=value,theme);
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ERP controls fit '+theme+' '+width);
 }
 await page.locator('#sgJourneyErpWarning').scrollIntoViewIfNeeded();
 if(process.env.RUNSGD_TEST_SCREENSHOT)await page.screenshot({path:process.env.RUNSGD_TEST_SCREENSHOT});
 await page.evaluate(()=>sgJourneyErpMarkers[0].events.click[0]());
 assert.equal(await page.locator('#sgJourneyErpLocationDialog').isVisible(),true);
 await page.locator('#sgJourneyErpLocationDialog .utilityClose').click();
 await page.locator('#sgJourneyErpToggle').click();
 assert.equal(await page.evaluate(()=>sgJourneyErpMarkers.filter(m=>m.getMap()).length),0);
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),false);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.runsgdSingaporeRoadLayers).erp),false);
 await page.locator('#sgJourneyErpToggle').click();
 assert.equal(await page.evaluate(()=>sgJourneyErpMarkers.filter(m=>m.getMap()).length),101);
 await page.locator('#sgJourneyTrafficToggle').click();
 assert.equal(await page.evaluate(()=>sgJourneyTrafficLayer.getMap()),null);
 assert.equal(await page.locator('#sgJourneyTrafficLegend').isVisible(),false);
 await page.locator('#sgJourneyTrafficToggle').click();
 // A later drive leg after a walking/manual boundary must not warn early.
 await page.evaluate(()=>{
  window.__erpOriginalRoute=sgJourney.route;window.__erpOriginalEnd=sgJourneyRuntime.roadCache.legEnds[0];
  const leg=sgJourney.route.legs[0];sgJourney.route={...sgJourney.route,legs:[leg,{mode:'WALK'},leg]};
  sgJourneyRuntime.roadCache.legEnds[0]=100;
 });
 await page.clock.fastForward(1000);await page.evaluate(()=>__erpFix(-385));
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),false,'do not warn across a non-driving leg');
 await page.evaluate(()=>{sgJourney.route=__erpOriginalRoute;sgJourneyRuntime.roadCache.legEnds[0]=__erpOriginalEnd;});
 await page.clock.fastForward(1000);await page.evaluate(()=>__erpFix(-382));
 // A stale fix clears the warning even without another GPS callback.
 await page.clock.fastForward(1000);await page.evaluate(()=>__erpFix(-380));
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),true);
 await page.clock.fastForward(7000);await page.evaluate(()=>updateJourneyGpsHealth());
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),false);
 await page.evaluate(()=>{sgJourneyRuntime.lastLat=1.46;sgJourneyRuntime.lastLon=103.76;updateSingaporeRoadLayers();});
 assert.equal(await page.locator('#sgJourneyRoadLayers').isVisible(),true,'traffic also appears in Johor');
 assert.equal(await page.locator('#sgJourneyErpToggle').isVisible(),false,'ERP remains Singapore only');
 assert.equal(await page.evaluate(()=>sgJourneyTrafficLayer.getMap()===sgJourneyGoogleMap),true);
 assert.equal(await page.evaluate(()=>sgJourneyErpMarkers.filter(m=>m.getMap()).length),0);
 await page.evaluate(()=>{__erpFix(-370);stopSgJourneyTracking();sgJourney.status='ended';});
 assert.equal(await page.evaluate(()=>sgJourneyTrafficLayer.getMap()),null,'ending tracking detaches layers');
 assert.equal(await page.locator('#sgJourneyErpWarning').isVisible(),false);
 // Restore camera fixture route for the walking regression.
 await page.evaluate(()=>{
  const points=[{lat:1.3,lon:103.8},{lat:1.30045,lon:103.8},{lat:1.30045,lon:103.802}];
  function encode(points){let a=0,b=0,out='';for(const point of points){const c=Math.round(point.lat*1e5),d=Math.round(point.lon*1e5);for(let n of [c-a,d-b]){n=n<0?~(n<<1):n<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5;}out+=String.fromCharCode(n+63);}a=c;b=d;}return out;}
  sgJourney.status='active';sgJourney.route={polyline:encode(points),legs:[{mode:'DRIVE',polyline:encode(points.slice(0,2)),to:points[1]},{mode:'DRIVE',polyline:encode(points.slice(1)),to:points[2]}]};
 });
 await page.evaluate(()=>{
  const [first,second]=sgJourney.route.legs;
  const leg={mode:'WALK',step_polylines:[first.polyline,second.polyline],polyline:sgJourney.route.polyline,walk_instructions:[{lat:1.3,lon:103.8,instruction:'Walk north',polyline:first.polyline},{lat:1.30045,lon:103.8,instruction:'Turn right',polyline:second.polyline}],to:second.to,duration_sec:300};
  sgJourney={...sgJourney,current_hop:0,started_at:Date.now()+1,route:{...sgJourney.route,legs:[leg]}};
  const caches=buildJourneyWalkCaches(sgJourney.route);
  Object.assign(sgJourneyRuntime,{walkCaches:caches,walkProgressM:0,walkTotalM:caches[0].total,walkRemainingM:caches[0].total,walkOffPathM:0,walkNextInstruction:null,lastLat:1.3,lastLon:103.8});
  recenterJourneyGoogleMap();renderSgJourney();
 });
 await page.waitForFunction(()=>sgJourneyGoogleMapRoute.path.length===3);
 const walking=await page.evaluate(()=>({mapPoints:sgJourneyGoogleMapRoute.path.length,cachePoints:sgJourneyRuntime.walkCaches[0].points.length,distance:sgJourneyRuntime.walkCaches[0].total,instructions:sgJourneyRuntime.walkCaches[0].instructions.length}));
 assert.equal(walking.cachePoints,walking.mapPoints,'walking drawing and matching agree');
 assert.ok(walking.distance>270&&walking.distance<280,'walking distance counts the route once');
 assert.equal(walking.instructions,2);
 assert.match(await page.locator('#sgJourneyAction').innerText(),/Follow pedestrian path/);
 assert.deepEqual(errors,[],'no app runtime errors');
 console.log('Navigation browser passed: event wiring, rotation fallback, mobile themes, gesture recovery, Singapore traffic/ERP GPS warnings and walking geometry/distance.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
