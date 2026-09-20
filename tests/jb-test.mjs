import assert from 'node:assert/strict';
import {adapt,Tracker,cue,inJb,distance,match} from '../jb-test/core.mjs';
const pts=[[103.75,1.50],[103.751,1.50],[103.751,1.501]],response={code:'Ok',routes:[{duration:50,legs:[{steps:[{name:'Road A',maneuver:{type:'depart'},geometry:{coordinates:pts.slice(0,2)}},{name:'Road B',maneuver:{type:'turn',modifier:'left'},geometry:{coordinates:pts.slice(1)}},{name:'Destination',maneuver:{type:'arrive'},geometry:{coordinates:[pts[2]]}}]}]}]};
const r=adapt(response);assert.equal(r.points.length,3);assert.equal(r.turns[1].index,1);assert.equal(r.turns[1].cue.icon,'←');assert.equal(cue({type:'turn',modifier:'right'}).icon,'→');assert.equal(cue({type:'roundabout',exit:3}).text,'ROUNDABOUT · EXIT 3');assert.equal(inJb([103.8,1.30]),false);assert.throws(()=>adapt({code:'NoRoute'}));assert.throws(()=>adapt({code:'Ok',routes:[{legs:[{steps:[{geometry:{coordinates:[[103.75,1.5],[103.8,1.3]]}}]}]}]}));
let t=new Tracker(r),time=100000;const f=(point,accuracy=5)=>({point,accuracy,time:time+=1000,heading:null,speed:8});
assert.equal(t.update(f(pts[0]),time).valid,true);assert.equal(t.update(f(pts[0],100),time).valid,false);assert.equal(t.update({...f(pts[0]),time:time-20000},time).valid,false);assert.equal(t.update(f([103.754,1.5]),time).valid,false);assert.equal(t.update(f(pts[2]),time).valid,false,'must reject teleport to destination');
t=new Tracker(r);let result;for(let i=0;i<=10;i++)result=t.update(f([103.75+.001*i/10,1.5]),time);assert.equal(result.valid,true);for(let i=1;i<=10;i++)result=t.update(f([103.751,1.5+.001*i/10]),time);result=t.update(f(pts[2]),time);result=t.update(f(pts[2]),time);assert.equal(result.arrived,true,'arrival needs confirmed fixes near route end');assert.ok(distance(pts[0],pts[1])>100);assert.ok(match(r,pts[1]).off<1);
console.log('JB tracking tests passed: adapter, direction, region, poor/stale GPS, off-route, teleport rejection, arrival.');

// A single fix beyond a turn must not skip the maneuver.
t=new Tracker(r);t.update(f([103.7509,1.5]),time);result=t.update(f([103.751,1.50015]),time);assert.equal(result.next.name,'Road B');result=t.update(f([103.751,1.50017]),time);assert.equal(result.next.name,'Destination');
console.log('Two-fix maneuver confirmation passed.');
