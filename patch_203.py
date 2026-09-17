from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('runSGD v2.0.2','runSGD v2.0.3').replace('RunSGD v2.0.2','RunSGD v2.0.3').replace('>v2.0.2<','>v2.0.3<')
s=s.replace('<article class="card"><div class="title">RunSGD v2.0.3</div><p class="sub">Your last approved location, current page and Explore tab are stored in this browser.</p><button class="btn refresh" onclick="refreshAll(this)">↻ Refresh live data</button></article>',
'''<article class="card"><div class="head"><div class="title">RunSGD Beta · v2.0.3</div><span class="tag">Closed beta</span></div><p class="sub">Your last approved location, current page and Explore tab are stored in this browser.</p><button class="btn refresh" onclick="refreshAll(this)">↻ Refresh live data</button></article>''')

marker='''<article id="adminSettingsCard" class="card toolbox" style="display:none"><div class="title">⚙️ Admin settings</div><p class="sub">Admin-only settings and integrations.</p><a class="feedcard" style="margin-top:12px;text-align:center;font-weight:800;color:#4965c7" href="./admin/">Open Admin →</a></article>'''
insert='''<article id="betaFeedbackCard" class="card toolbox">
  <div class="head"><div class="title">🧪 Beta feedback</div><span class="tag">v2.0.3</span></div>
  <p class="sub">Found something confusing, broken or useful? Send a short note directly to RunSGD.</p>
  <div class="toolrow"><select id="betaFeedbackCategory" class="toolInput"><option value="feedback">Feedback</option><option value="bug">Bug</option><option value="idea">Idea</option></select></div>
  <textarea id="betaFeedbackMessage" class="toolInput" maxlength="2000" style="width:100%;min-height:90px;margin-top:9px;resize:vertical" placeholder="Tell us what happened or what would make RunSGD better…"></textarea>
  <button class="btn refresh" onclick="submitBetaFeedback(this)">Send feedback</button>
  <div id="betaFeedbackStatus" class="status">Sign in to submit feedback.</div>
</article>
<article class="card toolbox"><div class="title">🔒 Privacy & beta notice</div><p class="sub">See what RunSGD stores, how location and AI are used, and beta limitations.</p><a class="feedcard" style="margin-top:12px;text-align:center;font-weight:800;color:#4965c7" href="./privacy.html">Read notice →</a></article>

'''+marker
if marker not in s:
    raise SystemExit('admin card marker not found')
s=s.replace(marker,insert,1)

js_marker="let communityUser=null,communityRooms=[],activeRoom=null,chatChannel=null,communityRole='member',communityProfile=null;\n"
js_add=js_marker+'''async function submitBetaFeedback(btn){
  let msg=$('betaFeedbackMessage')?.value.trim(),category=$('betaFeedbackCategory')?.value||'feedback';
  if(!msg)return txt('betaFeedbackStatus','Write a short note first.');
  let {data:{session}}=await sb.auth.getSession();
  if(!session)return txt('betaFeedbackStatus','Sign in from Community first, then come back here to submit.');
  setBusy(btn,true);txt('betaFeedbackStatus','Sending…');
  try{
    let {error}=await sb.from('beta_feedback').insert({user_id:session.user.id,category,message:msg});
    if(error)throw error;
    $('betaFeedbackMessage').value='';
    txt('betaFeedbackStatus','✓ Thanks — feedback received.');
  }catch(e){txt('betaFeedbackStatus','Could not send · '+(e.message||'try again later'))}
  finally{setBusy(btn,false)}
}
'''
if js_marker not in s:
    raise SystemExit('community variable marker not found')
s=s.replace(js_marker,js_add,1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v2.0.3 beta hardening UI')
