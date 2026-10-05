/* Pure helpers for progress-based ETA and conservative traffic rerouting. */
(function(root){
 'use strict';
 const config=Object.freeze({refreshMs:600000,minRequestMs:120000,saveSeconds:120,saveFraction:.15});
 const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 const road=mode=>['DRIVE','TWO_WHEELER'].includes(String(mode||'').toUpperCase());
 function block(legs,idx){
  const first=legs?.[idx];if(!road(first?.mode)||first.manual)return null;
  let mode=String(first.mode).toUpperCase(),end=idx;while(end+1<legs.length&&!legs[end+1].manual&&String(legs[end+1].mode||'').toUpperCase()===mode)end++;
  const target=legs[end].to;if(number(target?.lat)===null||number(target?.lon)===null)return null;
  return {mode,end,target:{...target,lat:number(target.lat),lon:number(target.lon)}};
 }
 function trusted(fix,now=Date.now()){
  return road(fix.mode)&&!fix.error&&number(fix.lat)!==null&&number(fix.lon)!==null&&number(fix.accuracy)!==null&&fix.accuracy>=0&&fix.accuracy<=30&&number(fix.timestamp)!==null&&now-fix.timestamp<=6500&&fix.timestamp<=now+1000;
 }
 function remaining(legs,idx,stepRemaining,stepTotal,end=legs.length-1){
  let seconds=0;
  for(let i=idx;i<=end;i++){
   let duration=Math.max(0,number(legs[i]?.duration_sec)||0),fraction=1;
   if(i===idx&&road(legs[i]?.mode)&&number(stepRemaining)!==null&&number(stepTotal)>0)fraction=Math.max(0,Math.min(1,stepRemaining/stepTotal));
   seconds+=duration*fraction;
  }
  return seconds;
 }
 function savings(current,candidate){return number(current)>0&&number(candidate)>0&&current-candidate>=config.saveSeconds&&(current-candidate)/current>=config.saveFraction}
 const metres=(a,b)=>Math.hypot((b.lon-a.lon)*111320*Math.cos((a.lat+b.lat)*Math.PI/360),(b.lat-a.lat)*110540);
 function cache(points){let cum=[0];for(let i=1;i<points.length;i++)cum.push(cum.at(-1)+metres(points[i-1],points[i]));return {points,cum,total:cum.at(-1)}}
 function at(c,p){
  if(!c?.points?.length)return null;
  p=Math.max(0,Math.min(c.total,p));let i=0;while(i<c.points.length-2&&c.cum[i+1]<p)i++;
  const a=c.points[i],b=c.points[Math.min(i+1,c.points.length-1)],d=c.cum[i+1]-c.cum[i],t=d>0?(p-c.cum[i])/d:0;
  return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};
 }
 function slice(c,start,end){if(!c?.points?.length||number(start)===null||number(end)===null||end<=start)return [];return [at(c,start),...c.points.filter((_,i)=>c.cum[i]>start&&c.cum[i]<end),at(c,end)]}
 function anchors(c,start,end){
  const length=end-start;if(length<700)return [];
  const n=Math.min(6,Math.max(1,Math.floor(length/2000)));
  return Array.from({length:n},(_,i)=>at(c,start+length*(i+1)/(n+1)));
 }
 function project(points,p){
  let best={distance:Infinity,progress:0},progress=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],mx=111320*Math.cos(p.lat*Math.PI/180),x=(b.lon-a.lon)*mx,y=(b.lat-a.lat)*110540,len2=x*x+y*y,t=len2?Math.max(0,Math.min(1,((p.lon-a.lon)*mx*x+(p.lat-a.lat)*110540*y)/len2)):0;
   const distance=metres(p,{lat:a.lat+t*(b.lat-a.lat),lon:a.lon+t*(b.lon-a.lon)}),length=metres(a,b);
   if(distance<best.distance)best={distance,progress:progress+length*t};progress+=length;
  }
  return best;
 }
 function follows(candidate,current,tolerance=65){
  if(candidate?.length<2||current?.length<2)return false;
  const c=cache(candidate),n=Math.min(500,Math.max(2,Math.ceil(c.total/80)));let previous=-Infinity;
  for(let i=0;i<=n;i++){
   const hit=project(current,at(c,c.total*i/n));
   if(hit.distance>tolerance||hit.progress<previous-100)return false;
   previous=Math.max(previous,hit.progress);
  }
  return metres(candidate.at(-1),current.at(-1))<=tolerance;
 }
 const api={config,number,road,block,trusted,remaining,savings,metres,cache,at,slice,anchors,follows,project};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RunSGDTraffic=api;
})(globalThis);
