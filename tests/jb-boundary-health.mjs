import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
const regions=readFileSync(new URL('../assets/regions.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../supabase/functions/runsgd-route-jb/index.ts',import.meta.url),'utf8').replace(/^import [^;]+;\s*/gm,'');
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
let handler,placeScenario='normal',failedMode='',requests=[];
const context={Request,Response,AbortSignal,performance,console,Deno:{env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake'}[k]||'')},serve:fn=>handler=fn},fetch:async(url,init={})=>{
 if(url.includes('app_settings'))return Response.json([{secret_value:'fake'}]);
 if(url.includes('google_maps_usage_events'))return new Response(null,{status:204});
 const body=JSON.parse(init.body);requests.push({url,body});
 if(url.includes('places:searchText'))return Response.json({places:placeScenario==='empty'?[]:[
  {id:'jb-city-square',displayName:{text:'Johor Bahru City Square'},formattedAddress:'Johor, Malaysia',location:{latitude:1.461194,longitude:103.764194}},
  {id:'sg-city-square',displayName:{text:'City Square Mall'},location:{latitude:1.3116,longitude:103.8564}},
 ]});
 if(body.travelMode===failedMode)return Response.json({error:{message:'Simulated '+failedMode+' provider outage'}},{status:503});
 const start=body.origin.location.latLng,end=body.destination.location.latLng;
 return Response.json({routes:[{duration:'600s',distanceMeters:3500,polyline:{encodedPolyline:'geometry'},legs:[{steps:[{travelMode:body.travelMode,staticDuration:'600s',startLocation:{latLng:start},endLocation:{latLng:end}}]}]}]});
}};
runInNewContext(regions,context);
runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),context);
const cases=[
 ['City Square',1.461194,103.764194,'MY'],['JB CIQ',1.4637,103.7648,'MY'],['Forest City',1.3366,103.5901,'MY'],['Pasir Gudang',1.4620,103.9020,'MY'],['KSL',1.4858,103.7624,'MY'],
 ['Woodlands Checkpoint',1.4459,103.7686,'SG'],['Woodlands town',1.4382,103.7890,'SG'],['Sembawang',1.4491,103.8185,'SG'],['Tuas Checkpoint',1.3501,103.6367,'SG'],['Changi Airport',1.3644,103.9915,'SG'],['Punggol',1.4051,103.9023,'SG'],['Tanjong Pagar',1.276,103.8465,'SG'],
];
// Execute the actual frontend classifier against the shared geometry.
const start=html.indexOf('function classify('),end=html.indexOf('\nfunction requestLocation(',start);
runInNewContext(html.slice(start,end),context);
for(const [name,lat,lon,country] of cases){
 const r=context.RunSGDRegions;
 assert.equal(r.inSingapore(lat,lon),country==='SG',name+' server SG classification');
 assert.equal(r.inJohor(lat,lon),country==='MY',name+' server Johor classification');
 assert.equal(context.classify(lat,lon).country,country,name+' browser classification');
}
assert.equal(context.RunSGDRegions.inSingapore(NaN,103.8),false);
assert.equal(context.RunSGDRegions.inJohor(0,0),false);
async function invoke(body){const r=await handler(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,j:await r.json()};}
let r=await invoke({action:'search',q:'Johor Bahru City Square'});
assert.equal(r.j.results.length,1,'JB City Square retained; Singapore mall filtered');
assert.equal(r.j.results[0].id,'jb-city-square');
r=await invoke({action:'status'});
assert.equal(r.j.connected,true);assert.equal(r.j.checks.length,3);assert.equal(r.j.places,true);assert.equal(r.j.routes,true);
assert.equal(r.j.checks[0].filtered_count,1);
placeScenario='empty';requests=[];
r=await invoke({action:'status'});
assert.equal(r.j.connected,false);assert.equal(r.j.places,false);assert.equal(r.j.routes,true,'search failure does not fail road modes');
assert.equal(requests.filter(x=>x.body.travelMode==='DRIVE').length,1,'driving ran after empty Places');
assert.equal(requests.filter(x=>x.body.travelMode==='TWO_WHEELER').length,1,'motorcycle ran after empty Places');
assert.match(r.j.checks[0].detail,/provider_result_count/);
placeScenario='normal';failedMode='DRIVE';
r=await invoke({action:'status'});
assert.equal(r.j.checks.find(x=>x.id==='drive').ok,false);assert.equal(r.j.checks.find(x=>x.id==='places').ok,true);assert.equal(r.j.checks.find(x=>x.id==='two_wheeler').ok,true);
failedMode='';requests=[];
r=await invoke({action:'status',check:'drive'});
assert.equal(r.j.checks.length,1);assert.equal(requests.length,1,'single-mode probe avoids other provider calls');
r=await invoke({action:'status',check:'bad'});assert.equal(r.status,400);
console.log('12 real locations pass shared browser/server classification; City Square filtering and independent health failure scenarios passed.');
const cached={lat:1.461194,lon:103.764194,country:'SG',name:'Woodlands, SG',detected_at:123456,accuracy_m:8};
const storage=new Map([['runsgdLocation',JSON.stringify(cached)]]);
context.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
context.live={};context.txt=()=>{};context.updateSgRouteOrigin=()=>{};
const restoreStart=html.indexOf('function restoreLocation(');
runInNewContext(html.slice(restoreStart,html.indexOf('\nfunction classify(',restoreStart)),context);
context.restoreLocation();
assert.equal(context.live.location.country,'MY','correct persisted country on startup');
assert.equal(context.live.location.detected_at,123456,'never treat a cached fix as fresh');
assert.equal(context.live.location.accuracy_m,8);

const healthSource=readFileSync(new URL('../supabase/functions/extensive-health/index.ts',import.meta.url),'utf8');
const healthStart=healthSource.indexOf('    // One provider pass, three independently recorded health results.');
const healthBlock=healthSource.slice(healthStart,healthSource.indexOf('    checks.push(await makeCheck("jb-transit-e2e"',healthStart));
for(const failedId of ['places','drive']){
 const c={callFunction:async()=>({json:{checks:['places','drive','two_wheeler'].map(id=>({id,ok:id!==failedId,detail:id+' result',latency_ms:125}))}}),safeError:e=>e.message,makeCheck:async(id,name,group,fn)=>{try{return {check_id:id,status:'healthy',...(await fn())};}catch(e){return {check_id:id,status:'failed',detail:e.message};}}};
 runInNewContext(stripTypeScriptTypes('async function checkMonitor(){const checks=[];'+healthBlock+'return checks;}',{mode:'strip'}),c);
 const results=await c.checkMonitor();
 assert.equal(results.length,3);
 assert.equal(results.filter(x=>x.status==='failed').length,1);
 assert.equal(results.find(x=>x.check_id==='jb-'+(failedId==='places'?'places':'drive-e2e')).status,'failed');
 assert.ok(results.every(x=>x.latency_ms===125),'provider timing is preserved');
}
console.log('Cached GPS classification preserves age; monitoring records only the failed dependency.');
const versionLogic=readFileSync(new URL('../supabase/functions/extensive-health/index.ts',import.meta.url),'utf8').match(/const versionParts=repoV\.split\('\.'\);[\s\S]*?const swMatch=/)[0].replace('const swMatch=','');
for(const [repoV,expected] of [['2.16.9','21609'],['2.16.10','21610']]){
 const c={repoV};runInNewContext(versionLogic+';globalThis.cacheVersion=compact;',c);
 assert.equal(c.cacheVersion,expected,'health check agrees with padded cache version');
}
console.log('Deployment health cache-version comparison passed.');
