import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
let handler,now=1000000,google=[],events=[],failCurrent=false,failBest=false;
class Clock extends Date{static now(){return now}}
const context={Request,Response,AbortSignal,Set,Map,Date:Clock,console,Promise,Deno:{env:{get:k=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fake'}[k]||'')},serve:f=>handler=f},fetch:async(url,init)=>{
 if(url.includes('/auth/v1/user'))return init.headers.Authorization==='Bearer valid'?Response.json({id:'user-1'}):Response.json({error:'invalid'},{status:401});
 if(url.includes('/app_settings?'))return Response.json([{secret_value:'fake-google'}]);
 if(url.includes('/google_maps_usage_events')){events.push(JSON.parse(init.body));return new Response(null,{status:204})}
 assert.ok(url.includes('routes.googleapis.com'));assert.ok(init.headers['X-Goog-FieldMask'].split(',').includes('routes.staticDuration'));const b=JSON.parse(init.body);google.push(b);
 if(b.intermediates?failCurrent:failBest)return Response.json({error:{message:'provider unavailable'}},{status:503});
 const duration=b.intermediates?900:600,start=b.origin.location.latLng,end=b.destination.location.latLng;
 return Response.json({routes:[{duration:duration+'s',staticDuration:'300s',distanceMeters:2000,polyline:{encodedPolyline:'test'},legs:[{steps:[{travelMode:b.travelMode,staticDuration:'100s',distanceMeters:800,startLocation:{latLng:start},endLocation:{latLng:{latitude:1.5,longitude:103.76}},polyline:{encodedPolyline:'test'}},{travelMode:b.travelMode,staticDuration:'200s',distanceMeters:1200,startLocation:{latLng:{latitude:1.5,longitude:103.76}},endLocation:{latLng:end},polyline:{encodedPolyline:'test'}}]}]}]});
}};
runInNewContext(readFileSync(new URL('../assets/regions.js',import.meta.url),'utf8'),context);
runInNewContext(stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/runsgd-route-jb/index.ts',import.meta.url),'utf8').replace(/^import [^;]+;\s*/gm,'')),context);
const payload={action:'traffic_refresh',travel_mode:'DRIVE',from:{lat:1.5,lon:103.75},to:{lat:1.5,lon:103.77,name:'End'},via:[{lat:1.5,lon:103.76}]};
async function call(body=payload,token='valid'){const r=await handler(new Request('https://example.test/traffic',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}
assert.equal((await call(payload,'invalid')).status,401);assert.equal(google.length,0,'unauthorized calls cost nothing');
assert.equal((await call({...payload,travel_mode:'WALK'})).status,400);assert.equal((await call({...payload,from:{lat:null,lon:103.75}})).status,400);assert.equal((await call({...payload,via:Array(7).fill(payload.via[0])})).status,400);assert.equal(google.length,0);
let r=await call();assert.equal(r.status,200);assert.equal(r.data.query_count,2);assert.equal(google.length,2);assert.equal(google[0].intermediates[0].via,true);assert.equal(google[0].computeAlternativeRoutes,false);assert.equal(google[1].computeAlternativeRoutes,true);assert.ok(google.every(b=>b.routingPreference==='TRAFFIC_AWARE'));
assert.equal(r.data.current.duration_sec,900);assert.equal(r.data.current.legs.reduce((n,l)=>n+l.duration_sec,0),900,'live duration replaces static step totals');assert.equal(r.data.routes[0].legs.reduce((n,l)=>n+l.duration_sec,0),600);
assert.deepEqual(events.map(e=>e.action),['routes_compute','routes_compute'],'every paid query remains in the existing monitor');
assert.equal((await call()).status,429);assert.equal(google.length,2,'cooldown before provider call');
now+=120000;failCurrent=true;r=await call();assert.equal(r.status,200);assert.equal(r.data.current,null);assert.equal(r.data.routes.length,1,'best response survives a failed baseline');
now+=120000;failCurrent=false;failBest=true;r=await call();assert.equal(r.status,200);assert.ok(r.data.current);assert.equal(r.data.routes.length,0,'baseline response survives failed alternative');
now+=120000;failBest=false;r=await call({...payload,travel_mode:'TWO_WHEELER',via:[]});assert.equal(r.status,200);assert.equal(r.data.query_count,1);assert.equal(r.data.routes[0].travel_mode,'TWO_WHEELER');
for(let i=0;i<6;i++){now+=120000;assert.equal((await call()).status,200)}
now+=120000;const before=google.length;r=await call();assert.equal(r.status,429);assert.equal(google.length,before,'hourly guard prevents provider calls');
console.log('Traffic route service passed: authentication, regional/input validation, traffic durations, via routing, query accounting, partial provider failures and throttling.');
