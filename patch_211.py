from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

if 'v2.1.0' not in s:
    raise SystemExit('expected v2.1.0 not found')
s=s.replace('v2.1.0','v2.1.1')

# Replace journey chips with a compact dropdown and keep free text for custom intent.
pat=r'''<div class="journeyChoices" aria-label="Journey choices">.*?</div>\s*<input id="journeyCustom" class="journeyCustom" maxlength="180" placeholder="Or tell RunSGD what you want to do…" oninput="journeyCustomChanged\(\)">'''
new='''<div class="journeySelectWrap">
    <label class="journeySelectLabel" for="journeyIntentSelect">My journey</label>
    <select id="journeyIntentSelect" class="journeySelect" onchange="journeyIntentChanged()">
      <option value="">Choose what you are doing…</option>
      <option value="sg-jb">🇸🇬 → 🇲🇾 Going to JB from SG</option>
      <option value="jb-sg">🇲🇾 → 🇸🇬 Going to SG from JB</option>
      <option value="within-sg">🚇 Commuting within SG</option>
      <option value="surrounding">📍 Check my surroundings</option>
      <option value="custom">✍️ Something else</option>
    </select>
  </div>
  <input id="journeyCustom" class="journeyCustom" maxlength="180" placeholder="Tell RunSGD what you want to do…" oninput="journeyCustomChanged()">'''
s,n=re.subn(pat,new,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'journey UI replace failed: {n}')

# Add dropdown styling while leaving old chip CSS harmless.
css='''
/* v2.1.1 journey dropdown */
.journeySelectWrap{margin-top:12px}.journeySelectLabel{display:block;font-size:11px;font-weight:850;color:#6a7690;margin:0 0 6px 2px}.journeySelect{width:100%;border:1px solid #e2e7f1;background:#fff;border-radius:15px;padding:12px 13px;color:#17213b;font-weight:800}.journeyCustom{display:none}.journeyCustom.show{display:block}
'''
s=s.replace('</style>',css+'</style>',1)

# Replace journey helper block with dropdown-aware helpers and add JB -> SG as a first-class intent.
helper_pat=r'''const JOURNEY_PRESETS=\{.*?\nfunction aiContext\(\)\{'''
helpers='''const JOURNEY_PRESETS={
 'sg-jb':'I am going to JB from Singapore.',
 'jb-sg':'I am going to Singapore from JB.',
 'within-sg':'I am commuting within Singapore.',
 'surrounding':'I just want to check my surrounding status.'
};
function journeyIntentChanged(){
 let sel=$('journeyIntentSelect'),id=sel?.value||'';
 if(id)localStorage.setItem('runsgdJourneyIntent',id);else localStorage.removeItem('runsgdJourneyIntent');
 let custom=$('journeyCustom'),isCustom=id==='custom';
 if(custom)custom.classList.toggle('show',isCustom);
 if(!isCustom){localStorage.removeItem('runsgdJourneyCustom');if(custom)custom.value=''}
 else custom?.focus();
}
function journeyCustomChanged(){
 let e=$('journeyCustom');if(!e)return;
 let v=e.value.trim();
 if(v)localStorage.setItem('runsgdJourneyCustom',v);else localStorage.removeItem('runsgdJourneyCustom');
}
function getJourneyIntent(){
 let id=$('journeyIntentSelect')?.value||localStorage.getItem('runsgdJourneyIntent')||'';
 if(id==='custom'){
   let custom=$('journeyCustom')?.value.trim()||localStorage.getItem('runsgdJourneyCustom')||'';
   return custom||'I have a custom journey. Use my current RunSGD data to tell me what matters.';
 }
 return JOURNEY_PRESETS[id]||'Check what matters for me right now based on my current location and RunSGD data.';
}
function restoreJourneyIntent(){
 let id=localStorage.getItem('runsgdJourneyIntent')||'',custom=localStorage.getItem('runsgdJourneyCustom')||'';
 let sel=$('journeyIntentSelect');if(sel)sel.value=id;
 let e=$('journeyCustom');if(e){e.value=custom;e.classList.toggle('show',id==='custom')}
}

function aiContext(){'''
s,n=re.subn(helper_pat,helpers,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'journey helper replace failed: {n}')

# Add reverse border direction to AI context.
old="likely_direction:journey.includes('JB from Singapore')?'SG → JB (user selected)':journey.includes('within Singapore')?'Within Singapore (user selected)':live.location?.name==='Johor area'?'JB → SG':live.location?.name==='Singapore area'?'SG → JB':'Unknown',"
new="likely_direction:journey.includes('JB from Singapore')?'SG → JB (user selected)':journey.includes('Singapore from JB')?'JB → SG (user selected)':journey.includes('within Singapore')?'Within Singapore (user selected)':live.location?.name==='Johor area'?'JB → SG':live.location?.name==='Singapore area'?'SG → JB':'Unknown',"
if old not in s:
    raise SystemExit('likely_direction line not found')
s=s.replace(old,new,1)

# Save a fresh detection timestamp when user taps the global location button too.
s=s.replace('live.location=classify(p.coords.latitude,p.coords.longitude);','live.location={...classify(p.coords.latitude,p.coords.longitude),detected_at:Date.now()};',1)

# Make public transport automatically try the current device location.
needle='''async function loadPublicTransport(btn=null){
 if(btn)setBusy(btn,true);txt('transportBadge','Loading');'''
replacement='''async function autoDetectTransportLocation(force=false){
 if(!navigator.geolocation)return false;
 let fresh=live.location?.detected_at&&Date.now()-live.location.detected_at<120000;
 if(fresh&&!force)return true;
 txt('busStatus','Detecting location…');
 txt('transportTime','Detecting your current area for nearby transport…');
 return await new Promise(resolve=>{
   navigator.geolocation.getCurrentPosition(p=>{
     live.location={...classify(p.coords.latitude,p.coords.longitude),detected_at:Date.now()};
     localStorage.setItem('runsgdLocation',JSON.stringify(live.location));
     txt('locBtn','📍 '+live.location.name);txt('prayerLoc',live.location.name);
     resolve(true);
   },()=>resolve(false),{enableHighAccuracy:false,timeout:7000,maximumAge:60000});
 });
}
async function useTransportLocation(btn){
 setBusy(btn,true);
 let ok=await autoDetectTransportLocation(true);
 setBusy(btn,false);
 if(ok)loadPublicTransport();
 else{txt('busStatus','Location off');let b=$('nearbyBusList');if(b)b.innerHTML='<div class="sub">Location access is off. Enable it in your browser to see nearby Singapore buses.</div>'}
}
async function loadPublicTransport(btn=null){
 if(btn)setBusy(btn,true);txt('transportBadge','Loading');
 await autoDetectTransportLocation(false);'''
if needle not in s:
    raise SystemExit('loadPublicTransport start not found')
s=s.replace(needle,replacement,1)

# Make the transport card location-aware instead of saying Location needed for Johor users.
old_branch=''' if(!live.location||live.location.name!=='Singapore area'){
   txt('busStatus','Location needed');
   box.innerHTML='<div class="sub">Use the location button at the top while you are in Singapore to see nearby bus arrivals.</div>';
 }else if(!stops.length){'''
new_branch=''' if(!live.location){
   txt('busStatus','Location unavailable');
   box.innerHTML='<div class="sub">RunSGD could not detect your location automatically.</div><button class="miniBtn" style="margin-top:9px" onclick="useTransportLocation(this)">📍 Use my location</button>';
 }else if(live.location.name==='Johor area'){
   txt('busStatus','Johor detected');
   box.innerHTML='<div class="sub">You are currently in the Johor area. Singapore nearby-bus arrivals will switch on automatically after RunSGD detects you in Singapore.</div>';
 }else if(!stops.length){'''
if old_branch not in s:
    raise SystemExit('transport location branch not found')
s=s.replace(old_branch,new_branch,1)

# Clarify MRT wording and display detected area in the freshness line.
s=s.replace("txt('mrtDetail',crowd?`Network normal · Woodlands NS9 crowd: ${crowd.crowd_label}.`:'Network normal · Woodlands crowd data unavailable.');","txt('mrtDetail',crowd?`Singapore MRT normal · Woodlands NS9 crowd: ${crowd.crowd_label}.`:'Singapore MRT normal · Woodlands crowd data unavailable.');",1)
s=s.replace("txt('transportTime','Checked '+new Date(j.fetched_at||Date.now()).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})+' · LTA DataMall');","txt('transportTime','Checked '+new Date(j.fetched_at||Date.now()).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})+' · '+(live.location?.name||'Location unavailable')+' · LTA DataMall');",1)

p.write_text(s,encoding='utf-8')

sw=Path('sw.js')
ws=sw.read_text(encoding='utf-8')
if 'runsgd-shell-v210' not in ws:
    raise SystemExit('service worker cache v210 not found')
ws=ws.replace('runsgd-shell-v210','runsgd-shell-v211')
sw.write_text(ws,encoding='utf-8')

print('patched RunSGD v2.1.1')
