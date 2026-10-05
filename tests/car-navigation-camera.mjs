import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
function actual(name){
 const start=source.search(new RegExp('^\\s*(?:async )?function '+name+'\\(', 'm'));
 assert.ok(start>=0,'missing '+name);
 const next=source.slice(start+1).search(/\n(?:async )?function [a-zA-Z]\w*\(/);
 return source.slice(start,next<0?undefined:start+1+next+1);
}
const names=['journeyNavNumber','journeyMeters','journeyBearing','journeyRoutePointAt','journeyRoadTangent','journeyRoadGuidanceHeading','journeyCameraPointAhead','journeyGoogleCameraState','journeyGoogleMapCourseHeading','updateJourneyGoogleMapLive','journeyGoogleMapVehicleIcon','syncJourneyGoogleMapVehicle','updateJourneyGoogleMapFollowUi','pauseJourneyGoogleMapFollowing','scheduleJourneyGoogleMapFollowing','recenterJourneyGoogleMap','handleSgJourneyPosition'];
let now=100000,timers=new Map(),timerId=0;
const elements=new Map(['sgJourneyProdMapBadge','sgJourneyProdRecenter','sgJourneyProdMapWrap'].map(id=>[id,{textContent:'',classList:{toggle(){}},setAttribute(name,value){this[name]=value}}]));
const context={Math,Number,Date:{now:()=>now},
 sgJourney:{status:'active',current_hop:0},sgJourneyLeg:()=>({mode:'DRIVE',to:{lat:0,lon:.009}}),
 sgJourneyHeading:null,sgJourneyGoogleMapHeading:null,sgJourneyGoogleMapVehicleHeading:null,sgJourneyGoogleMapResumeTimer:null,sgJourneyGoogleMapFollowing:true,
 sgJourneyRuntime:{roadCache:{points:[{lat:0,lon:0},{lat:.00044966,lon:0},{lat:.00044966,lon:.00179864}],cum:[0,50,250],total:250,lastIndex:0},routeProgressM:30,currentStepRemainingM:20,gpsSpeed:10,gpsAccuracy:10,gpsUpdatedAt:now,gpsHeading:0,movementBearing:null,offRouteM:0,lastLat:.000269796,lastLon:0},
 window:{google:{maps:{SymbolPath:{FORWARD_CLOSED_ARROW:'arrow',CIRCLE:'circle'}}}},
 sgJourneyGoogleMap:{heading:0,rendering:'VECTOR',ignoreRotation:false,moves:[],getHeading(){return this.heading},getRenderingType(){return this.rendering},moveCamera(camera){this.moves.push(camera);if(!this.ignoreRotation)this.heading=camera.heading}},
 sgJourneyGoogleMapVehicle:{setPosition(value){this.position=value},setIcon(value){this.icon=value}},
 $:id=>elements.get(id),txt:(id,value)=>{elements.get(id).textContent=value},
 clearTimeout:id=>timers.delete(id),setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id},
 updateJourneyGpsHealth(){},live:{location:null},classify:()=>({country:'SG'}),journeyRoadMode:mode=>mode==='DRIVE',reconcileRoadProgress:()=>false,prodNavDiagSnapshot(){},persistSgJourneyThrottled(){},document:{hidden:true},
};
runInNewContext(names.map(actual).join('\n'),context);
const camera=()=>context.journeyGoogleCameraState(context.sgJourneyRuntime.lastLat,context.sgJourneyRuntime.lastLon);
const update=()=>{context.updateJourneyGoogleMapLive.lastAt=0;context.updateJourneyGoogleMapLive()};

let cam=camera();
assert.equal(cam.heading,0,'before a right turn the camera stays aligned with current northward travel');
assert.equal(cam.center.lng,0,'look-ahead must not cross the upcoming corner');
context.sgJourneyRuntime.gpsHeading=null;
assert.equal(camera().heading,0,'without GPS course use the current segment, not the future turn');
context.sgJourneyRuntime.routeProgressM=55;
assert.ok(Math.abs(camera().heading-90)<.01,'after entering the eastward road its tangent owns direction');
context.sgJourneyGoogleMapHeading=0;
assert.equal(context.journeyGoogleMapCourseHeading(90),90,'a completed right turn updates immediately');
context.sgJourneyGoogleMapHeading=359;
assert.equal(context.journeyGoogleMapCourseHeading(4),4,'heading wrap-around follows the shortest direction');

Object.assign(context.sgJourneyRuntime,{offRouteM:190,gpsHeading:270,lastLon:-.0017});
cam=camera();
assert.equal(cam.heading,270,'off route use current travel course');
assert.equal(cam.center.lng,-.0017,'off route keep camera on the actual car');
assert.equal(cam.display.lng,-.0017,'off route do not snap the marker onto the planned road');

Object.assign(context.sgJourneyRuntime,{roadCache:null,routeProgressM:null,offRouteM:null,gpsHeading:90,movementBearing:null});
assert.equal(camera().heading,90,'missing movement must not override a valid GPS east heading with north');
context.sgJourneyRuntime.gpsHeading=null;context.sgJourneyGoogleMapVehicleHeading=null;
assert.equal(camera().heading,null,'all missing direction sources remain unknown');
update();assert.equal(context.sgJourneyGoogleMapVehicle.icon.path,'circle','unknown direction displays a position dot');
assert.equal(context.journeyNavNumber(null),null);
assert.equal(context.journeyNavNumber(undefined),null);
assert.equal(context.journeyNavNumber(''),null);
assert.equal(context.journeyNavNumber(0),0,'true north is a valid course');
context.sgJourneyRuntime.gpsHeading=90;context.sgJourneyRuntime.gpsUpdatedAt=now-7000;
assert.equal(camera().heading,null,'stale course is not used for an off-route arrow');
context.sgJourneyRuntime.gpsUpdatedAt=now;context.sgJourneyRuntime.gpsAccuracy=80;
assert.equal(camera().heading,null,'poor GPS cannot supply a trusted off-route direction');

Object.assign(context.sgJourneyRuntime,{gpsAccuracy:10,gpsHeading:90});
context.sgJourneyGoogleMap.ignoreRotation=true;context.sgJourneyGoogleMap.heading=0;
update();assert.equal(context.sgJourneyGoogleMapVehicle.icon.rotation,90,'ignored camera rotation still yields a correct east-pointing arrow');
context.sgJourneyGoogleMap.heading=45;context.syncJourneyGoogleMapVehicle();
assert.equal(context.sgJourneyGoogleMapVehicle.icon.rotation,45,'arrow tracks the actual intermediate map heading');
context.sgJourneyGoogleMap.ignoreRotation=false;context.sgJourneyGoogleMap.rendering='RASTER';
update();assert.equal(context.sgJourneyGoogleMap.moves.at(-1).heading,0,'raster camera explicitly stays north-up');
assert.equal(context.sgJourneyGoogleMapVehicle.icon.rotation,90,'north-up fallback shows true travel direction');
assert.match(elements.get('sgJourneyProdMapBadge').textContent,/North-up/);
context.sgJourneyGoogleMap.rendering='VECTOR';update();
assert.equal(context.sgJourneyGoogleMapVehicle.icon.rotation,0,'heading-up vector arrow points ahead');

context.pauseJourneyGoogleMapFollowing();const before=context.sgJourneyGoogleMap.moves.length;
context.sgJourneyRuntime.gpsHeading=180;update();
assert.equal(context.sgJourneyGoogleMap.moves.length,before,'browsing keeps the camera still');
assert.equal(context.sgJourneyGoogleMapVehicle.icon.rotation,90,'paused camera keeps a directionally correct moving marker');
assert.match(elements.get('sgJourneyProdMapBadge').textContent,/paused/);
assert.equal(elements.get('sgJourneyProdRecenter').textContent,'Resume');
context.updateJourneyGoogleMapLive(undefined,undefined,true);
assert.equal(context.sgJourneyGoogleMap.moves.length,before,'forced refresh must not cancel a gesture pause');
context.scheduleJourneyGoogleMapFollowing();
assert.equal([...timers.values()][0].delay,8000);
[...timers.values()][0].fn();
assert.equal(context.sgJourneyGoogleMapFollowing,true,'following resumes after interaction ends');
assert.equal(context.sgJourneyGoogleMap.heading,180);
context.pauseJourneyGoogleMapFollowing();context.recenterJourneyGoogleMap();
assert.equal(context.sgJourneyGoogleMapFollowing,true,'Recenter resumes immediately');

// Exercise real GPS handling, including many small advances and unavailable fields.
Object.assign(context.sgJourneyRuntime,{bearingLat:null,bearingLon:null,movementBearing:null,lastLat:null,lastLon:null});
for(const lon of [0,.00003,.00006,.00009]){
 now+=1000;context.handleSgJourneyPosition({timestamp:now,coords:{latitude:0,longitude:lon,heading:null,speed:null,accuracy:8}});
}
assert.equal(context.sgJourneyRuntime.gpsHeading,null,'missing GPS heading never becomes north');
assert.equal(context.sgJourneyRuntime.gpsSpeed,null,'missing GPS speed remains unknown');
assert.ok(Math.abs(context.sgJourneyRuntime.movementBearing-90)<.01,'small GPS advances accumulate into an eastward course');
assert.equal(camera().heading,90);
const moves=context.sgJourneyGoogleMap.moves.length;
context.sgJourneyRuntime.lastLat=null;context.sgJourneyRuntime.lastLon=null;
context.recenterJourneyGoogleMap();
assert.equal(context.sgJourneyGoogleMap.moves.length,moves,'missing position must not recenter to the Gulf of Guinea');
console.log('Car camera regression passed: turns, fallback rotation, off-route, stale/null GPS, gestures and accumulated movement.');
