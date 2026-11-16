import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Regression: typing "BUS" in the journey planner must return bus routes, not MRT.
const source=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
function actual(name){
 const start=source.search(new RegExp('^\\s*(?:async )?function '+name+'\\(', 'm'));
 assert.ok(start>=0,'missing '+name);
 const next=source.slice(start+1).search(/\n(?:async )?function [a-zA-Z]\w*\(/);
 return source.slice(start,next<0?undefined:start+1+next+1);
}
const names=[
 'journeyTransitOnlyFromText','localJourneyIntent','journeyTransitOnlyOverride',
 'journeyTransitPreference','journeyTransitAllowed','journeyTransitOnlyModes','journeyTransitOnlyLabel',
 'journeyTransitMatchesOnly','localTransitRoutes','routeProviderFor','transitRouteProviderFor','routeCandidate','planLocalSmart',
 'routeMinutes','routeDistance','routeModeIcon','ico','routeModeLabel','sgRouteSummary','detailedTransitInstruction','sgLegHtml','renderSgRoutes'
];
const box={innerHTML:''};
let api=async()=>null;const calls=[];
const context={
 assert,console,sgRouteResults:[],sgJourneyIntent:{},ROUTE_JB_URL:'google-route',ROUTE_SG_URL:'onemap',
 journeyRoadStart:p=>p,withVehicleAccessCandidate:r=>r,
 routeApiSafe:async(payload,provider)=>{calls.push({...payload,provider:provider.id});return api(payload,provider)},
 $:id=>id==='sgRouteOptions'?box:null,
 esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
};
runInNewContext(names.map(actual).join('\n'),context);
const c=context;

// 1. Text detection
for(const [q,want] of [
 ['BUS','BUS'],['by bus','BUS'],['bus only please','BUS'],['naik bas','BUS'],['no mrt, bus please','BUS'],
 ['MRT','RAIL'],['take the train','RAIL'],['no bus',''],
 ['bus or mrt','' ],['I want the easiest way',''],['avoid bus',''],['',''],
])assert.equal(c.journeyTransitOnlyFromText(q),want,JSON.stringify(q));

// 2. Local intent keeps every existing flag and only adds transit_only
const bus=c.localJourneyIntent('BUS');
assert.equal(bus.transit_only,'BUS');
assert.equal(bus.allow_bus,true);
assert.equal(bus.allow_mrt,true,'allow_mrt stays as before; the restriction lives in transit_only');
for(const q of ['I have a car but don’t want to drive in SG, bus','drive to CIQ then bus','I’m riding a motorcycle','drive','my car is parked at Bukit Indah then drive'])
 assert.equal(c.localJourneyIntent(q).transit_only,'',q+' must keep its existing routing');
assert.equal(c.localJourneyIntent('no bus').allow_bus,false,'existing "no bus" still works');

// 3. AI said MRT for a bus prompt: user text wins
const o=c.journeyTransitOnlyOverride('BUS',false,{answer:'Take the MRT from Downtown to Expo MRT Station.'},[{order:1,mode:'walk'},{order:2,mode:'mrt'}],false,true);
assert.equal(o.transit_only,'BUS');assert.equal(o.allow_bus,true);
assert.match(o.answer,/Bus only/);
assert.deepEqual(Array.from(o.requested_actions,a=>a.mode),['walk','bus']);
const keep=c.journeyTransitOnlyOverride('BUS',false,{answer:'Take bus 2 to Expo.'},[{order:1,mode:'walk'},{order:2,mode:'bus'}],true,true);
assert.equal(keep.answer,undefined,'a consistent AI answer is kept');assert.equal(keep.requested_actions,undefined);
assert.deepEqual({...c.journeyTransitOnlyOverride('BUS',true,{},[],true,true)},{transit_only:''},'blocked by car/drive intent');
assert.deepEqual({...c.journeyTransitOnlyOverride('',false,{},[],true,true)},{transit_only:''});

// 4. Routing
const walk={mode:'WALK',distance_m:300},busLeg={mode:'BUS',route:'2',duration_sec:1500},mrtLeg={mode:'SUBWAY',route:'EW',duration_sec:1200};
const busRoute={duration_sec:2400,transfers:0,walk_distance_m:300,legs:[walk,busLeg]};
const mrtRoute={duration_sec:2200,transfers:1,walk_distance_m:334,legs:[walk,mrtLeg]};
const mixRoute={duration_sec:2300,transfers:1,walk_distance_m:200,legs:[walk,busLeg,mrtLeg]};
const sg=c.routeProviderFor('sg'),origin={name:'here',lat:1.2747,lon:103.8469},dest={name:'EXPO MRT STATION',lat:1.3349,lon:103.9616};
const base={allow_bus:true,allow_mrt:true,has_car:false,has_motorcycle:false};

// 4a. No restriction: exactly one call, no allowed modes (unchanged behaviour)
api=async()=>({routes:[mrtRoute,mixRoute]});calls.length=0;
let out=await c.planLocalSmart(origin,dest,sg,{...base});
assert.equal(calls.length,1);assert.equal(calls[0].allowed_transit_modes,undefined);
assert.equal(out.length,2);assert.ok(out.every(r=>!r.mode_fallback));
assert.match(out[0].explanation,/bus\/MRT/);

// 4b. Bus only: Google asked for BUS, MRT routes filtered out
api=async p=>({routes:p.allowed_transit_modes?[busRoute,mrtRoute]:[mrtRoute]});calls.length=0;
out=await c.planLocalSmart(origin,dest,sg,{...base,transit_only:'BUS'});
assert.equal(calls.length,1);assert.deepEqual(Array.from(calls[0].allowed_transit_modes),['BUS']);
assert.equal(out.length,1);assert.equal(out[0].legs[1].mode,'BUS');assert.ok(!out[0].mode_fallback);
assert.match(out[0].explanation,/bus route/);

// 4c. Old edge function ignores the restriction and returns MRT: reuse, flag, no extra call
api=async()=>({routes:[mrtRoute]});calls.length=0;
out=await c.planLocalSmart(origin,dest,sg,{...base,transit_only:'BUS'});
assert.equal(calls.length,1);assert.equal(out.length,1);assert.equal(out[0].mode_fallback,true);
assert.match(out[0].explanation,/No bus-only route/);

// 4d. Google finds no bus-only route (error): fall back to normal mixed request
api=async p=>p.allowed_transit_modes?null:{routes:[mixRoute]};calls.length=0;
out=await c.planLocalSmart(origin,dest,sg,{...base,transit_only:'BUS'});
assert.equal(calls.length,2);assert.equal(calls[1].allowed_transit_modes,undefined);
assert.equal(out.length,1);assert.equal(out[0].mode_fallback,true);

// 4e. Rail only
api=async()=>({routes:[busRoute,mrtRoute]});calls.length=0;
out=await c.planLocalSmart(origin,dest,sg,{...base,transit_only:'RAIL'});
assert.deepEqual(Array.from(calls[0].allowed_transit_modes),['SUBWAY','TRAIN','LIGHT_RAIL','RAIL']);
assert.equal(out.length,1);assert.equal(out[0].legs[1].mode,'SUBWAY');

// 4f. Johor local planner uses the same helper
api=async()=>({routes:[busRoute,mrtRoute]});calls.length=0;
out=await c.planLocalSmart({lat:1.49,lon:103.74},{lat:1.46,lon:103.76},c.routeProviderFor('jb'),{...base,transit_only:'BUS'});
assert.ok(out.length>=1);assert.ok(out.every(r=>r.legs.every(l=>l.mode!=='SUBWAY')));

// 5. Route card stats render the footprint icon, not escaped markup
c.sgRouteResults=[{...mrtRoute,kind:'transit',label:'Public transport'}];
c.renderSgRoutes();
assert.doesNotMatch(box.innerHTML,/&lt;svg/,'icon must not be printed as text');
assert.match(box.innerHTML,/<svg[^>]*><use href="#i-footprints"/);
assert.match(box.innerHTML,/334 m · 1 transfer/);
assert.match(box.innerHTML,/Best match/);
c.sgJourneyIntent={transit_only:'BUS'};
c.sgRouteResults=[{...mrtRoute,kind:'transit',mode_fallback:true}];
c.renderSgRoutes();
assert.match(box.innerHTML,/Closest available · not bus-only/);
assert.doesNotMatch(box.innerHTML,/Best match/);

console.log('Transit mode-only (bus / MRT) intent, routing and route-card regression passed');
