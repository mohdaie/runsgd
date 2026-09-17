from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v2.0.0' in s:
    raise SystemExit('already patched')
if 'runSGD v1.6.12' not in s:
    raise SystemExit('expected v1.6.12 not found')

s=s.replace('runSGD v1.6.12','runSGD v2.0.0').replace('RunSGD v1.6.12','RunSGD v2.0.0').replace('>v1.6.12<','>v2.0.0<')

css='''
/* v2.0 AI Companion */
.aiBriefBar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
.aiMeta{font-size:10px;color:#8a94a8;line-height:1.35}
.aiMiniBtn{border:0;border-radius:999px;padding:7px 10px;background:linear-gradient(120deg,#eef5ff,#f5efff);color:#5063a9;font-size:10px;font-weight:900;white-space:nowrap}
.aiCard{background:linear-gradient(145deg,#ffffff 0%,#faf8ff 55%,#fff9fb 100%);border:1px solid #fff}
.aiAskShell{display:flex;align-items:center;gap:8px;margin-top:12px;padding:7px 8px 7px 12px;border:1px solid #e2e5ef;border-radius:18px;background:#fff;box-shadow:0 7px 18px #46537d0a}
.aiAskShell:focus-within{border-color:#9d8df0;box-shadow:0 0 0 4px #8b67ef12}
.aiAskInput{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#22304b;padding:7px 1px;font-size:14px}
.aiAskBtn{width:42px;height:42px;flex:0 0 auto;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:900;background:linear-gradient(135deg,#4b82f5,#7b69ef 55%,#e77da8);box-shadow:0 8px 18px #7566dd38}
.aiAnswer{display:none;margin-top:12px;padding:13px 14px;border-radius:17px;background:#fff;border:1px solid #e8e9f1}
.aiAnswer.show{display:block}.aiAnswerMain{font-size:15px;font-weight:850;line-height:1.38;color:#24304b}.aiAnswerReason{font-size:12px;line-height:1.45;color:#6f7a90;margin-top:5px}.aiSources{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.aiSource{font-size:9px;font-weight:850;padding:4px 7px;border-radius:999px;background:#eef3ff;color:#566bb5}
'''
s=s.replace('</style>',css+'\n</style>',1)

old='''  <div id="briefExtra" class="actionline">RunSGD only recommends an action when a signal is actually useful.</div>\n</article>'''
new='''  <div id="briefExtra" class="actionline">RunSGD only recommends an action when a signal is actually useful.</div>\n  <div class="aiBriefBar"><div id="aiBriefMeta" class="aiMeta">Deterministic fallback · AI uses RunSGD data only</div><button id="aiBriefBtn" class="aiMiniBtn" onclick="loadAiBrief(true,this)">✨ AI insight</button></div>\n</article>\n\n<article class="card aiCard">\n  <div class="head"><div class="title">✨ Ask RunSGD</div><span class="tag">Gemini 2.5 Flash-Lite</span></div>\n  <div class="sub">Ask about RunSGD live data, commuter knowledge or recent community updates. No external web search in v2.0.</div>\n  <div class="aiAskShell"><input id="aiQuestion" class="aiAskInput" maxlength="500" placeholder="e.g. Is Causeway busy? Do I need MDAC?" onkeydown="if(event.key==='Enter')askRunSgd()"><button id="aiAskBtn" class="aiAskBtn" onclick="askRunSgd(this)" aria-label="Ask RunSGD">➤</button></div>\n  <div id="aiAnswer" class="aiAnswer"><div id="aiAnswerMain" class="aiAnswerMain"></div><div id="aiAnswerReason" class="aiAnswerReason"></div><div id="aiSources" class="aiSources"></div></div>\n  <div id="aiAskStatus" class="status">Members can use AI after the Gemini key is configured by Admin.</div>\n</article>'''
if old not in s: raise SystemExit('brief anchor missing')
s=s.replace(old,new,1)

s=s.replace("const LTA_SNAPSHOT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot';","const LTA_SNAPSHOT_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/lta-traffic-snapshot';\nconst RUNSGD_AI_URL='https://gdycbluljgfezhgslppe.supabase.co/functions/v1/runsgd-ai';",1)
s=s.replace("const live={rate:null,weather:{},air:null,prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};","const live={rate:null,weather:{},air:null,traffic:null,prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};",1)

# Store selected LTA snapshot metadata in live context.
needle="txt('trafficName',j.name||'LTA traffic camera');txt('trafficBadge','Live');"
rep="live.traffic={camera_id:j.camera_id,name:j.name||'LTA traffic camera',captured_at:j.captured_at||j.fetched_at||null};txt('trafficName',j.name||'LTA traffic camera');txt('trafficBadge','Live');"
if needle not in s: raise SystemExit('traffic metadata anchor missing')
s=s.replace(needle,rep,1)

js='''
function aiContext(){
 let p=getHomeWidgetPrefs(),enabled=p.order.filter(x=>!p.hidden.includes(x)),c={
   time:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit'}),
   location:live.location?.name||'Not provided',enabled_widgets:enabled
 };
 if(enabled.includes('traffic')&&live.traffic)c.causeway=live.traffic;
 if(enabled.includes('currency')&&live.rate)c.currency={sgd_myr:Number(live.rate.toFixed(4))};
 if(enabled.includes('weather'))c.weather={SG:live.weather.SG||null,JB:live.weather.JB||null};
 if(enabled.includes('air')&&live.air)c.air_quality=live.air;
 if(enabled.includes('prayer')&&live.prayer)c.prayer={label:live.prayer.label,time:live.prayer.time,mins:live.prayer.mins,nearest:live.nearby?.[0]?.name||null};
 if(enabled.includes('holidays'))c.holidays=(live.holidays||[]).slice(0,3).map(x=>({name:x.name||x.localName,date:x.date}));
 return c
}
async function callRunSgdAi(mode,question=''){
 let {data:{session}}=await sb.auth.getSession();
 if(!session)throw Error('Sign in from Community to use RunSGD AI.');
 let r=await fetch(RUNSGD_AI_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({mode,question,context:aiContext()})});
 let j=await r.json();if(!r.ok)throw Error(j.error||'RunSGD AI is unavailable.');return j
}
function renderAiSources(id,sources){let e=$(id);if(!e)return;e.innerHTML=(sources||[]).slice(0,5).map(x=>`<span class="aiSource">${esc(x)}</span>`).join('')}
async function loadAiBrief(force=false,btn=null){
 let {data:{session}}=await sb.auth.getSession();if(!session){txt('aiBriefMeta','Sign in to enable AI · deterministic recommendation shown');return}
 let cached=old('aiBriefV2');if(!force&&cached?.answer&&Date.now()-(cached.saved_at||0)<600000){txt('brief',cached.answer);txt('briefWhy',cached.reason||'');txt('briefExtra',(cached.sources||[]).length?'AI sources: '+cached.sources.join(' · '):'RunSGD data only');txt('briefStatus','AI');txt('aiBriefMeta','Gemini 2.5 Flash-Lite · cached');return}
 setBusy(btn,true);txt('briefStatus','AI…');txt('aiBriefMeta','Analysing current RunSGD signals…');
 try{let j=await callRunSgdAi('brief');txt('brief',j.answer||'No action needed right now.');txt('briefWhy',j.reason||'');txt('briefExtra',(j.sources||[]).length?'AI sources: '+j.sources.join(' · '):'RunSGD data only');txt('briefStatus','AI');txt('aiBriefMeta','Gemini 2.5 Flash-Lite · RunSGD data only');save('aiBriefV2',{...j,saved_at:Date.now()})}catch(e){txt('aiBriefMeta',e.message||'AI unavailable · deterministic recommendation kept');updateBrief()}finally{setBusy(btn,false)}
}
async function askRunSgd(btn=null){
 let q=$('aiQuestion')?.value.trim();if(!q)return txt('aiAskStatus','Type a question first.');setBusy(btn||$('aiAskBtn'),true);txt('aiAskStatus','Searching RunSGD data…');$('aiAnswer')?.classList.remove('show');
 try{let j=await callRunSgdAi('ask',q);txt('aiAnswerMain',j.answer||'');txt('aiAnswerReason',j.reason||'');renderAiSources('aiSources',j.sources||[]);$('aiAnswer')?.classList.add('show');txt('aiAskStatus','Gemini 2.5 Flash-Lite · app data only · no web search')}catch(e){txt('aiAskStatus',e.message||'AI unavailable.')}finally{setBusy(btn||$('aiAskBtn'),false)}
}
'''
anchor='function signalCards(){'
if anchor not in s: raise SystemExit('signalCards anchor missing')
s=s.replace(anchor,js+'\n'+anchor,1)

# Knowledge articles now come from Supabase, with current hardcoded array as fallback.
old_render="function renderKnowledge(){let f=$('exploreFeed');if(!f)return;let refresh=$('feedRefreshBtn');if(refresh)refresh.style.display='none';txt('feedStatus','Quick guides · checked Sep 2026');f.innerHTML='<div class=\"kbIntro\"><strong>📚 SG ↔ JB commuter knowledge</strong><div class=\"sub\">Short, practical guides. AI search will come later.</div></div><div class=\"kbGrid\">'+knowledgeBase.map((a,i)=>`<article class=\"kbCard\" data-kb=\"${i}\"><div class=\"kbHead\" onclick=\"toggleKb(${i})\"><div class=\"kbIcon\">${a.icon}</div><div class=\"kbMain\"><div class=\"kbTitle\">${esc(a.title)}</div><div class=\"kbSummary\">${esc(a.summary)}</div></div><div class=\"kbChevron\">⌄</div></div><div class=\"kbBody\"><ul>${a.body.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a.source?`<a class=\"kbSource\" target=\"_blank\" rel=\"noopener\" href=\"${a.source}\">${esc(a.sourceLabel)} ↗</a>`:''}<div class=\"kbChecked\">Quick reference · rules can change</div></div></article>`).join('')+'</div>'}"
new_render="async function renderKnowledge(){let f=$('exploreFeed');if(!f)return;let refresh=$('feedRefreshBtn');if(refresh)refresh.style.display='none';txt('feedStatus','RunSGD knowledge · Supabase');let list=knowledgeBase;try{let {data,error}=await sb.from('knowledge_articles').select('title,category,summary,content,source_url,source_label,checked_at').eq('active',true).order('id');if(!error&&data?.length)list=data.map(a=>({icon:({border:'🚦',transport:'🚌',immigration:'🛂',driving:'🚗',shopping:'🛍️',money:'💱'})[a.category]||'📚',title:a.title,summary:a.summary,body:String(a.content||'').split(/(?<=[.!?])\\s+/).filter(Boolean),source:a.source_url||'',sourceLabel:a.source_label||''}))}catch{}f.innerHTML='<div class=\"kbIntro\"><strong>📚 SG ↔ JB commuter knowledge</strong><div class=\"sub\">Short guides stored in RunSGD and searchable by the v2.0 AI.</div></div><div class=\"kbGrid\">'+list.map((a,i)=>`<article class=\"kbCard\" data-kb=\"${i}\"><div class=\"kbHead\" onclick=\"toggleKb(${i})\"><div class=\"kbIcon\">${a.icon}</div><div class=\"kbMain\"><div class=\"kbTitle\">${esc(a.title)}</div><div class=\"kbSummary\">${esc(a.summary)}</div></div><div class=\"kbChevron\">⌄</div></div><div class=\"kbBody\"><ul>${a.body.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a.source?`<a class=\"kbSource\" target=\"_blank\" rel=\"noopener\" href=\"${a.source}\">${esc(a.sourceLabel)} ↗</a>`:''}<div class=\"kbChecked\">RunSGD knowledge · rules can change</div></div></article>`).join('')+'</div>'}"
if old_render not in s: raise SystemExit('knowledge render anchor missing')
s=s.replace(old_render,new_render,1)

# Init auth first, then live data, then one cached/cost-controlled AI brief.
old_init="async function init(){greeting();restoreLocation();loadTwelveKeyField();applyHomeWidgets();let hash=location.hash.replace('#',''),saved=localStorage.getItem('runsgdPage'),page=['home','explore','community','tools','more'].includes(hash)?hash:['home','explore','community','tools','more'].includes(saved)?saved:'home';showPage(page);updateBrief();refreshAll();initCommunity();if(live.location){loadNearbyPrayer();loadAir()}}"
new_init="async function init(){greeting();restoreLocation();loadTwelveKeyField();applyHomeWidgets();let hash=location.hash.replace('#',''),saved=localStorage.getItem('runsgdPage'),page=['home','explore','community','tools','more'].includes(hash)?hash:['home','explore','community','tools','more'].includes(saved)?saved:'home';showPage(page);updateBrief();await initCommunity();await refreshAll();if(communityUser)loadAiBrief();if(live.location){loadNearbyPrayer();loadAir()}}"
if old_init not in s: raise SystemExit('init anchor missing')
s=s.replace(old_init,new_init,1)

p.write_text(s,encoding='utf-8')

# Admin page: Gemini-specific secure server-side config.
a=Path('admin/index.html')
t=a.read_text(encoding='utf-8')
old_card='''<article class="card">\n <div class="head"><div class="title">✦ LLM Insight Engine</div><span class="pill">Prepared</span></div>\n <p class="sub">Reserved for the future “What should I do?” AI insight. Saving this now does not enable LLM calls in the main app yet.</p>\n <div class="field"><label for="llmProvider">Provider</label><select id="llmProvider" class="select"><option value="disabled">Disabled</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="gemini">Google Gemini</option><option value="custom">Custom endpoint</option></select></div>\n <div class="field"><label for="llmKey">API key</label><div class="row"><input id="llmKey" class="input" type="password" placeholder="LLM API key" autocomplete="off"><button class="btn soft" onclick="toggleKey('llmKey',this)">Show</button></div></div>\n <div class="field"><label for="llmModel">Model</label><input id="llmModel" class="input" placeholder="e.g. small / fast model"></div>\n <div class="field"><label for="llmEndpoint">Custom endpoint (optional)</label><input id="llmEndpoint" class="input" inputmode="url" placeholder="https://..."></div>\n <button class="btn primary full" onclick="saveLLM()">Save LLM settings</button>\n <div id="llmStatus" class="status">Not connected to the Home insight yet.</div>\n</article>'''
new_card='''<article class="card" id="geminiCard">\n <div class="head"><div class="title">✨ RunSGD AI · Gemini</div><span id="geminiState" class="pill">Not configured</span></div>\n <p class="sub">v2.0 uses Gemini 2.5 Flash-Lite to analyse RunSGD live data, Knowledge and recent Community updates. External web search is OFF.</p>\n <div class="field"><label>Model</label><input class="input" value="gemini-2.5-flash-lite" disabled></div>\n <div class="field"><label for="geminiKey">Gemini API key</label><div class="row"><input id="geminiKey" class="input" type="password" placeholder="Paste Google AI Studio API key" autocomplete="off"><button class="btn soft" onclick="toggleKey('geminiKey',this)">Show</button></div></div>\n <div class="row" style="margin-top:12px"><button class="btn primary" onclick="saveGeminiKey()">Save securely</button><button id="geminiTestBtn" class="btn soft" onclick="testGemini()">Test AI</button></div>\n <div id="geminiStatus" class="status">API key is stored in Supabase and never sent to GitHub Pages visitors.</div>\n</article>'''
if old_card not in t: raise SystemExit('admin LLM card anchor missing')
t=t.replace(old_card,new_card,1)

old_load="function load(){let c=cfg(),tk=localStorage.getItem('runsgdTwelveDataKey')||c.twelveDataKey||'';$('twelveKey').value=tk;$('llmProvider').value=c.llmProvider||'disabled';$('llmKey').value=c.llmKey||'';$('llmModel').value=c.llmModel||'';$('llmEndpoint').value=c.llmEndpoint||'';maskState();loadLtaState()}"
new_load="function load(){let c=cfg(),tk=localStorage.getItem('runsgdTwelveDataKey')||c.twelveDataKey||'';$('twelveKey').value=tk;maskState();loadLtaState();loadGeminiState()}"
if old_load not in t: raise SystemExit('admin load anchor missing')
t=t.replace(old_load,new_load,1)

gemini_js='''
async function loadGeminiState(){try{let {data,error}=await adminSb.from('app_settings').select('secret_value').eq('key','gemini_api_key').maybeSingle();if(error)throw error;let ok=!!data?.secret_value;$('geminiState').textContent=ok?'Configured':'Not configured';$('geminiState').classList.toggle('ok',ok)}catch(e){$('geminiState').textContent='Unavailable'}}
async function saveGeminiKey(){let key=$('geminiKey').value.trim();if(!key)return $('geminiStatus').textContent='Paste your Gemini API key first.';$('geminiStatus').textContent='Saving securely…';let {error}=await adminSb.from('app_settings').upsert({key:'gemini_api_key',secret_value:key,updated_at:new Date().toISOString()},{onConflict:'key'});if(error)return $('geminiStatus').textContent='Save failed · '+error.message;$('geminiKey').value='';$('geminiState').textContent='Configured';$('geminiState').classList.add('ok');$('geminiStatus').textContent='Saved in Supabase. Testing Gemini 2.5 Flash-Lite…';await testGemini()}
async function testGemini(){let b=$('geminiTestBtn');b.disabled=true;b.textContent='Testing…';try{let {data:{session}}=await adminSb.auth.getSession();if(!session)throw Error('Admin session missing');let r=await fetch('https://gdycbluljgfezhgslppe.supabase.co/functions/v1/runsgd-ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({mode:'ask',question:'What AI model is powering RunSGD?',context:{test:true}})}),j=await r.json();if(!r.ok)throw Error(j.error||'No response');$('geminiStatus').textContent='✓ Working · '+(j.model||'gemini-2.5-flash-lite');$('geminiState').textContent='Configured';$('geminiState').classList.add('ok')}catch(e){$('geminiStatus').textContent='Test failed · '+(e.message||'Unknown error')}finally{b.disabled=false;b.textContent='Test AI'}}
'''
anchor_admin='async function loadLtaState(){'
if anchor_admin not in t: raise SystemExit('admin JS anchor missing')
t=t.replace(anchor_admin,gemini_js+'\n'+anchor_admin,1)

t=t.replace("function clearAll(){if(!confirm('Clear RunSGD API settings from this browser?'))return;localStorage.removeItem('runsgdTwelveDataKey');localStorage.removeItem('runsgdAdminConfig');load();$('twelveStatus').textContent='API settings cleared.';$('llmStatus').textContent='LLM settings cleared.'}","function clearAll(){if(!confirm('Clear RunSGD local API settings from this browser?'))return;localStorage.removeItem('runsgdTwelveDataKey');localStorage.removeItem('runsgdAdminConfig');load();$('twelveStatus').textContent='Local API settings cleared.'}",1)
t=t.replace("This is a static GitHub Pages test app. API keys saved here are stored in this browser's localStorage, not in the GitHub repository. They are still visible to anyone with access to this browser profile and are not server-side secrets.","Twelve Data remains stored locally for this prototype. LTA and Gemini keys are stored server-side in Supabase and are not exposed in the public GitHub repository.",1)

a.write_text(t,encoding='utf-8')
print('patched RunSGD v2.0.0')
