from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Version bump
s=s.replace('RunSGD Beta · v2.0.4','RunSGD Beta · v2.1.0').replace('v2.0.4','v2.1.0')

# Journey intent UI
old='''<article class="card">
  <div class="head"><div class="title">✦ What should I do?</div><span id="briefStatus" class="tag">Ready</span></div>
  <div class="sub">One tap checks the useful parts of RunSGD — traffic, weather, recent community activity and only the widgets you keep enabled.</div>
  <button id="aiBriefBtn" class="btn refresh" onclick="loadAiBrief(true,this)">✨ Check my journey</button>
  <div class="soft" style="margin-top:12px"><div id="brief" class="briefAction">Tap “Check my journey” for a current recommendation.</div><div id="briefWhy" class="sub briefWhy">RunSGD will only surface something when it can actually help your next move.</div></div>
  <div id="briefExtra" class="actionline">If conditions look normal, RunSGD will simply tell you that you are good to go.</div>
  <div id="aiBriefMeta" class="aiMeta" style="margin-top:9px">Gemini 3.5 Flash-Lite · RunSGD app data only</div>
</article>'''
new='''<article class="card">
  <div class="head"><div class="title">✦ What should I do?</div><span id="briefStatus" class="tag">Ready</span></div>
  <div class="sub">Tell RunSGD what you are trying to do. It will check only the app data that matters for that trip.</div>
  <div class="journeyChoices" aria-label="Journey choices">
    <button class="journeyChoice" data-journey="sg-jb" onclick="selectJourneyIntent('sg-jb',this)">🇸🇬 → 🇲🇾 Going to JB</button>
    <button class="journeyChoice" data-journey="within-sg" onclick="selectJourneyIntent('within-sg',this)">🚇 Within SG</button>
    <button class="journeyChoice" data-journey="surrounding" onclick="selectJourneyIntent('surrounding',this)">📍 Surroundings</button>
  </div>
  <input id="journeyCustom" class="journeyCustom" maxlength="180" placeholder="Or tell RunSGD what you want to do…" oninput="journeyCustomChanged()">
  <button id="aiBriefBtn" class="btn refresh" onclick="loadAiBrief(true,this)">✨ Check my journey</button>
  <div class="soft" style="margin-top:12px"><div id="brief" class="briefAction">Choose a trip or type what you want to do.</div><div id="briefWhy" class="sub briefWhy">RunSGD will use traffic, weather, public transport, community and your enabled widgets.</div></div>
  <div id="briefExtra" class="actionline">If there is nothing important to act on, RunSGD will simply say you are good to go.</div>
  <div id="aiBriefMeta" class="aiMeta" style="margin-top:9px">Gemini 3.5 Flash-Lite · RunSGD app data only</div>
</article>'''
if old not in s: raise SystemExit('journey brief block not found')
s=s.replace(old,new,1)

# Transport widget after Causeway widget
m=re.search(r'(<article class="card homeWidget" data-widget="traffic">.*?</article>)',s,re.S)
if not m: raise SystemExit('traffic widget not found')
transport='''
<article class="card homeWidget" data-widget="transport">
  <div class="head"><div class="title">🚌 MRT & Bus</div><span id="transportBadge" class="tag">Loading</span></div>
  <div class="transitPanel">
    <div class="transitHead"><b>🚇 MRT</b><span id="mrtStatus" class="transitState">Checking network…</span></div>
    <div id="mrtDetail" class="sub">LTA train service status and Woodlands crowd.</div>
  </div>
  <div class="transitPanel">
    <div class="transitHead"><b>🚌 Nearby buses</b><span id="busStatus" class="transitState">Location needed</span></div>
    <div id="nearbyBusList" class="sub">Use your location to see nearby Singapore bus arrivals.</div>
  </div>
  <button class="miniBtn transitRefresh" onclick="loadPublicTransport(this)">↻ Refresh MRT & bus</button>
  <div id="transportTime" class="trafficMeta">Official LTA DataMall public transport data.</div>
</article>'''
s=s[:m.end()]+transport+s[m.end():]

# CSS
css='''
/* v2.1 public transport + journey intent */
.journeyChoices{display:flex;gap:7px;overflow:auto;margin-top:12px;padding-bottom:2px;scrollbar-width:none}.journeyChoices::-webkit-scrollbar{display:none}.journeyChoice{flex:0 0 auto;border:1px solid #e4e9f3;background:#fff;color:#56647d;border-radius:99px;padding:9px 12px;font-size:12px;font-weight:800}.journeyChoice.active{color:#fff;border-color:transparent;background:linear-gradient(120deg,var(--blue),var(--violet))}.journeyCustom{width:100%;margin-top:9px;border:1px solid #e2e7f1;background:#fff;border-radius:14px;padding:12px 13px;color:#17213b}.transitPanel{padding:12px 13px;border-radius:17px;background:linear-gradient(120deg,#f2f8ff,#f8f4ff);margin-top:9px}.transitHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.transitState{font-size:11px;font-weight:850;color:#53627c}.transitStop{padding-top:9px;margin-top:9px;border-top:1px solid #e6ebf4}.transitStop:first-child{border-top:0;margin-top:4px}.busArrivalRow{display:grid;grid-template-columns:48px 1fr;gap:8px;align-items:start;padding:6px 0}.busNo{display:inline-grid;place-items:center;background:#fff;border:1px solid #e4e9f3;border-radius:10px;padding:5px 7px;font-weight:900;font-size:12px}.busTimes{font-weight:800;font-size:13px;color:#263550}.busMeta{font-size:10px;color:#7e899e;margin-top:2px}.transitRefresh{width:100%;margin-top:10px}
'''
s=s.replace('</style>',css+'</style>',1)

# Constants + live state
s=s.replace("const LTA_SNAPSHOT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot';","const LTA_SNAPSHOT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot';\nconst LTA_TRANSPORT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-public-transport';",1)
s=s.replace("const live={rate:null,weather:{},air:null,traffic:null,prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};","const live={rate:null,weather:{},air:null,traffic:null,transport:null,prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};",1)

# Load transport after location permission is granted
s=s.replace('await Promise.allSettled([loadPrayer(),loadNearbyPrayer(),loadAir()]);','await Promise.allSettled([loadPrayer(),loadNearbyPrayer(),loadAir(),loadPublicTransport()]);',1)

# Add transport to customizable widgets
s=s.replace(" {id:'traffic',label:'🚦 Causeway snapshot'},\n {id:'currency',label:'💱 SGD / MYR'},"," {id:'traffic',label:'🚦 Causeway snapshot'},\n {id:'transport',label:'🚌 MRT & Bus'},\n {id:'currency',label:'💱 SGD / MYR'},",1)

# Journey intent helpers before aiContext
marker='''function aiContext(){'''
helpers='''const JOURNEY_PRESETS={
 'sg-jb':'I am going to JB from Singapore.',
 'within-sg':'I am commuting within Singapore.',
 'surrounding':'I just want to check my surrounding status.'
};
function selectJourneyIntent(id,btn){
 localStorage.setItem('runsgdJourneyIntent',id);
 document.querySelectorAll('.journeyChoice').forEach(x=>x.classList.toggle('active',x.dataset.journey===id));
 let e=$('journeyCustom');if(e)e.value='';
}
function journeyCustomChanged(){
 let e=$('journeyCustom');if(!e)return;
 if(e.value.trim()){localStorage.setItem('runsgdJourneyIntent','custom');document.querySelectorAll('.journeyChoice').forEach(x=>x.classList.remove('active'));localStorage.setItem('runsgdJourneyCustom',e.value.trim())}
 else localStorage.removeItem('runsgdJourneyCustom')
}
function getJourneyIntent(){
 let custom=$('journeyCustom')?.value.trim()||localStorage.getItem('runsgdJourneyCustom')||'';
 if(custom)return custom;
 let id=localStorage.getItem('runsgdJourneyIntent')||'';
 return JOURNEY_PRESETS[id]||'Check what matters for me right now based on my current location and RunSGD data.'
}
function restoreJourneyIntent(){
 let id=localStorage.getItem('runsgdJourneyIntent')||'';
 let custom=localStorage.getItem('runsgdJourneyCustom')||'';
 if(custom){let e=$('journeyCustom');if(e)e.value=custom;return}
 document.querySelectorAll('.journeyChoice').forEach(x=>x.classList.toggle('active',x.dataset.journey===id));
}

function aiContext(){'''
if marker not in s: raise SystemExit('aiContext marker not found')
s=s.replace(marker,helpers,1)

# Make journey intent explicit to AI context
s=s.replace(" let p=getHomeWidgetPrefs(),enabled=p.order.filter(x=>!p.hidden.includes(x)),c={\n   time:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit'}),\n   location:live.location?.name||'Not provided',\n   likely_direction:live.location?.name==='Johor area'?'JB → SG':live.location?.name==='Singapore area'?'SG → JB':'Unknown',\n   enabled_widgets:enabled\n };"," let p=getHomeWidgetPrefs(),enabled=p.order.filter(x=>!p.hidden.includes(x)),journey=getJourneyIntent(),c={\n   time:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit'}),\n   location:live.location?.name||'Not provided',\n   journey_intent:journey,\n   likely_direction:journey.includes('JB from Singapore')?'SG → JB (user selected)':journey.includes('within Singapore')?'Within Singapore (user selected)':live.location?.name==='Johor area'?'JB → SG':live.location?.name==='Singapore area'?'SG → JB':'Unknown',\n   enabled_widgets:enabled\n };",1)
s=s.replace(" if(enabled.includes('traffic')&&live.traffic)c.causeway=live.traffic;"," if(enabled.includes('traffic')&&live.traffic)c.causeway=live.traffic;\n if(enabled.includes('transport')&&live.transport)c.public_transport={train:live.transport.train||null,woodlands_crowd:live.transport.woodlands_crowd||null,nearby_bus_stops:(live.transport.nearby_bus_stops||[]).slice(0,2).map(x=>({code:x.code,description:x.description,distance_m:x.distance_m,services:(x.services||[]).slice(0,6)}))};",1)

# Pass selected/custom intent to brief retrieval and AI
s=s.replace("try{let j=await callRunSgdAi('brief');","try{let j=await callRunSgdAi('brief',getJourneyIntent());",1)

# Public transport loader before Twelve Data loader
pt_code='''
function shortTransitTime(v){if(!v)return '';let d=new Date(v);if(!Number.isFinite(d.getTime()))return '';return d.toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})}
function renderPublicTransport(j){
 let train=j?.train||{},crowd=j?.woodlands_crowd||null,stops=j?.nearby_bus_stops||[];
 txt('transportBadge','Live');
 if(train.status==='disrupted'){
   txt('mrtStatus','⚠ Disruption');
   let a=train.affected?.[0],m=train.messages?.[0]?.content||'';
   txt('mrtDetail',m||(a?`${a.line||'MRT'} affected${a.stations?' · '+a.stations:''}.`:'LTA reports a major train disruption.'));
 }else{
   txt('mrtStatus','✓ Normal');
   txt('mrtDetail',crowd?`Network normal · Woodlands NS9 crowd: ${crowd.crowd_label}.`:'Network normal · Woodlands crowd data unavailable.');
 }
 let box=$('nearbyBusList');
 if(!box)return;
 if(!live.location||live.location.name!=='Singapore area'){
   txt('busStatus','Location needed');
   box.innerHTML='<div class="sub">Use the location button at the top while you are in Singapore to see nearby bus arrivals.</div>';
 }else if(!stops.length){
   txt('busStatus','No stop found');box.innerHTML='<div class="sub">No nearby bus stop data is available right now.</div>';
 }else{
   txt('busStatus','Live arrivals');
   box.innerHTML=stops.map(st=>`<div class="transitStop"><b>🚏 ${esc(st.description||st.road||st.code)}</b><div class="busMeta">${esc(st.code)} · ${Math.round(st.distance_m||0)} m away</div>${(st.services||[]).slice(0,5).map(sv=>{let arr=(sv.arrivals||[]).slice(0,3),times=arr.map(a=>a.minutes===0?'Due':a.minutes+' min').join(' · '),meta=arr[0]?.load_label||'';return `<div class="busArrivalRow"><span class="busNo">${esc(sv.service_no)}</span><div><div class="busTimes">${esc(times||'No prediction')}</div><div class="busMeta">${esc(meta)}${arr[0]?.wheelchair?' · ♿':''}</div></div></div>`}).join('')}</div>`).join('');
 }
 txt('transportTime','Checked '+new Date(j.fetched_at||Date.now()).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})+' · LTA DataMall');
}
async function loadPublicTransport(btn=null){
 if(btn)setBusy(btn,true);txt('transportBadge','Loading');
 try{
   let q='';
   if(live.location?.name==='Singapore area')q='?lat='+encodeURIComponent(live.location.lat)+'&lon='+encodeURIComponent(live.location.lon);
   let r=await fetch(LTA_TRANSPORT_URL+q,{cache:'no-store'}),j=await r.json();
   if(!r.ok)throw Error(j.error||'Public transport unavailable');
   live.transport=j;renderPublicTransport(j);
 }catch(e){
   txt('transportBadge','Unavailable');txt('mrtStatus','Unavailable');txt('mrtDetail','LTA public transport data is temporarily unavailable.');txt('busStatus','Unavailable');let b=$('nearbyBusList');if(b)b.innerHTML='<div class="sub">Try again shortly.</div>';
 }finally{if(btn)setBusy(btn,false)}
}
'''
needle='''function loadTwelveKeyField(){'''
if needle not in s: raise SystemExit('Twelve loader marker not found')
s=s.replace(needle,pt_code+'\n'+needle,1)

# Refresh all signals includes transport
old_refresh="async function refreshAll(btn){setBusy(btn,true);txt('briefStatus','Updating');await Promise.allSettled([loadTrafficSnapshot(),loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);updateBrief();setBusy(btn,false)}"
new_refresh="async function refreshAll(btn){setBusy(btn,true);txt('briefStatus','Updating');await Promise.allSettled([loadTrafficSnapshot(),loadPublicTransport(),loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);updateBrief();setBusy(btn,false)}"
if old_refresh not in s: raise SystemExit('refreshAll marker not found')
s=s.replace(old_refresh,new_refresh,1)

# Restore selection at startup
s=s.replace('async function init(){greeting();restoreLocation();loadTwelveKeyField();applyHomeWidgets();','async function init(){greeting();restoreLocation();restoreJourneyIntent();loadTwelveKeyField();applyHomeWidgets();',1)

p.write_text(s,encoding='utf-8')

# Force installed PWA shell refresh
sw=Path('sw.js')
ws=sw.read_text(encoding='utf-8')
ws=ws.replace("runsgd-shell-v204","runsgd-shell-v210")
sw.write_text(ws,encoding='utf-8')
print('patched RunSGD v2.1.0')
