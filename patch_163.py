from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.3' in s:
    raise SystemExit('already patched')

s=s.replace('runSGD v1.6.2','runSGD v1.6.3').replace('RunSGD v1.6.2','RunSGD v1.6.3').replace('>v1.6.2<','>v1.6.3<')

# More: admin link is hidden until the signed-in profile role is confirmed as admin.
s=s.replace('<article class="card toolbox"><div class="title">⚙️ Admin settings</div><p class="sub">Manage API keys and test integrations from the temporary admin page.</p><a class="feedcard" style="margin-top:12px;text-align:center;font-weight:800;color:#4965c7" href="./admin/">Open Admin →</a></article>',
'''<article id="adminSettingsCard" class="card toolbox" style="display:none"><div class="title">⚙️ Admin settings</div><p class="sub">Admin-only settings and integrations.</p><a class="feedcard" style="margin-top:12px;text-align:center;font-weight:800;color:#4965c7" href="./admin/">Open Admin →</a></article>''')

# Friendlier stacked community chat styling.
old_css='.chatList{display:flex;flex-direction:column;gap:10px;max-height:55vh;overflow:auto;padding:4px 1px 10px}.chatMsg{background:#fff;border:1px solid #edf0f5;border-radius:18px;padding:12px}.chatMeta{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#8994a8;margin-bottom:5px}.chatName{font-weight:850;color:#46536d}.communityComposer{display:flex;flex-direction:column;gap:9px;margin-top:10px}'
new_css='.chatList{display:flex;flex-direction:column;gap:8px;height:min(58vh,520px);overflow:auto;padding:12px 8px 14px;background:linear-gradient(180deg,#f7f9fd,#f9f7ff);border:1px solid #edf0f6;border-radius:20px;scroll-behavior:smooth}.chatMsg{align-self:flex-start;max-width:86%;background:#fff;border:1px solid #e9edf4;border-radius:18px 18px 18px 6px;padding:9px 11px;box-shadow:0 4px 14px #46537d0b}.chatMsg.mine{align-self:flex-end;background:#eef4ff;border-color:#dce7ff;border-radius:18px 18px 6px 18px}.chatMeta{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10px;color:#8994a8;margin-bottom:4px}.chatName{font-weight:850;color:#46536d}.chatText{font-size:14px;line-height:1.42;overflow-wrap:anywhere}.moderateBtn{border:0;background:transparent;color:#a14a5b;font-size:10px;font-weight:850;padding:2px 3px;margin-left:5px}.communityComposer{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #edf0f5}'
if old_css not in s:
    raise SystemExit('chat css not found')
s=s.replace(old_css,new_css,1)

s=s.replace("let communityUser=null,communityRooms=[],activeRoom=null,chatChannel=null;","let communityUser=null,communityRooms=[],activeRoom=null,chatChannel=null,communityRole='member';",1)

needle="async function communityLinkedStatus(user){\n  if(!user)return '';\n  try{let {data}=await sb.auth.getUserIdentities(),ids=data?.identities||[];return ids.some(x=>x.provider==='google')&&ids.length>1?' · Google linked':''}catch{return ''}\n}\n"
insert=needle+"async function communityRoleOf(user){\n  if(!user)return 'member';\n  try{let {data}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();return data?.role||'member'}catch{return 'member'}\n}\n"
if needle not in s:
    raise SystemExit('linked status function not found')
s=s.replace(needle,insert,1)

old_state="async function applyMemberState(){let signed=!!communityUser;$('communityAuthCard').style.display=signed?'none':'block';$('communityComposer').style.display=signed?'flex':'none';$('signOutBtn').style.display=signed?'inline-block':'none';$('communityGuestHint').style.display=signed?'none':'block';if(!signed){txt('memberState','Guest mode');return}let name=await communityProfileName(communityUser),linked=await communityLinkedStatus(communityUser);txt('memberState','Signed in as '+name+linked)}"
new_state="async function applyMemberState(){let signed=!!communityUser;$('communityAuthCard').style.display=signed?'none':'block';$('communityComposer').style.display=signed?'flex':'none';$('signOutBtn').style.display=signed?'inline-block':'none';$('communityGuestHint').style.display=signed?'none':'block';let adminCard=$('adminSettingsCard');if(!signed){communityRole='member';if(adminCard)adminCard.style.display='none';txt('memberState','Guest mode');return}let name=await communityProfileName(communityUser),linked=await communityLinkedStatus(communityUser);communityRole=await communityRoleOf(communityUser);if(adminCard)adminCard.style.display=communityRole==='admin'?'block':'none';txt('memberState','Signed in as '+name+(communityRole==='admin'?' · Admin':'')+linked)}"
if old_state not in s:
    raise SystemExit('member state function not found')
s=s.replace(old_state,new_state,1)

old_render="function renderCommunityMessages(items){let el=$('chatList');if(!el)return;if(!items.length){el.innerHTML='<div class=\"sub\">No messages yet. Be the first commuter to say hello 👋</div>';return}el.innerHTML=items.map(m=>{let n=m.profiles?.display_name||'Commuter',d=new Date(m.created_at).toLocaleString('en-SG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});return `<div class=\"chatMsg\"><div class=\"chatMeta\"><span class=\"chatName\">${esc(n)}</span><span>${esc(d)}</span></div><div>${esc(m.message)}</div></div>`}).join('');el.scrollTop=el.scrollHeight}"
new_render="function renderCommunityMessages(items){let el=$('chatList');if(!el)return;if(!items.length){el.innerHTML='<div class=\"sub\" style=\"padding:12px\">No messages yet. Be the first commuter to say hello 👋</div>';return}el.innerHTML=items.map(m=>{let n=m.profiles?.display_name||'Commuter',d=new Date(m.created_at).toLocaleString('en-SG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),mine=m.user_id===communityUser?.id,remove=communityRole==='admin'?`<button class=\"moderateBtn\" onclick=\"deleteCommunityMessage(${Number(m.id)})\">Remove</button>`:'';return `<div class=\"chatMsg ${mine?'mine':''}\"><div class=\"chatMeta\"><span class=\"chatName\">${esc(n)}</span><span>${esc(d)}${remove}</span></div><div class=\"chatText\">${esc(m.message)}</div></div>`}).join('');el.scrollTop=el.scrollHeight}"
if old_render not in s:
    raise SystemExit('render messages function not found')
s=s.replace(old_render,new_render,1)

needle_send="async function sendCommunityMessage(btn){if(!communityUser)return txt('communityGuestHint','Please sign in before posting.');let message=$('chatMessage')?.value.trim();if(!message||!activeRoom)return;setBusy(btn,true);let {error}=await sb.from('community_messages').insert({room_id:activeRoom,user_id:communityUser.id,message});setBusy(btn,false);if(error){alert(error.message);return}$('chatMessage').value='';await loadCommunityMessages()}"
replacement=needle_send+"\nasync function deleteCommunityMessage(id){if(communityRole!=='admin')return;if(!confirm('Remove this community message?'))return;let {error}=await sb.from('community_messages').delete().eq('id',id);if(error){alert(error.message);return}await loadCommunityMessages()}"
if needle_send not in s:
    raise SystemExit('send message function not found')
s=s.replace(needle_send,replacement,1)

p.write_text(s,encoding='utf-8')

# Protect the direct /admin page too, not only the link.
a=Path('admin/index.html')
t=a.read_text(encoding='utf-8')
if 'id="adminGate"' not in t:
    t=t.replace('<main class="app">','''<div id="adminGate" class="app"><section class="hero"><h1>Admin access</h1><p id="gateText" class="sub">Checking your RunSGD account…</p><a class="back" href="../#community">← Back to Community</a></section></div>\n<main id="adminApp" class="app" style="display:none">''',1)
    t=t.replace('<script>','''<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n<script>\nconst ADMIN_SUPABASE_URL='https://gdycbluljgfezhgslppe.supabase.co';\nconst ADMIN_SUPABASE_KEY='sb_publishable_ke21EcVtLjGPLwX2T_-xng_CnhM6HBM';\nconst adminSb=window.supabase.createClient(ADMIN_SUPABASE_URL,ADMIN_SUPABASE_KEY);''',1)
    t=t.replace('load();\n</script>','''async function guardAdmin(){\n  try{\n    let {data:{session}}=await adminSb.auth.getSession();\n    if(!session){document.getElementById('gateText').textContent='Sign in with the RunSGD admin account first.';return}\n    let {data,error}=await adminSb.from('profiles').select('role,display_name').eq('id',session.user.id).maybeSingle();\n    if(error||data?.role!=='admin'){document.getElementById('gateText').textContent='This RunSGD account does not have admin access.';return}\n    document.getElementById('adminGate').style.display='none';\n    document.getElementById('adminApp').style.display='block';\n    load();\n  }catch(e){document.getElementById('gateText').textContent='Could not verify admin access.'}\n}\nguardAdmin();\n</script>''',1)
    a.write_text(t,encoding='utf-8')

print('patched v1.6.3')
