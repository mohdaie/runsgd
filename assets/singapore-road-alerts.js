/* Route-aware ERP location alerts. No network calls or charge assumptions. */
(function(root){
 'use strict';
 const metres=(a,b)=>Math.hypot((b.lon-a.lon)*111320*Math.cos((a.lat+b.lat)*Math.PI/360),(b.lat-a.lat)*110540);
 const bearing=(a,b)=>(Math.atan2((b.lon-a.lon)*Math.cos((a.lat+b.lat)*Math.PI/360),b.lat-a.lat)*180/Math.PI+360)%360;
 const angle=(a,b)=>Math.abs(((a-b+540)%360)-180);
 function intersection(a,b,c,d){
  const mx=111320*Math.cos(a.lat*Math.PI/180),my=110540;
  const rx=(b.lon-a.lon)*mx,ry=(b.lat-a.lat)*my,sx=(d.lon-c.lon)*mx,sy=(d.lat-c.lat)*my;
  const cross=rx*sy-ry*sx,rl=Math.hypot(rx,ry),sl=Math.hypot(sx,sy);
  // A road must cross the actual carriageway span, not merely pass near its centre.
  if(rl<.5||sl<.5||Math.abs(cross)/(rl*sl)<.5)return null;
  const qx=(c.lon-a.lon)*mx,qy=(c.lat-a.lat)*my,t=(qx*sy-qy*sx)/cross,u=(qx*ry-qy*rx)/cross;
  if(t<0||t>1||u<0||u>1)return null;
  return {t,lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,heading:bearing(a,b)};
 }
 function crossings(cache,gantries){
  if(!cache?.points?.length||!cache?.cum?.length)return [];
  let hits=[];
  for(const g of gantries||[])for(const line of g.lines||[])for(let j=0;j<line.length-1;j++){
   const c={lon:line[j][0],lat:line[j][1]},d={lon:line[j+1][0],lat:line[j+1][1]};
   for(let i=0;i<cache.points.length-1;i++){
    const a=cache.points[i],b=cache.points[i+1];
    if(Math.max(a.lon,b.lon)<Math.min(c.lon,d.lon)||Math.min(a.lon,b.lon)>Math.max(c.lon,d.lon)||Math.max(a.lat,b.lat)<Math.min(c.lat,d.lat)||Math.min(a.lat,b.lat)>Math.max(c.lat,d.lat))continue;
    const x=intersection(a,b,c,d);if(!x)continue;
    const progress=cache.cum[i]+x.t*(cache.cum[i+1]-cache.cum[i]);
    // Collapse duplicated spans / paired ERP frames, retaining return visits on loops.
    const duplicate=hits.some(h=>(h.gantry.id===g.id||(g.number&&g.number===h.gantry.number))&&Math.abs(h.progress-progress)<45);
    if(!duplicate)hits.push({...x,gantry:g,progress,key:g.id+'@'+Math.round(progress)})
   }
  }
  return hits.sort((a,b)=>a.progress-b.progress);
 }
 function trustedFix(fix,now){
  return (fix.mode==='DRIVE'||fix.mode==='TWO_WHEELER')&&fix.inSingapore&&!fix.error&&Number.isFinite(fix.progress)&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=30&&Number.isFinite(fix.offRoute)&&fix.offRoute<=30&&Number.isFinite(fix.timestamp)&&now-fix.timestamp<=6500&&fix.timestamp<=now+1000&&Number.isFinite(fix.acceptedAt)&&now-fix.acceptedAt<=6500&&fix.acceptedTimestamp===fix.timestamp;
 }
 function nextWarning(hits,fix,now=Date.now()){
  if(!trustedFix(fix,now))return null;
  const limit=Math.max(500,Math.min(800,Math.max(0,fix.speed||0)*30));
  const next=hits.find(h=>h.progress-fix.progress>5&&h.progress-fix.progress<=limit);
  if(!next)return null;
  // Compare travel with the CURRENT route tangent, allowing an ERP after a bend.
  if(Number.isFinite(fix.heading)&&Number.isFinite(fix.routeHeading)&&angle(fix.heading,fix.routeHeading)>65)return null;
  return {...next,distance:Math.max(0,next.progress-fix.progress)};
 }
 function tracker(){
  let key=null,count=0,lastStamp=null,passed=new Set();
  function clearCandidate(){key=null;count=0;lastStamp=null}
  return {reset(){clearCandidate();passed.clear()},update(hits,fix,now){
   const next=nextWarning(hits.filter(h=>!passed.has(h.key)),fix,now);
   if(trustedFix(fix,now??Date.now())){for(const h of hits)if(fix.progress>h.progress+10)passed.add(h.key)}
   if(!next){clearCandidate();return null}
   if(next.key!==key){key=next.key;count=0;lastStamp=null}
   if(lastStamp===null||fix.timestamp>lastStamp){lastStamp=fix.timestamp;count++}
   return count>=2?next:null
  }};
 }
 const api={intersection,crossings,nextWarning,tracker,metres};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RunSGDSingaporeRoads=api;
})(typeof globalThis==='object'?globalThis:this);
