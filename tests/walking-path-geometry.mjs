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
function encode(points){
 let a=0,b=0,out='';
 for(const point of points){
  const c=Math.round(point.lat*1e5),d=Math.round(point.lon*1e5);
  for(let n of [c-a,d-b]){n=n<0?~(n<<1):n<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5;}out+=String.fromCharCode(n+63);}
  a=c;b=d;
 }
 return out;
}
const points=[{lat:1.279,lon:103.842},{lat:1.280,lon:103.842},{lat:1.280,lon:103.841},{lat:1.281,lon:103.841}];
const steps=[encode(points.slice(0,2)),encode(points.slice(1,3)),encode(points.slice(2))];
const instructions=points.slice(0,-1).map((p,i)=>({...p,id:i,instruction:['Walk north','Turn left','Turn right'][i],polyline:steps[i]}));
const context={Math,Number,sgJourney:{route:{}},journeyRoadMode:mode=>mode==='DRIVE'||mode==='TWO_WHEELER'};
runInNewContext(['journeyMeters','decodeGooglePolyline','journeyWalkPathPoints','journeyGoogleNavPath','makePointCache','makeWalkPathCache','projectJourneyToRoad','buildJourneyWalkCaches'].map(actual).join('\n'),context);
const plain=value=>JSON.parse(JSON.stringify(value));
const leg={mode:'WALK',polyline:encode(points),step_polylines:steps,walk_instructions:instructions};
for(const variant of [leg,{...leg,polyline:null},{...leg,step_polylines:[]},{...leg,step_polylines:[],polyline:null}]){
 const path=context.journeyGoogleNavPath([variant],0),cache=context.makeWalkPathCache(variant);
 assert.deepEqual(plain(path),points,'map follows each pedestrian segment exactly once');
 assert.deepEqual(plain(cache.points),points,'GPS matching uses the identical clean path');
 const expected=context.makePointCache(points).total;
 assert.ok(Math.abs(cache.total-expected)<.01,'distance must not count alternate geometry again');
 assert.equal(cache.instructions.length,3,'instruction metadata is preserved');
 assert.equal(cache.instructions[0].progress_m,0);
 assert.ok(cache.instructions[2].progress_m>cache.instructions[1].progress_m,'turns stay in physical travel order');
}
const malformed={...leg,step_polylines:['?']};
assert.deepEqual(plain(context.journeyWalkPathPoints(malformed)),points,'invalid detailed geometry falls back to the complete leg');
const overview=[points[0],points.at(-1)];
assert.deepEqual(plain(context.journeyWalkPathPoints({...leg,polyline:encode(overview)})),points,'detailed pedestrian steps take precedence over a coarse overview');
const returnPath=[points[0],points[1],points[0]];
assert.deepEqual(plain(context.journeyWalkPathPoints({mode:'WALK',step_polylines:[encode(returnPath.slice(0,2)),encode(returnPath.slice(1))]})),returnPath,'a legitimate return along the same path is preserved');
const legs=[{mode:'WALK',step_polylines:[steps[0]]},{mode:'WALK',step_polylines:[steps[1]]},{mode:'SUBWAY',polyline:steps[2]}];
assert.deepEqual(plain(context.journeyGoogleNavPath(legs,0)),points.slice(0,3),'consecutive walking legs join once and stop before transit');
assert.deepEqual(plain(context.journeyGoogleNavPath([{mode:'DRIVE',polyline:encode(points)}],0)),points,'car geometry is unchanged');
context.sgJourney.route={polyline:encode(points)};
assert.deepEqual(plain(context.journeyGoogleNavPath([{mode:'WALK'},{mode:'SUBWAY'}],0)),[],'missing walking geometry must not draw the entire transit route');
const single={polyline:encode(points),legs:[{mode:'WALK',walk_instructions:instructions.map(({polyline,...x})=>x)}]};
assert.deepEqual(plain(context.buildJourneyWalkCaches(single)[0].points),points,'a single walking route can use its whole-route geometry consistently');
console.log('Walking geometry passed: duplicate representations, map/cache distance, instructions, fallback, legitimate backtracking and transit boundaries.');
