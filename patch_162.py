from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

if 'runSGD v1.6.2' in s:
    raise SystemExit('already patched')

s=s.replace('runSGD v1.6.1','runSGD v1.6.2').replace('RunSGD v1.6.1','RunSGD v1.6.2').replace('>v1.6.1<','>v1.6.2<')

# Cleaner auth UI: Google first, email form hidden until requested.
old='''  <div class="title">👤 Join RunSGD</div>\n  <p class="sub">Create a simple member account with email and password.</p>\n  <div class="communityAuth">\n    <button class="btn refresh" style="margin-top:0;background:#fff;color:#26334f;border:1px solid #e2e7f1" onclick="communityGoogle(this)">G&nbsp;&nbsp; Continue with Google</button>\n    <div class="status" style="text-align:center;margin:0">Fastest option · your Google name is used automatically.</div>\n    <div class="status" style="text-align:center;margin:0">If the same verified email already has a RunSGD account, Supabase links Google to that existing profile automatically.</div>\n    <div style="height:1px;background:#edf0f5;margin:4px 0"></div>\n    <div class="sub" style="font-weight:800">Or use email</div>\n    <input id="memberName" placeholder="Display name">\n    <input id="memberEmail" type="email" placeholder="Email">\n    <input id="memberPassword" type="password" placeholder="Password (6+ characters)">\n    <div class="toolrow"><button class="miniBtn" onclick="communitySignUp(this)">Create account</button><button class="miniBtn" onclick="communitySignIn(this)">Sign in</button></div>\n    <div id="communityAuthStatus" class="status">You can still read community messages without signing in.</div>\n  </div>'''
new='''  <div class="title">👤 Join RunSGD</div>\n  <p class="sub">Join the commuter community in one tap.</p>\n  <div class="communityAuth">\n    <button class="googleBtn" onclick="communityGoogle(this)"><span class="googleMark">G</span><span>Continue with Google</span></button>\n    <div class="status authNote">Your Google name is used automatically. You can change it later.</div>\n    <button id="emailToggle" class="emailLink" onclick="toggleEmailAuth()">Use email instead</button>\n    <div id="emailAuthForm" class="emailAuthForm" style="display:none">\n      <input id="memberName" placeholder="Display name">\n      <input id="memberEmail" type="email" placeholder="Email">\n      <input id="memberPassword" type="password" placeholder="Password (6+ characters)">\n      <div class="toolrow"><button class="miniBtn" onclick="communitySignUp(this)">Create account</button><button class="miniBtn" onclick="communitySignIn(this)">Sign in</button></div>\n    </div>\n    <div id="communityAuthStatus" class="status">You can read community messages without signing in.</div>\n  </div>'''
if old not in s:
    raise SystemExit('auth block not found')
s=s.replace(old,new,1)

css='''.googleBtn{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid #dde3ed;background:#fff;color:#24314c;border-radius:18px;padding:14px 16px;font-weight:850;font-size:16px;box-shadow:0 7px 18px #37486d0b}.googleMark{font-size:20px;font-weight:900;color:#4285f4}.authNote{text-align:center;margin:0 8px}.emailLink{align-self:center;border:0;background:transparent;color:#4965c7;font-weight:850;padding:8px 10px}.emailAuthForm{display:flex;flex-direction:column;gap:10px;padding-top:5px;border-top:1px solid #edf0f5}.emailAuthForm .toolrow{margin-top:2px}.communityAuth{gap:12px}\n'''
s=s.replace('\n</style>', '\n'+css+'</style>',1)

# Google OAuth redirect must not contain a hash: Supabase implicit auth uses the fragment for tokens.
old_google="""async function communityGoogle(btn){\n  setBusy(btn,true);\n  txt('communityAuthStatus','Opening Google sign-in…');\n  let {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://mohdaie.github.io/runsgd/#community'}});\n  if(error){setBusy(btn,false);txt('communityAuthStatus',error.message)}\n}\n"""
new_google="""async function communityGoogle(btn){\n  setBusy(btn,true);\n  txt('communityAuthStatus','Opening Google sign-in…');\n  localStorage.setItem('runsgdAuthReturn','community');\n  let {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://mohdaie.github.io/runsgd/?auth=google'}});\n  if(error){setBusy(btn,false);txt('communityAuthStatus',error.message)}\n}\nfunction toggleEmailAuth(){\n  let f=$('emailAuthForm'),b=$('emailToggle');\n  if(!f||!b)return;\n  let open=f.style.display!=='none';\n  f.style.display=open?'none':'flex';\n  b.textContent=open?'Use email instead':'Hide email sign in';\n}\n"""
if old_google not in s:
    raise SystemExit('google function not found')
s=s.replace(old_google,new_google,1)

old_init="""async function initCommunity(){\n  try{let {data:{session}}=await sb.auth.getSession();communityUser=session?.user||null;await loadCommunityRooms();applyMemberState();if(activeRoom)await loadCommunityMessages();sb.auth.onAuthStateChange(async(_e,session)=>{communityUser=session?.user||null;applyMemberState();if(activeRoom)await loadCommunityMessages()})}catch(e){txt('communityAuthStatus','Community connection unavailable.')}\n}\n"""
new_init="""async function initCommunity(){\n  try{\n    let {data:{session}}=await sb.auth.getSession();\n    communityUser=session?.user||null;\n    await loadCommunityRooms();\n    await applyMemberState();\n    if(activeRoom)await loadCommunityMessages();\n    let returned=new URLSearchParams(location.search).get('auth')==='google'||localStorage.getItem('runsgdAuthReturn')==='community';\n    if(communityUser&&returned){\n      localStorage.removeItem('runsgdAuthReturn');\n      history.replaceState(null,'',location.pathname+'#community');\n      showPage('community');\n      txt('communityAuthStatus','Signed in with Google.');\n    }\n    sb.auth.onAuthStateChange(async(event,session)=>{\n      communityUser=session?.user||null;\n      await applyMemberState();\n      if(activeRoom)await loadCommunityMessages();\n      if(event==='SIGNED_IN'&&communityUser&&localStorage.getItem('runsgdAuthReturn')==='community'){\n        localStorage.removeItem('runsgdAuthReturn');\n        history.replaceState(null,'',location.pathname+'#community');\n        showPage('community');\n      }\n    })\n  }catch(e){txt('communityAuthStatus','Community connection unavailable.')}\n}\n"""
if old_init not in s:
    raise SystemExit('initCommunity not found')
s=s.replace(old_init,new_init,1)

p.write_text(s,encoding='utf-8')
print('patched v1.6.2')
