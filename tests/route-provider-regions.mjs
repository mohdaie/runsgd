import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../supabase/functions/runsgd-route-jb/index.ts',import.meta.url),'utf8')
 .replace(/^import [^;]+;\s*/gm,'');
const requestBodies=[];
let handler;
const context={
 Request,Response,AbortSignal,Set,Map,Date,console,
 Deno:{
  env:{get:key=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fake'}[key]||'')},
  serve:callback=>{handler=callback},
 },
 fetch:async(url,init={})=>{
  if(url.includes('/app_settings?'))return Response.json([{secret_value:'fake-google-key'}]);
  if(url.includes('/google_maps_usage_events'))return new Response(null,{status:204});
  assert.match(url,/routes\.googleapis\.com/);
  const body=JSON.parse(init.body);
  requestBodies.push(body);
  const start=body.origin.location.latLng,end=body.destination.location.latLng;
  return Response.json({routes:[{
   duration:'1800s',distanceMeters:12000,
   legs:[{steps:[{
    travelMode:body.travelMode==='TRANSIT'?'TRANSIT':body.travelMode,
    staticDuration:'1800s',distanceMeters:12000,
    startLocation:{latLng:start},endLocation:{latLng:end},
    transitDetails:body.travelMode==='TRANSIT'?{
     transitLine:{name:'North South Line',nameShort:'NS',vehicle:{type:'SUBWAY'}},
     stopDetails:{departureStop:{name:'Origin Station',location:{latLng:start}},arrivalStop:{name:'Destination Station',location:{latLng:end}}},
    }:undefined,
   }]}],
  }]});
 },
};
runInNewContext(readFileSync(new URL('../assets/regions.js',import.meta.url),'utf8'),context);
runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),context);
assert.equal(typeof handler,'function');

const sg={lat:1.2808,lon:103.8510},woodlands={lat:1.4459,lon:103.7686},jb={lat:1.4637,lon:103.7648},johor={lat:1.4900,lon:103.7500};
async function route(from,to,travel_mode='TRANSIT',transit_preference=''){
 const response=await handler(new Request('https://example.test/functions/v1/runsgd-route-jb',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'route',from,to:{...to,name:'Destination'},travel_mode,transit_preference}),
 }));
 return {status:response.status,data:await response.json()};
}
let r=await route(woodlands,sg);
assert.equal(r.status,200);
assert.equal(r.data.region,'Singapore');
assert.equal(r.data.cross_border,false,'Singapore transit is not a border road route');
assert.equal(requestBodies[0].travelMode,'TRANSIT');
assert.equal(requestBodies[0].transitPreferences,undefined,'Google chooses the standard Singapore route by default');

r=await route(jb,johor);
assert.equal(r.status,200);
assert.equal(r.data.region,'Johor Bahru');
assert.equal(r.data.cross_border,false);
assert.equal(requestBodies[1].transitPreferences.routingPreference,'LESS_WALKING','keep existing Johor preference');

r=await route(woodlands,sg,'TRANSIT','FEWER_TRANSFERS');
assert.equal(r.status,200);
assert.equal(requestBodies[2].transitPreferences.routingPreference,'FEWER_TRANSFERS');

const count=requestBodies.length;
r=await route(woodlands,jb);
assert.equal(r.status,400);
assert.equal(requestBodies.length,count,'do not pay Google for invalid cross-border transit');

r=await route(jb,sg,'DRIVE');
assert.equal(r.status,200);
assert.equal(r.data.cross_border,true);
assert.equal(r.data.routes[0].border_variable,true,'border road ETA still excludes the checkpoint');
console.log('Google route service region validation and transit request regression passed');
