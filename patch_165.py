from pathlib import Path

# Main app version bump only
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('runSGD v1.6.4','runSGD v1.6.5').replace('RunSGD v1.6.4','RunSGD v1.6.5').replace('>v1.6.4<','>v1.6.5<')
p.write_text(s,encoding='utf-8')

p=Path('admin/index.html')
s=p.read_text(encoding='utf-8')

css='''\n.adminProfile{display:flex;align-items:center;gap:13px;padding:14px;border-radius:18px;background:linear-gradient(120deg,#f3f8ff,#faf5ff);margin-bottom:16px}.adminAvatar{width:58px;height:58px;border-radius:18px;object-fit:cover;background:#eef3ff;border:1px solid #e2e7f1}.memberList{display:flex;flex-direction:column;gap:10px}.memberRow{display:flex;align-items:center;gap:11px;padding:11px;border:1px solid #edf0f5;border-radius:17px;background:#fff}.memberAvatar{width:45px;height:45px;border-radius:14px;object-fit:cover;background:#eef3ff;flex:0 0 auto}.memberInfo{min-width:0;flex:1}.memberName{font-weight:850;font-size:14px}.memberBio{font-size:11px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.memberTags{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.memberTag{font-size:9px;font-weight:900;text-transform:uppercase;padding:4px 7px;border-radius:99px;background:#eef3ff;color:#5067b4}.memberTag.admin{background:#fff0f2;color:#a33e53}.memberTag.paid{background:#fff7df;color:#8b6b16}\n'''
s=s.replace('</style>',css+'</style>',1)

hero='''<section class="hero"><h1>API & App Settings</h1><p class="sub">Configure provider keys for this browser. Settings are shared with the main RunSGD app because <b>/admin</b> uses the same site origin.</p></section>'''
hero_new='''<section class="hero"><h1>Admin</h1><p class="sub">Manage RunSGD settings and community membership.</p></section>\n<div id="adminProfileCard" class="adminProfile">\n  <img id="adminAvatar" class="adminAvatar" alt="Admin profile">\n  <div><div id="adminName" class="title">Admin</div><div id="adminEmail" class="sub"></div><div class="memberTags"><span class="memberTag admin">Admin</span></div></div>\n</div>'''
if hero not in s: raise SystemExit('hero not found')
s=s.replace(hero,hero_new,1)

anchor='''<article class="card" id="fxCard">'''
members='''<article class="card">\n <div class="head"><div class="title">👥 Community members</div><span id="memberCount" class="pill">0 members</span></div>\n <p class="sub">Profile photo and community tag shown exactly as members appear in RunSGD chat.</p>\n <div id="memberList" class="memberList"><div class="sub">Loading members…</div></div>\n</article>\n\n'''
if anchor not in s: raise SystemExit('card anchor not found')
s=s.replace(anchor,members+anchor,1)

old_guard="""    let {data,error}=await adminSb.from('profiles').select('role,display_name').eq('id',session.user.id).maybeSingle();\n    if(error||data?.role!=='admin'){document.getElementById('gateText').textContent='This RunSGD account does not have admin access.';return}\n    document.getElementById('adminGate').style.display='none';\n    document.getElementById('adminApp').style.display='block';\n    load();"""
new_guard="""    let {data,error}=await adminSb.from('profiles').select('role,display_name,avatar_url,badge,bio').eq('id',session.user.id).maybeSingle();\n    if(error||data?.role!=='admin'){document.getElementById('gateText').textContent='This RunSGD account does not have admin access.';return}\n    document.getElementById('adminGate').style.display='none';\n    document.getElementById('adminApp').style.display='block';\n    document.getElementById('adminName').textContent=data.display_name||'Admin';\n    document.getElementById('adminEmail').textContent=session.user.email||'';\n    let avatar=data.avatar_url||session.user.user_metadata?.avatar_url||session.user.user_metadata?.picture||'';\n    document.getElementById('adminAvatar').src=avatar||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2258%22 height=%2258%22%3E%3Crect width=%2258%22 height=%2258%22 rx=%2218%22 fill=%22%23eef3ff%22/%3E%3Ctext x=%2229%22 y=%2237%22 text-anchor=%22middle%22 font-size=%2224%22%3E👤%3C/text%3E%3C/svg%3E';\n    load();\n    await loadMembers();"""
if old_guard not in s: raise SystemExit('guard block not found')
s=s.replace(old_guard,new_guard,1)

insert='''function clearAll(){if(!confirm('Clear RunSGD API settings from this browser?'))return;localStorage.removeItem('runsgdTwelveDataKey');localStorage.removeItem('runsgdAdminConfig');load();$('twelveStatus').textContent='API settings cleared.';$('llmStatus').textContent='LLM settings cleared.'}\n'''
extra="""function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[m]))}\nfunction tagLabel(v){return ({newbie:'Newbie',pro:'Pro',oldtimer:'Oldtimer',paid:'Paid'})[v]||'Newbie'}\nasync function loadMembers(){\n  let el=document.getElementById('memberList');\n  try{\n    let {data,error}=await adminSb.from('profiles').select('id,display_name,avatar_url,bio,badge,role,created_at').order('created_at',{ascending:true});\n    if(error)throw error;\n    let rows=data||[];document.getElementById('memberCount').textContent=rows.length+' member'+(rows.length===1?'':'s');\n    if(!rows.length){el.innerHTML='<div class=\"sub\">No members yet.</div>';return}\n    el.innerHTML=rows.map(p=>{let tag=p.role==='admin'?'Admin':tagLabel(p.badge),av=p.avatar_url||'';return `<div class=\"memberRow\">${av?`<img class=\"memberAvatar\" src=\"${esc(av)}\" alt=\"\">`:`<div class=\"memberAvatar\" style=\"display:grid;place-items:center\">👤</div>`}<div class=\"memberInfo\"><div class=\"memberName\">${esc(p.display_name||'Commuter')}</div><div class=\"memberBio\">${esc(p.bio||'No bio yet')}</div><div class=\"memberTags\"><span class=\"memberTag ${p.role==='admin'?'admin':p.badge==='paid'?'paid':''}\">${esc(tag)}</span></div></div></div>`}).join('');\n  }catch(e){el.innerHTML='<div class=\"sub\">Could not load member profiles.</div>'}\n}\n"""
if insert not in s: raise SystemExit('insert anchor not found')
s=s.replace(insert,insert+extra,1)

p.write_text(s,encoding='utf-8')
print('patched v1.6.5')
