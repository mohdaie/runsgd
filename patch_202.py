from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('runSGD v2.0.1','runSGD v2.0.2').replace('RunSGD v2.0.1','RunSGD v2.0.2').replace('>v2.0.1<','>v2.0.2<')

old_home='''<article class="card">
  <div class="head"><div class="title">✦ What should I do?</div><span id="briefStatus" class="tag">Starting</span></div>
  <div class="soft"><div id="brief" class="briefAction">Checking your latest signals…</div><div id="briefWhy" class="sub briefWhy">Looking at border, weather, holidays and your enabled signals.</div></div>
  <div id="briefExtra" class="actionline">RunSGD only recommends an action when a signal is actually useful.</div>
  <div class="aiBriefBar"><div id="aiBriefMeta" class="aiMeta">Deterministic fallback · AI uses RunSGD data only</div><button id="aiBriefBtn" class="aiMiniBtn" onclick="loadAiBrief(true,this)">✨ AI insight</button></div>
</article>
'''
new_home='''<article class="card">
  <div class="head"><div class="title">✦ What should I do?</div><span id="briefStatus" class="tag">Ready</span></div>
  <div class="sub">One tap checks the useful parts of RunSGD — traffic, weather, recent community activity and only the widgets you keep enabled.</div>
  <button id="aiBriefBtn" class="btn refresh" onclick="loadAiBrief(true,this)">✨ Check my journey</button>
  <div class="soft" style="margin-top:12px"><div id="brief" class="briefAction">Tap “Check my journey” for a current recommendation.</div><div id="briefWhy" class="sub briefWhy">RunSGD will only surface something when it can actually help your next move.</div></div>
  <div id="briefExtra" class="actionline">If conditions look normal, RunSGD will simply tell you that you are good to go.</div>
  <div id="aiBriefMeta" class="aiMeta" style="margin-top:9px">Gemini 3.5 Flash-Lite · RunSGD app data only</div>
</article>
'''
if old_home not in s:
    raise SystemExit('home brief block not found')
s=s.replace(old_home,new_home,1)

m=re.search(r'\n(<article class="card aiCard">.*?</article>)\n\n(<div class="homeCustomizeBar">)',s,re.S)
if not m:
    raise SystemExit('Ask RunSGD card not found')
ask_card=m.group(1)
s=s[:m.start()]+'\n'+m.group(2)+s[m.end():]
explore_marker='<p class="sub">Quick commuter knowledge first. Live discovery when you need it.</p>\n'
if explore_marker not in s:
    raise SystemExit('explore marker not found')
s=s.replace(explore_marker,explore_marker+'\n'+ask_card+'\n',1)

s=s.replace("live.traffic={camera_id:j.camera_id,name:j.name||'LTA traffic camera',captured_at:j.captured_at||j.fetched_at||null};",
            "live.traffic={camera_id:j.camera_id,name:j.name||'LTA traffic camera',captured_at:j.captured_at||j.fetched_at||null,fetched_at:j.fetched_at||null,image_url:j.image_url};",1)

ctx_old=""" let p=getHomeWidgetPrefs(),enabled=p.order.filter(x=>!p.hidden.includes(x)),c={
   time:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit'}),
   location:live.location?.name||'Not provided',enabled_widgets:enabled
 };"""
ctx_new=""" let p=getHomeWidgetPrefs(),enabled=p.order.filter(x=>!p.hidden.includes(x)),c={
   time:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit'}),
   location:live.location?.name||'Not provided',
   likely_direction:live.location?.name==='Johor area'?'JB → SG':live.location?.name==='Singapore area'?'SG → JB':'Unknown',
   enabled_widgets:enabled
 };"""
if ctx_old not in s:
    raise SystemExit('aiContext header not found')
s=s.replace(ctx_old,ctx_new,1)

new_update='''function updateBrief(fallback=false){
 if(!fallback){
   txt('brief','Tap “Check my journey” for a current recommendation.');
   txt('briefWhy','RunSGD will analyse traffic, weather, community and only your enabled widgets.');
   txt('briefExtra','No background AI calls — you decide when to check.');
   txt('briefStatus','Ready');
   return
 }
 let r=Math.max(live.weather.SG?.rain||0,live.weather.JB?.rain||0),h=new Date().getHours(),action='You’re good to go.',why='No strong RunSGD signal suggests changing your plan right now.',extra='Check the latest Causeway snapshot before crossing.';
 if(r>=75){action=h<15?'Allow about 15 minutes extra.':'Give your trip a little extra buffer.';why=`Rain chance is up to ${r}% around SG/JB in the next few hours.`;extra='Weather is the clearest useful signal right now.'}
 else if(homeWidgetEnabled('prayer')&&live.prayer?.mins!=null&&live.prayer.mins<=45){action=`Plan around ${live.prayer.label}.`;why=`It is about ${live.prayer.mins} minutes away at ${live.prayer.time}.`;extra=live.nearby[0]?`Nearest mapped prayer place: ${live.nearby[0].name}.`:'Use location to find a nearby prayer place.'}
 else if(live.holidays[0]){let d=new Date(live.holidays[0].date+'T00:00:00'),t=new Date();t.setHours(0,0,0,0);let days=Math.round((d-t)/86400000);if(days>=0&&days<=2){action='Add a little extra travel margin.';why=`${live.holidays[0].name} is ${days===0?'today':days===1?'tomorrow':'in '+days+' days'}.`;extra='Crowd and operating patterns may be less predictable.'}}
 txt('brief',action);txt('briefWhy',why);txt('briefExtra',extra);txt('briefStatus','Fallback')
}
'''
s,n=re.subn(r'function updateBrief\(\)\{.*?\n\}\n(?=async function refreshAll)',new_update,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit('updateBrief function not replaced')

old_catch="catch(e){txt('aiBriefMeta',e.message||'AI unavailable · deterministic recommendation kept');updateBrief()}"
new_catch="catch(e){txt('aiBriefMeta',e.message||'AI unavailable · using simple fallback');updateBrief(true)}"
if old_catch not in s:
    raise SystemExit('AI brief catch not found')
s=s.replace(old_catch,new_catch,1)

s=s.replace("await initCommunity();await refreshAll();if(communityUser)loadAiBrief();if(live.location){loadNearbyPrayer();loadAir()}",
            "await initCommunity();await refreshAll();if(live.location){loadNearbyPrayer();loadAir()}",1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v2.0.2')
