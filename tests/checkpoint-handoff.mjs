import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function actual(name){
 const start=source.search(new RegExp('^\\s*(?:async )?function '+name+'\\(', 'm'));
 assert.ok(start>=0,'missing '+name);
 const next=source.slice(start+1).search(/\n(?:async )?function [a-zA-Z]\w*\(/);
 return source.slice(start,next<0?undefined:start+1+next+1);
}
const names=[
 'routeProviderFor','transitRouteProviderFor','journeyTransitPreference','journeyTransitAllowed',
 'makeJbToSgBorderHops','makeBorderHops','sgStationRailRoute','sgCheckpointStationRoutes','routeCandidate',
 'planJbToSgSmart','planLocalSmart','planSgToJb','makeSgToJbRoutes','journeyRoadMode','rerouteProviderForBlock',
 'rankJourneyRoutes','chooseJourneyRouteSet','routeMinutes','routeDistance','routeModeIcon','ico',
 'routeModeLabel','sgRouteSummary','detailedTransitInstruction','sgLegHtml','renderSgRoutes'
];
const stationPoints={
 'Kranji MRT Station':{name:'KRANJI MRT STATION',lat:1.425,lon:103.762},
 'Marsiling MRT Station':{name:'MARSILING MRT STATION',lat:1.433,lon:103.774},
 'Woodlands MRT Station':{name:'WOODLANDS MRT STATION',lat:1.436,lon:103.786},
 'JB Sentral':{name:'JB Sentral',lat:1.463,lon:103.765},
};
const origin={name:'Johor home',lat:1.49,lon:103.74};
const destination={name:'MAS Building',lat:1.28,lon:103.85};
const intent={has_car:true,mixed_road_transit:true,avoid_sg_driving:true,allow_cross_border_bus:true,allow_bus:true,allow_mrt:true,priority:'fastest',has_motorcycle:false,prefer_ktm:false};
const box={innerHTML:''},calls=[];
const rail={mode:'SUBWAY',route:'NS',duration_sec:2100,from:{name:'MRT Station'},to:{name:'Tanjong Pagar MRT Station'}};
const validRail={duration_sec:2700,transfers:0,walk_distance_m:120,legs:[{mode:'WALK',distance_m:120},{...rail}]};
const detour={duration_sec:600,legs:[{mode:'WALK',distance_m:231,to:{name:'WOODLANDS TRAIN CHECKPT'}},{mode:'BUS',route:'912B',duration_sec:240},rail]};
const context={
 assert,console,sgRouteResults:[],ROUTE_JB_URL:'google-route',ROUTE_SG_URL:'onemap',
 WOODLANDS_CP:{name:'Woodlands Checkpoint',lat:1.4459,lon:103.7686},
 JB_CIQ:{name:'JB CIQ',lat:1.4637,lon:103.7648},
 journeyRoadStart:point=>point,withVehicleAccessCandidate:route=>route,
 resolveRoutePlace:async(query,provider)=>{calls.push({action:'search',query,provider:provider.id});return stationPoints[query]||null},
 routeApiSafe:async(payload,provider)=>{
  calls.push({action:'route',mode:payload.travel_mode,provider:provider.id,preference:payload.transit_preference});
  if(provider.id==='jb'&&payload.travel_mode==='DRIVE')return {routes:[{duration_sec:900,legs:[{mode:'DRIVE',duration_sec:900,to:{name:'JB Sentral'}}]}]};
  if(provider.id==='jb'&&payload.travel_mode==='TRANSIT')return {routes:[{duration_sec:1200,legs:[{mode:'BUS',duration_sec:1200}]}]};
  if(provider.id!=='sg-transit')return null;
  return {routes:[detour,validRail]};
 },
 classify:(lat)=>({country:lat<1.462?'SG':'MY'}),
 sgRouteApi:async(payload,provider)=>{
  calls.push({action:'route-direct',mode:payload.travel_mode,provider:provider.id});
  return {routes:[provider.id==='sg-transit'?validRail:{duration_sec:900,legs:[{mode:'BUS',duration_sec:900}]}]};
 },
 $:id=>id==='sgRouteOptions'?box:null,esc:value=>String(value??''),
};
runInNewContext(names.map(actual).join('\n'),context);

assert.equal(context.routeProviderFor('sg').url,'onemap');
assert.equal(context.transitRouteProviderFor('sg').url,'google-route');
assert.equal(context.sgStationRailRoute(detour),false);
assert.equal(context.sgStationRailRoute(validRail),true);
assert.equal(context.makeBorderHops()[1].manual,true,'an untimed border bus must be shown as untimed');
const routes=await context.planJbToSgSmart(origin,destination,intent);
const drive=routes.filter(route=>route.kind==='drive_then_transit');
assert.equal(drive.length,3,'consider Kranji, Marsiling and Woodlands checkpoint bus links');
assert.deepEqual(Array.from(drive,route=>route.tag),['170X / 170 → KRANJI MRT STATION','950 → MARSILING MRT STATION','950 → WOODLANDS MRT STATION']);
assert.ok(calls.filter(x=>x.action==='search'&&x.provider==='sg').length===3,'OneMap searches the three station names');
assert.ok(calls.filter(x=>x.action==='route'&&x.provider==='sg-transit').length===3,'Google calculates each Singapore onward route');
assert.equal(calls.filter(x=>x.action==='route'&&x.provider==='sg').length,0,'OneMap no longer calculates Singapore transit');
for(const route of drive){
 const checkpoint=route.legs.findIndex(leg=>leg.mode==='IMMIGRATION'&&leg.country==='SG');
 assert.equal(route.legs[checkpoint+1].mode,'BUS');
 assert.ok(['170X / 170','950'].includes(route.legs[checkpoint+1].route));
 assert.equal(route.legs[checkpoint+2].mode,'WALK');
 assert.equal(route.legs[checkpoint+3].mode,'SUBWAY');
 assert.ok(route.border_end_index>=checkpoint+1);
 assert.ok(!route.legs.some(leg=>leg.route==='912B'||leg.to?.name==='WOODLANDS TRAIN CHECKPT'));
}
const ranked=context.chooseJourneyRouteSet(routes,intent);
assert.equal(ranked[0].kind,'drive_then_transit','explicit drive, park, bus intent should lead');
context.sgRouteResults=ranked;
context.renderSgRoutes();
assert.match(box.innerHTML,/Matches your plan · partial timing/);
assert.doesNotMatch(box.innerHTML,/Best match/);
assert.match(box.innerHTML,/known legs/);
assert.equal(context.rerouteProviderForBlock({apiMode:'TRANSIT',target:destination},{lat:1.3,lon:103.8}).id,'sg-transit');
assert.equal(context.rerouteProviderForBlock({apiMode:'WALK',target:destination},{lat:1.3,lon:103.8}).id,'sg');

const before=calls.length;
await context.planLocalSmart({name:'SG origin',lat:1.32,lon:103.82},destination,context.routeProviderFor('sg'),{allow_bus:true,allow_mrt:true,has_car:false,has_motorcycle:false});
assert.equal(calls.slice(before).filter(x=>x.action==='route'&&x.provider==='sg-transit').length,1,'SG local transit calls Google only when planning');
const borderFromSingapore=await context.planSgToJb({name:'SG origin',lat:1.32,lon:103.82},stationPoints['JB Sentral']);
assert.equal(borderFromSingapore[0].border_variable,true);
assert.deepEqual(Array.from(calls.slice(-2),x=>x.provider),['sg-transit','jb']);

const workingApi=context.routeApiSafe;
context.routeApiSafe=async(payload,provider)=>provider.id==='sg-transit'?{routes:[detour]}:workingApi(payload,provider);
assert.equal((await context.sgCheckpointStationRoutes(destination,context.routeProviderFor('sg'),context.transitRouteProviderFor('sg'))).length,0,'do not invent a station rail link when only a 912B detour is returned');
console.log('Singapore provider split, checkpoint handoff and partial timing regression passed');
