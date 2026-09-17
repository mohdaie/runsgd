from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.10' in s:
    raise SystemExit('already patched')
if 'runSGD v1.6.9' not in s:
    raise SystemExit('expected v1.6.9 not found')

s=s.replace('runSGD v1.6.9','runSGD v1.6.10').replace('RunSGD v1.6.9','RunSGD v1.6.10').replace('>v1.6.9<','>v1.6.10<')

# Community-only friendly font.
if 'fonts.googleapis.com/css2?family=Nunito+Sans' not in s:
    s=s.replace('<style>','<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@500;600;700;800;900&display=swap" rel="stylesheet">\n<style>',1)

css='''
/* Community refresh — lively social inbox, same chat viewport size */
#community,#community button,#community textarea,#community input{font-family:"Nunito Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
#communityChatCard{background:linear-gradient(145deg,#ffffff 0%,#fffafd 52%,#f8f7ff 100%);border:1px solid #fff;box-shadow:0 16px 38px rgba(77,74,128,.10)}
.communityTitleLine{display:flex;align-items:center;gap:8px}
.communityLiveDot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#25d67f,#56e6ad);box-shadow:0 0 0 5px rgba(52,211,153,.12);flex:0 0 auto}
#memberState{font-size:12px;line-height:1.35;color:#7a8092;margin-top:2px}
#signOutBtn{border-radius:16px;background:linear-gradient(135deg,#f2f5ff,#f8f1ff);color:#43547a;padding:9px 12px;font-size:12px;white-space:nowrap;box-shadow:none}
.communityRooms{gap:9px;padding:5px 1px 13px;scrollbar-width:none}.communityRooms::-webkit-scrollbar{display:none}
.roomBtn{border:1px solid #e6e4ef;background:rgba(255,255,255,.94);color:#616b81;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:900;box-shadow:0 4px 12px rgba(65,72,120,.05)}
.roomBtn.active{color:#fff;border-color:transparent;background:linear-gradient(120deg,#4b82f5 0%,#786bf1 48%,#ed77a9 100%);box-shadow:0 9px 22px rgba(110,93,225,.25)}
.chatList{height:min(58vh,520px);background:radial-gradient(circle at 95% 3%,rgba(235,122,171,.09),transparent 24%),radial-gradient(circle at 5% 98%,rgba(75,130,245,.10),transparent 28%),linear-gradient(180deg,#fbfcff 0%,#f8f6ff 55%,#fff9fc 100%);border:1px solid #ebe8f4;border-radius:22px;padding:13px 9px 15px;gap:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.9);scroll-behavior:smooth}
.chatMsg{max-width:86%;background:rgba(255,255,255,.96);border:1px solid rgba(229,226,239,.95);border-radius:20px 20px 20px 7px;padding:10px 12px;box-shadow:0 7px 18px rgba(65,72,120,.075);animation:chatPop .18s ease-out}
.chatMsg.mine{background:linear-gradient(145deg,#edf4ff 0%,#f2efff 55%,#fff3f8 100%);border-color:#dce3ff;border-radius:20px 20px 7px 20px;box-shadow:0 8px 20px rgba(106,97,214,.10)}
@keyframes chatPop{from{opacity:.4;transform:translateY(3px)}to{opacity:1;transform:none}}
.chatMeta{font-size:10px;color:#9499aa;margin-bottom:5px;gap:8px}
.chatIdentity{gap:6px;min-width:0}.chatAvatar{width:27px;height:27px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 7px rgba(58,68,105,.12)}
.chatName{font-size:11px;font-weight:900;color:#33405c;max-width:125px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chatBadge{font-size:8px;padding:3px 6px;background:#edf3ff;color:#536bc0;letter-spacing:.2px}.chatBadge.admin{background:linear-gradient(120deg,#ffecef,#fff2f8);color:#b63d60}
.chatText{font-size:15px;line-height:1.46;color:#202a40;font-weight:600;letter-spacing:.02px}
.moderateBtn{border:0;background:#fff0f4;color:#b64361;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;margin-left:5px}
.communityComposer{gap:9px;margin-top:11px;padding-top:11px;border-top:1px solid #ece9f3}
.quickChatChips{display:flex;gap:7px;overflow-x:auto;padding:1px 1px 3px;scrollbar-width:none}.quickChatChips::-webkit-scrollbar{display:none}
.quickChatChip{flex:0 0 auto;border:1px solid #e6e3ef;background:#fff;color:#58657f;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:900;box-shadow:0 4px 11px rgba(65,72,120,.05)}
.quickChatChip:active{background:#f5f1ff}
.composerShell{display:flex;align-items:flex-end;gap:8px;padding:8px 9px 8px 12px;border:1px solid #e5e1ef;border-radius:20px;background:linear-gradient(180deg,#fff,#fdfaff);box-shadow:0 7px 18px rgba(70,76,120,.06);transition:border-color .16s ease,box-shadow .16s ease}
.composerShell:focus-within{border-color:#a897f0;box-shadow:0 0 0 4px rgba(139,103,239,.10),0 8px 20px rgba(70,76,120,.07)}
.communityComposer textarea{min-height:58px;max-height:130px;resize:vertical;border:0!important;background:transparent!important;border-radius:0!important;padding:7px 2px!important;font-size:14px;line-height:1.45;color:#26324b;box-shadow:none!important;outline:none}
.communityComposer textarea::placeholder{color:#9a9fb0}
.communitySendBtn{flex:0 0 auto;width:44px;height:44px;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#4b82f5,#796af0 52%,#ed78aa);box-shadow:0 8px 19px rgba(114,95,229,.30);font-size:18px;font-weight:900;padding:0;margin:0}
.communitySendBtn.busy::after{margin:0;width:14px;height:14px}
.communityHint{font-size:10px;color:#9ba1b1;padding:0 3px}
'''
s=s.replace('</style>',css+'\n</style>',1)

old_header='''  <div class="memberBar"><div><div class="title">💬 Live community</div><div id="memberState" class="sub">Guest mode</div></div><button id="signOutBtn" class="miniBtn" onclick="communitySignOut()" style="display:none">Sign out</button></div>'''
new_header='''  <div class="memberBar"><div><div class="communityTitleLine"><span class="communityLiveDot"></span><div class="title">💬 Live community</div></div><div id="memberState" class="sub">Guest mode</div></div><button id="signOutBtn" class="miniBtn" onclick="communitySignOut()" style="display:none">Sign out</button></div>'''
if old_header not in s: raise SystemExit('community header anchor missing')
s=s.replace(old_header,new_header,1)

old_comp='''  <div id="communityComposer" class="communityComposer" style="display:none">\n    <textarea id="chatMessage" maxlength="500" placeholder="Share a quick update with commuters…"></textarea>\n    <button class="btn refresh" onclick="sendCommunityMessage(this)">Send message</button>\n  </div>'''
new_comp='''  <div id="communityComposer" class="communityComposer" style="display:none">\n    <div class="quickChatChips" aria-label="Quick update starters">\n      <button class="quickChatChip" onclick="quickChat('🚦 Heavy traffic — ')">🚦 Jam</button>\n      <button class="quickChatChip" onclick="quickChat('✅ Traffic moving smoothly — ')">✅ Smooth</button>\n      <button class="quickChatChip" onclick="quickChat('🌧 Heavy rain around ')">🌧 Rain</button>\n      <button class="quickChatChip" onclick="quickChat('🚌 Bus delay — ')">🚌 Delay</button>\n      <button class="quickChatChip" onclick="quickChat('📍 Checkpoint update — ')">📍 Checkpoint</button>\n    </div>\n    <div class="composerShell">\n      <textarea id="chatMessage" maxlength="500" placeholder="Share what’s happening…"></textarea>\n      <button class="communitySendBtn" onclick="sendCommunityMessage(this)" aria-label="Send message">➤</button>\n    </div>\n    <div class="communityHint">Useful updates help everyone cross smarter ✨</div>\n  </div>'''
if old_comp not in s: raise SystemExit('composer anchor missing')
s=s.replace(old_comp,new_comp,1)

# Add friendly icons to room buttons without changing database room names.
old_rooms="function renderCommunityRooms(){let el=$('communityRooms');if(!el)return;el.innerHTML=communityRooms.map(r=>`<button class=\"roomBtn ${r.id===activeRoom?'active':''}\" onclick=\"selectCommunityRoom('${r.id}')\">${esc(r.name)}</button>`).join('')}"
new_rooms="function communityRoomIcon(r){let x=(r.slug||r.name||'').toLowerCase();return x.includes('causeway')?'🚦 ':x.includes('second')||x.includes('tuas')?'🔗 ':'💬 '}\nfunction renderCommunityRooms(){let el=$('communityRooms');if(!el)return;el.innerHTML=communityRooms.map(r=>`<button class=\"roomBtn ${r.id===activeRoom?'active':''}\" onclick=\"selectCommunityRoom('${r.id}')\">${communityRoomIcon(r)}${esc(r.name)}</button>`).join('')}"
if old_rooms not in s: raise SystemExit('render rooms anchor missing')
s=s.replace(old_rooms,new_rooms,1)

# Quick-chip helper: insert starter text, never auto-post.
send_anchor='async function sendCommunityMessage(btn){'
if send_anchor not in s: raise SystemExit('send function anchor missing')
quick_js="""function quickChat(starter){let e=$('chatMessage');if(!e)return;let current=e.value.trim();e.value=current?current+' '+starter:starter;e.focus();e.setSelectionRange(e.value.length,e.value.length)}\n"""
s=s.replace(send_anchor,quick_js+send_anchor,1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v1.6.10')
