import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function extractFunction(name){
 const start=html.indexOf('function '+name+'(');
 assert.notEqual(start,-1,'missing '+name);
 const open=html.indexOf('{',start);
 let depth=0,quote=null,esc=false;
 for(let i=open;i<html.length;i++){
  const c=html[i];
  if(quote){
   if(esc){esc=false;continue}
   if(c==='\\'){esc=true;continue}
   if(c===quote)quote=null;
   continue;
  }
  if(c==="'"||c==='"'||c==='\u0060'){quote=c;continue}
  if(c==='{')depth++;
  else if(c==='}'&&--depth===0)return html.slice(start,i+1);
 }
 throw new Error('unclosed '+name);
}

assert.match(html,/walking\?sgJourneyRuntime\.walkCaches\?\.\[idx\]:sgJourneyRuntime\.roadCache/);
assert.match(html,/routeOffset=walking\?Number\(sgJourneyRuntime\.walkOffPathM\)/);
assert.match(html,/if\(walking&&abs<8\)return sgJourneyGoogleMapHeading/);
assert.match(html,/Walking GPS must advance the heading-up camera/);
assert.match(html,/Compass changes must drive the walking camera too/);

const code=[
 extractFunction('journeyBearing'),
 extractFunction('journeyRoutePointAt'),
 extractFunction('journeyWalkGuidanceHeading'),
].join('\n');

const now=Date.now();
const context={
 Math,Number,Date,
 sgJourneyHeading:210,
 sgJourneyRuntime:{
  walkNextInstruction:{distance_m:100},
  walkOffPathM:5,
  gpsAccuracy:10,
  movementBearing:135,
  gpsSpeed:1,
  lastMovedAt:now,
 },
};
runInNewContext(code,context);

const cache={points:[{lat:1.30,lon:103.80},{lat:1.30,lon:103.81}],cum:[0,1113],total:1113,lastIndex:0};
let h=runInNewContext('journeyWalkGuidanceHeading(cache,0)',{...context,cache});
assert.ok(h>89&&h<91,'matched walking path should own camera heading');

context.sgJourneyRuntime.walkOffPathM=100;
h=runInNewContext('journeyWalkGuidanceHeading(cache,0)',{...context,cache});
assert.equal(h,135,'off-path camera should fall back to recent movement bearing');

context.sgJourneyRuntime.movementBearing=NaN;
context.sgJourneyRuntime.gpsSpeed=0;
context.sgJourneyRuntime.lastMovedAt=0;
h=runInNewContext('journeyWalkGuidanceHeading(cache,0)',{...context,cache});
assert.equal(h,210,'without usable movement, phone compass should be the fallback');

console.log('Walking heading-up camera regression passed');
