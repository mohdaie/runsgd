from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

if 'v2.1.1' not in s:
    raise SystemExit('expected v2.1.1 not found')
s=s.replace('v2.1.1','v2.1.2')

s=s.replace('LTA train service status and Woodlands crowd.','Nearest MRT status, crowd and network disruptions.')

old="""function renderPublicTransport(j){
 let train=j?.train||{},crowd=j?.woodlands_crowd||null,stops=j?.nearby_bus_stops||[];
 txt('transportBadge','Live');
 if(train.status==='disrupted'){
   txt('mrtStatus','⚠ Disruption');
   let a=train.affected?.[0],m=train.messages?.[0]?.content||'';
   txt('mrtDetail',m||(a?`${a.line||'MRT'} affected${a.stations?' · '+a.stations:''}.`:'LTA reports a major train disruption.'));
 }else{
   txt('mrtStatus','✓ Normal');
   txt('mrtDetail',crowd?`Singapore MRT normal · Woodlands NS9 crowd: ${crowd.crowd_label}.`:'Singapore MRT normal · Woodlands crowd data unavailable.');
 }
 let box=$('nearbyBusList');"""
new="""function renderPublicTransport(j){
 let train=j?.train||{},mrt=j?.nearest_mrt||null,stops=j?.nearby_bus_stops||[];
 txt('transportBadge','Live');
 if(train.status==='disrupted'){
   let affectedLines=(train.affected||[]).map(x=>x.line).filter(Boolean),nearestHit=mrt?.lines?.some(x=>affectedLines.includes(x));
   txt('mrtStatus',nearestHit?'⚠ Nearby line affected':'⚠ Network disruption');
   let a=train.affected?.[0],m=train.messages?.[0]?.content||'';
   if(nearestHit&&mrt) txt('mrtDetail',`${mrt.name}${mrt.codes?.length?' · '+mrt.codes.join('/'):''} may be affected. ${m||(a?`${a.line||'MRT'} disruption reported.`:'Check LTA updates before travelling.')}`);
   else txt('mrtDetail',m||(a?`${a.line||'MRT'} affected${a.stations?' · '+a.stations:''}.`:'LTA reports a major train disruption.'));
 }else{
   txt('mrtStatus','✓ Normal');
   if(mrt){
     let code=mrt.codes?.length?' · '+mrt.codes.join('/'):'',line=mrt.lines?.length?' · '+mrt.lines.join('/'):'',dist=Number.isFinite(mrt.distance_m)?` · ${Math.round(mrt.distance_m)} m away`:'',crowd=mrt.crowd?.crowd_label&&mrt.crowd.crowd_label!=='Unavailable'?` · Crowd: ${mrt.crowd.crowd_label}`:'';
     txt('mrtDetail',`${mrt.name}${code}${line}${dist}${crowd}. No major downtime reported.`);
   }else txt('mrtDetail','Singapore MRT network normal · No major downtime reported.');
 }
 let box=$('nearbyBusList');"""
if old not in s:
    raise SystemExit('renderPublicTransport block not found')
s=s.replace(old,new,1)

s=s.replace("woodlands_crowd:live.transport.woodlands_crowd||null,","nearest_mrt:live.transport.nearest_mrt||null,")

p.write_text(s,encoding='utf-8')

sw=Path('sw.js')
ws=sw.read_text(encoding='utf-8')
if 'runsgd-shell-v211' not in ws:
    raise SystemExit('service worker cache v211 not found')
ws=ws.replace('runsgd-shell-v211','runsgd-shell-v212')
sw.write_text(ws,encoding='utf-8')
print('patched RunSGD v2.1.2')
