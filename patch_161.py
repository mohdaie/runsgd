from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.1' in s:
    raise SystemExit('already patched')

s=s.replace('runSGD v1.6.0','runSGD v1.6.1').replace('RunSGD v1.6.0','RunSGD v1.6.1')

old='''  <div class="communityAuth">\n    <input id="memberName" placeholder="Display name">\n    <input id="memberEmail" type="email" placeholder="Email">\n    <input id="memberPassword" type="password" placeholder="Password (6+ characters)">\n    <div class="toolrow"><button class="miniBtn" onclick="communitySignUp(this)">Create account</button><button class="miniBtn" onclick="communitySignIn(this)">Sign in</button></div>\n    <div id="communityAuthStatus" class="status">You can still read community messages without signing in.</div>\n  </div>'''
new='''  <div class="communityAuth">\n    <button class="btn refresh" style="margin-top:0;background:#fff;color:#26334f;border:1px solid #e2e7f1" onclick="communityGoogle(this)">G&nbsp;&nbsp; Continue with Google</button>\n    <div class="status" style="text-align:center;margin:0">Fastest option · your Google name is used automatically.</div>\n    <div class="status" style="text-align:center;margin:0">If the same verified email already has a RunSGD account, Supabase links Google to that existing profile automatically.</div>\n    <div style="height:1px;background:#edf0f5;margin:4px 0"></div>\n    <div class="sub" style="font-weight:800">Or use email</div>\n    <input id="memberName" placeholder="Display name">\n    <input id="memberEmail" type="email" placeholder="Email">\n    <input id="memberPassword" type="password" placeholder="Password (6+ characters)">\n    <div class="toolrow"><button class="miniBtn" onclick="communitySignUp(this)">Create account</button><button class="miniBtn" onclick="communitySignIn(this)">Sign in</button></div>\n    <div id="communityAuthStatus" class="status">You can still read community messages without signing in.</div>\n  </div>'''
if old not in s:
    raise SystemExit('community auth block not found')
s=s.replace(old,new,1)

needle="async function communitySignUp(btn){"
if needle not in s:
    raise SystemExit('communitySignUp not found')
js="""async function communityGoogle(btn){\n  setBusy(btn,true);\n  txt('communityAuthStatus','Opening Google sign-in…');\n  let {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://mohdaie.github.io/runsgd/#community'}});\n  if(error){setBusy(btn,false);txt('communityAuthStatus',error.message)}\n}\nasync function communityProfileName(user){\n  if(!user)return 'Member';\n  try{let {data}=await sb.from('profiles').select('display_name').eq('id',user.id).maybeSingle();if(data?.display_name)return data.display_name}catch{}\n  let m=user.user_metadata||{},joined=[m.given_name,m.family_name].filter(Boolean).join(' ').trim();\n  return joined||m.full_name||m.name||m.display_name||user.email||'Member'\n}\nasync function communityLinkedStatus(user){\n  if(!user)return '';\n  try{let {data}=await sb.auth.getUserIdentities(),ids=data?.identities||[];return ids.some(x=>x.provider==='google')&&ids.length>1?' · Google linked':''}catch{return ''}\n}\n"""
s=s.replace(needle,js+needle,1)

old_state="function applyMemberState(){let signed=!!communityUser;$('communityAuthCard').style.display=signed?'none':'block';$('communityComposer').style.display=signed?'flex':'none';$('signOutBtn').style.display=signed?'inline-block':'none';$('communityGuestHint').style.display=signed?'none':'block';let name=communityUser?.user_metadata?.display_name||communityUser?.email||'Member';txt('memberState',signed?'Signed in as '+name:'Guest mode')}"
new_state="async function applyMemberState(){let signed=!!communityUser;$('communityAuthCard').style.display=signed?'none':'block';$('communityComposer').style.display=signed?'flex':'none';$('signOutBtn').style.display=signed?'inline-block':'none';$('communityGuestHint').style.display=signed?'none':'block';if(!signed){txt('memberState','Guest mode');return}let name=await communityProfileName(communityUser),linked=await communityLinkedStatus(communityUser);txt('memberState','Signed in as '+name+linked)}"
if old_state not in s:
    raise SystemExit('applyMemberState block not found')
s=s.replace(old_state,new_state,1)

p.write_text(s,encoding='utf-8')
print('patched v1.6.1')
