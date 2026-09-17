from pathlib import Path

# ---- Main app ----
p = Path('index.html')
s = p.read_text(encoding='utf-8')
if 'runSGD v1.6.7' in s:
    raise SystemExit('already patched')
s = s.replace('runSGD v1.6.6','runSGD v1.6.7').replace('RunSGD v1.6.6','RunSGD v1.6.7').replace('>v1.6.6<','>v1.6.7<')

css = '''
.causewayFrame{margin-top:10px;border-radius:19px;overflow:hidden;background:linear-gradient(120deg,#eef5ff,#f7f1ff);border:1px solid #e7ebf3;min-height:190px;display:grid;place-items:center}.causewayImg{width:100%;height:auto;display:none;object-fit:cover}.causewayPlaceholder{padding:34px 20px;text-align:center;color:#748097;font-size:13px;line-height:1.5}.causewayLabel{font-size:13px;font-weight:800;color:#46536d}.causewaySource{font-size:11px;color:#8a95aa;margin-top:4px}
'''
s = s.replace('</style>', css + '</style>', 1)

currency_anchor = '''<article class="card">
  <div class="head"><div class="title">💱 SGD / MYR</div><span id="rateBadge" class="tag">Loading</span></div>'''
camera_card = '''<article class="card">
  <div class="head"><div class="title">🚦 Causeway snapshot</div><span id="causewayBadge" class="tag">Starting</span></div>
  <div class="causewayLabel">Woodlands Causeway → Johor</div>
  <div class="causewaySource">LTA Camera 2701 · latest still image</div>
  <div class="causewayFrame">
    <img id="causewayImg" class="causewayImg" alt="Latest Woodlands Causeway traffic snapshot towards Johor">
    <div id="causewayPlaceholder" class="causewayPlaceholder">Connecting to LTA DataMall…</div>
  </div>
  <div id="causewayTime" class="status">LTA updates this camera every 1–5 minutes.</div>
  <button id="causewayRefreshBtn" class="btn refresh" onclick="loadCausewaySnapshot(this)">↻ Refresh snapshot</button>
</article>

'''
if currency_anchor not in s:
    raise SystemExit('currency anchor not found')
s = s.replace(currency_anchor, camera_card + currency_anchor, 1)

rate_anchor = 'async function loadRate(){'
camera_js = '''const LTA_TRAFFIC_PROXY='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic';
async function loadCausewaySnapshot(btn){
  let img=$('causewayImg'),ph=$('causewayPlaceholder');
  if(!img||!ph)return;
  setBusy(btn,true);txt('causewayBadge','Loading');txt('causewayTime','Requesting latest LTA camera image…');
  try{
    let c=new AbortController(),t=setTimeout(()=>c.abort(),15000),r;
    try{r=await fetch(LTA_TRAFFIC_PROXY,{method:'GET',cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}
    let j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||('Camera service error '+r.status));
    if(!j.imageLink)throw Error('No camera image returned');
    img.onload=()=>{img.style.display='block';ph.style.display='none'};
    img.onerror=()=>{img.style.display='none';ph.style.display='grid';ph.textContent='The latest camera image could not be displayed. Tap refresh to try again.';txt('causewayBadge','Image error')};
    img.src=j.imageLink;
    let stamp=j.fetchedAt?new Date(j.fetchedAt):new Date(),time=stamp.toLocaleTimeString('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'});
    txt('causewayBadge','Live');txt('causewayTime','Updated '+time+' · LTA DataMall · refreshes every 1–5 min');
  }catch(e){
    img.style.display='none';ph.style.display='grid';
    let msg=String(e?.message||'');
    if(msg.includes('not configured'))ph.textContent='LTA AccountKey is not configured yet. Admin can add it in More → Admin settings.';
    else ph.textContent='Causeway snapshot is temporarily unavailable. Tap refresh to try again.';
    txt('causewayBadge',msg.includes('not configured')?'API key':'Unavailable');txt('causewayTime',msg||'Unable to reach LTA traffic camera service.');
  }finally{setBusy(btn,false)}
}

'''
if rate_anchor not in s:
    raise SystemExit('loadRate anchor not found')
s = s.replace(rate_anchor, camera_js + rate_anchor, 1)

old_refresh = "await Promise.allSettled([loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);"
new_refresh = "await Promise.allSettled([loadRate(),loadWeather(),loadPrayer(),loadHolidays(),loadCausewaySnapshot(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);"
if old_refresh not in s:
    raise SystemExit('refreshAll list not found')
s = s.replace(old_refresh, new_refresh, 1)

clock_anchor = "setInterval(updateClocks,1000);updateClocks();"
clock_new = "setInterval(updateClocks,1000);updateClocks();setInterval(()=>{if(document.visibilityState==='visible')loadCausewaySnapshot()},300000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&localStorage.getItem('runsgdPage')==='home')loadCausewaySnapshot()});"
if clock_anchor not in s:
    raise SystemExit('clock anchor not found')
s = s.replace(clock_anchor, clock_new, 1)

p.write_text(s, encoding='utf-8')

# ---- Admin ----
p = Path('admin/index.html')
s = p.read_text(encoding='utf-8')

fx_anchor = '''<article class="card" id="fxCard">'''
lta_card = '''<article class="card" id="ltaCard">
 <div class="head"><div class="title">🚦 LTA DataMall · Causeway Camera</div><span id="ltaState" class="pill">Not configured</span></div>
 <p class="sub">AccountKey for the Woodlands Causeway traffic snapshot. The key is stored in your protected Supabase settings and is not exposed to RunSGD visitors or GitHub.</p>
 <div class="field"><label for="ltaKey">LTA DataMall AccountKey</label><div class="row"><input id="ltaKey" class="input" type="password" placeholder="Paste LTA AccountKey" autocomplete="off"><button class="btn soft" onclick="toggleKey('ltaKey',this)">Show</button></div></div>
 <div class="row" style="margin-top:12px"><button class="btn primary" onclick="saveLta()">Save key</button><button id="ltaTestBtn" class="btn soft" onclick="testLta()">Test Causeway</button></div>
 <div id="ltaStatus" class="status">Camera 2701 · Woodlands Causeway towards Johor.</div>
</article>

'''
if fx_anchor not in s:
    raise SystemExit('admin fx anchor not found')
s = s.replace(fx_anchor, lta_card + fx_anchor, 1)

clear_anchor = "function clearAll(){if(!confirm('Clear RunSGD API settings from this browser?'))return;localStorage.removeItem('runsgdTwelveDataKey');localStorage.removeItem('runsgdAdminConfig');load();$('twelveStatus').textContent='API settings cleared.';$('llmStatus').textContent='LLM settings cleared.'}"
lta_js = '''const LTA_PROXY_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic';
async function loadLtaConfig(){
  try{
    let {data,error}=await adminSb.from('app_secrets').select('key,updated_at').eq('key','lta_account_key').maybeSingle();
    if(error)throw error;
    let configured=!!data;$('ltaState').textContent=configured?'Configured':'Not configured';$('ltaState').classList.toggle('ok',configured);
    $('ltaStatus').textContent=configured?'LTA AccountKey saved securely. Camera 2701 is ready to test.':'Paste your LTA DataMall AccountKey, then save it.';
  }catch(e){$('ltaState').textContent='Unavailable';$('ltaStatus').textContent='Could not check LTA configuration.'}
}
async function saveLta(){
  let key=$('ltaKey').value.trim();if(!key)return $('ltaStatus').textContent='Paste the LTA AccountKey first.';
  let {data:{session}}=await adminSb.auth.getSession();if(!session)return $('ltaStatus').textContent='Admin session is required.';
  $('ltaStatus').textContent='Saving LTA AccountKey…';
  let {error}=await adminSb.from('app_secrets').upsert({key:'lta_account_key',secret_value:key,updated_at:new Date().toISOString(),updated_by:session.user.id},{onConflict:'key'});
  if(error)return $('ltaStatus').textContent='Save failed · '+error.message;
  $('ltaKey').value='';flash($('ltaCard'));await loadLtaConfig();
}
async function testLta(){
  if($('ltaKey').value.trim())await saveLta();
  let b=$('ltaTestBtn');b.disabled=true;b.textContent='Testing…';$('ltaStatus').textContent='Requesting Woodlands Causeway camera 2701…';
  try{let r=await fetch(LTA_PROXY_URL,{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok||!j.imageLink)throw Error(j.error||('HTTP '+r.status));let t=new Date(j.fetchedAt||Date.now()).toLocaleTimeString('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'});$('ltaStatus').textContent='✓ Working · Causeway snapshot received at '+t;$('ltaState').textContent='Working';$('ltaState').classList.add('ok')}catch(e){$('ltaStatus').textContent='Test failed · '+(e.message||'Unknown error')}finally{b.disabled=false;b.textContent='Test Causeway'}
}
'''
if clear_anchor not in s:
    raise SystemExit('clearAll anchor not found')
s = s.replace(clear_anchor, lta_js + '\n' + clear_anchor, 1)

old_guard = "    load();\n    await loadMembers();"
new_guard = "    load();\n    await loadMembers();\n    await loadLtaConfig();"
if old_guard not in s:
    raise SystemExit('guard load anchor not found')
s = s.replace(old_guard, new_guard, 1)

old_note = "This is a static GitHub Pages test app. API keys saved here are stored in this browser's localStorage, not in the GitHub repository. They are still visible to anyone with access to this browser profile and are not server-side secrets."
new_note = "Twelve Data and future LLM test settings are stored in this browser's localStorage. The LTA DataMall AccountKey is different: it is stored in protected Supabase settings and used server-side so visitors do not receive the key."
if old_note in s:
    s = s.replace(old_note, new_note, 1)

p.write_text(s, encoding='utf-8')
print('patched v1.6.7')
