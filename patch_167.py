from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.7' not in s:
    s=s.replace('runSGD v1.6.6','runSGD v1.6.7').replace('RunSGD v1.6.6','RunSGD v1.6.7').replace('>v1.6.6<','>v1.6.7<')

    css='''\n.trafficSnap{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px;background:linear-gradient(120deg,#eef4ff,#f7f1ff);display:none}.trafficPlaceholder{display:grid;place-items:center;min-height:180px;border-radius:18px;background:linear-gradient(120deg,#eef4ff,#f7f1ff);color:#748097;text-align:center;padding:24px}.trafficControls{display:flex;gap:8px;align-items:center;margin-top:10px}.trafficControls select{flex:1;min-width:0;border:1px solid #e2e7f1;background:#fff;border-radius:14px;padding:10px 11px;color:#17213b}.trafficMeta{font-size:11px;color:#7b879c;margin-top:8px;line-height:1.45}\n'''
    s=s.replace('</style>',css+'</style>',1)

    home_anchor='''<article class="card">\n  <div class="head"><div class="title">💱 SGD / MYR</div><span id="rateBadge" class="tag">Loading</span></div>'''
    traffic='''<article class="card">\n  <div class="head"><div class="title">🚦 Causeway snapshot</div><span id="trafficBadge" class="tag">Loading</span></div>\n  <div id="trafficPlaceholder" class="trafficPlaceholder">Connecting to LTA traffic camera…</div>\n  <img id="trafficImage" class="trafficSnap" alt="Latest LTA traffic camera snapshot">\n  <div id="trafficName" class="title" style="margin-top:11px">Woodlands Causeway (Towards Johor)</div>\n  <div id="trafficTime" class="trafficMeta">Latest LTA DataMall snapshot · refreshes every 1–5 minutes.</div>\n  <div class="trafficControls">\n    <select id="trafficCamera" onchange="loadTrafficSnapshot()">\n      <option value="2701">Causeway → Johor</option>\n      <option value="2702">Woodlands Checkpoint</option>\n      <option value="4703">Tuas Second Link</option>\n      <option value="4713">Tuas Checkpoint</option>\n    </select>\n    <button class="miniBtn" onclick="loadTrafficSnapshot(this)">Refresh</button>\n  </div>\n</article>\n\n'''
    if home_anchor not in s: raise SystemExit('home anchor not found')
    s=s.replace(home_anchor,traffic+home_anchor,1)

    const_anchor="const SUPABASE_KEY='sb_publishable_ke21EcVtLjGPLwX2T_-xng_CnhM6HBM';"
    if const_anchor not in s: raise SystemExit('supabase key anchor missing')
    s=s.replace(const_anchor,const_anchor+"\nconst LTA_SNAPSHOT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot';",1)

    get_anchor='''async function get(u,ms=12000){\n let c=new AbortController(),t=setTimeout(()=>c.abort(),ms);\n try{let r=await fetch(u,{signal:c.signal,cache:'no-store'});if(!r.ok)throw Error(r.status);return await r.json()}finally{clearTimeout(t)}\n}\n'''
    traffic_js='''function trafficClock(v){if(!v)return '';let d=new Date(v);if(!Number.isFinite(d.getTime()))return '';return d.toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}\nasync function loadTrafficSnapshot(btn){\n let camera=$('trafficCamera')?.value||'2701',img=$('trafficImage'),ph=$('trafficPlaceholder');\n if(btn)setBusy(btn,true);txt('trafficBadge','Loading');\n try{\n   let r=await fetch(LTA_SNAPSHOT_URL+'?camera='+encodeURIComponent(camera),{cache:'no-store'}),j=await r.json();\n   if(!r.ok||!j.image_url)throw Error(j.error||'Snapshot unavailable');\n   if(ph)ph.style.display='none';if(img){img.style.display='block';img.src=j.image_url+'#'+Date.now()}\n   txt('trafficName',j.name||'LTA traffic camera');txt('trafficBadge','Live');\n   let captured=trafficClock(j.captured_at),fetched=trafficClock(j.fetched_at);\n   txt('trafficTime',(captured?'Captured '+captured:(fetched?'Checked '+fetched:'Latest image'))+' · LTA DataMall · refresh 1–5 min');\n }catch(e){\n   if(img)img.style.display='none';if(ph){ph.style.display='grid';ph.textContent=String(e.message||'Snapshot unavailable').includes('configured')?'LTA API key is not configured yet. Add it in Admin settings.':'Causeway snapshot is temporarily unavailable.'}\n   txt('trafficBadge','Unavailable');txt('trafficTime','LTA DataMall traffic image service.');\n }finally{if(btn)setBusy(btn,false)}\n}\n'''
    if get_anchor not in s: raise SystemExit('get anchor missing')
    s=s.replace(get_anchor,get_anchor+traffic_js,1)

    old_refresh="await Promise.allSettled([loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);"
    new_refresh="await Promise.allSettled([loadTrafficSnapshot(),loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);"
    if old_refresh not in s: raise SystemExit('refresh anchor missing')
    s=s.replace(old_refresh,new_refresh,1)
    p.write_text(s,encoding='utf-8')

p=Path('admin/index.html')
s=p.read_text(encoding='utf-8')
if 'LTA DataMall · Traffic Images' not in s:
    first_card='''<article class="card" id="fxCard">'''
    lta_card='''<article class="card" id="ltaCard">\n <div class="head"><div class="title">🚦 LTA DataMall · Traffic Images</div><span id="ltaState" class="pill">Not configured</span></div>\n <p class="sub">AccountKey for the Causeway snapshot on Home. Saved securely in Supabase for RunSGD; it is not stored in GitHub or exposed to visitors.</p>\n <div class="field"><label for="ltaKey">LTA AccountKey</label><div class="row"><input id="ltaKey" class="input" type="password" placeholder="Paste LTA DataMall AccountKey" autocomplete="off"><button class="btn soft" onclick="toggleKey('ltaKey',this)">Show</button></div></div>\n <div class="row" style="margin-top:12px"><button class="btn primary" onclick="saveLtaKey()">Save</button><button id="ltaTestBtn" class="btn soft" onclick="testLta()">Test Causeway</button></div>\n <div id="ltaStatus" class="status">Camera 2701 · Woodlands Causeway towards Johor.</div>\n</article>\n\n'''
    if first_card not in s: raise SystemExit('admin card anchor missing')
    s=s.replace(first_card,lta_card+first_card,1)

    load_anchor="function load(){let c=cfg(),tk=localStorage.getItem('runsgdTwelveDataKey')||c.twelveDataKey||'';$('twelveKey').value=tk;$('llmProvider').value=c.llmProvider||'disabled';$('llmKey').value=c.llmKey||'';$('llmModel').value=c.llmModel||'';$('llmEndpoint').value=c.llmEndpoint||'';maskState()}"
    load_new="function load(){let c=cfg(),tk=localStorage.getItem('runsgdTwelveDataKey')||c.twelveDataKey||'';$('twelveKey').value=tk;$('llmProvider').value=c.llmProvider||'disabled';$('llmKey').value=c.llmKey||'';$('llmModel').value=c.llmModel||'';$('llmEndpoint').value=c.llmEndpoint||'';maskState();loadLtaState()}"
    if load_anchor not in s: raise SystemExit('admin load anchor missing')
    s=s.replace(load_anchor,load_new,1)

    clear_anchor="function clearAll(){if(!confirm('Clear RunSGD API settings from this browser?'))return;localStorage.removeItem('runsgdTwelveDataKey');localStorage.removeItem('runsgdAdminConfig');load();$('twelveStatus').textContent='API settings cleared.';$('llmStatus').textContent='LLM settings cleared.'}"
    lta_js="""async function loadLtaState(){try{let {data,error}=await adminSb.from('app_settings').select('secret_value').eq('key','lta_account_key').maybeSingle();if(error)throw error;let ok=!!data?.secret_value;$('ltaState').textContent=ok?'Configured':'Not configured';$('ltaState').classList.toggle('ok',ok)}catch(e){$('ltaState').textContent='Unavailable'}}\nasync function saveLtaKey(){let key=$('ltaKey').value.trim();if(!key)return $('ltaStatus').textContent='Paste your LTA AccountKey first.';$('ltaStatus').textContent='Saving…';let {error}=await adminSb.from('app_settings').update({secret_value:key,updated_at:new Date().toISOString()}).eq('key','lta_account_key');if(error)return $('ltaStatus').textContent='Save failed · '+error.message;$('ltaKey').value='';$('ltaState').textContent='Configured';$('ltaState').classList.add('ok');$('ltaStatus').textContent='Saved in Supabase. Testing Causeway camera…';await testLta()}\nasync function testLta(){let b=$('ltaTestBtn');b.disabled=true;b.textContent='Testing…';try{let r=await fetch('https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot?camera=2701',{cache:'no-store'}),j=await r.json();if(!r.ok||!j.image_url)throw Error(j.error||'No image returned');$('ltaStatus').textContent='✓ Working · '+(j.name||'Causeway camera')+' snapshot available';$('ltaState').textContent='Configured';$('ltaState').classList.add('ok')}catch(e){$('ltaStatus').textContent='Test failed · '+(e.message||'Unknown error')}finally{b.disabled=false;b.textContent='Test Causeway'}}\n"""
    if clear_anchor not in s: raise SystemExit('clear anchor missing')
    s=s.replace(clear_anchor,lta_js+clear_anchor,1)
    p.write_text(s,encoding='utf-8')

print('patched v1.6.7')
