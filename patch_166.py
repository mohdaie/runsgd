from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.6' in s: raise SystemExit('already patched')
s=s.replace('runSGD v1.6.5','runSGD v1.6.6').replace('RunSGD v1.6.5','RunSGD v1.6.6').replace('>v1.6.5<','>v1.6.6<')

css='''\n.profileView{display:block}.profileEdit{display:none}.profileSummary{display:flex;flex-direction:column;gap:8px}.profileBioLine{font-size:14px;line-height:1.5;color:#58647a;white-space:pre-wrap}.editProfileLink{border:0;background:transparent;color:#4965c7;font-weight:850;padding:7px 0;text-align:left;align-self:flex-start}.profileCard.editing .profileView{display:none}.profileCard.editing .profileEdit{display:flex}\n'''
s=s.replace('</style>',css+'</style>',1)

old='''<article id="profileCard" class="card toolbox profileCard">\n  <div class="profileTop">\n    <img id="profileAvatar" class="profileAvatar" alt="Profile photo">\n    <div><div class="title">My profile</div><div id="profileEmail" class="sub"></div><div id="profileBadge" class="badgeTag">NEWBIE</div></div>\n  </div>\n  <div class="profileFields">\n    <input id="profileName" maxlength="40" placeholder="Display name">\n    <textarea id="profileBio" maxlength="160" placeholder="Short bio about you"></textarea>\n    <label class="miniBtn" style="text-align:center;cursor:pointer">Change profile photo<input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="uploadProfilePhoto(this)"></label>\n    <button class="btn refresh" onclick="saveProfile(this)">Save profile</button>\n    <div id="profileStatus" class="status">Your tag is managed by RunSGD.</div>\n  </div>\n</article>'''
new='''<article id="profileCard" class="card toolbox profileCard">\n  <div class="profileTop">\n    <img id="profileAvatar" class="profileAvatar" alt="Profile photo">\n    <div><div class="title">My profile</div><div id="profileEmail" class="sub"></div><div id="profileBadge" class="badgeTag">NEWBIE</div></div>\n  </div>\n  <div class="profileView">\n    <div class="profileSummary">\n      <div id="profileViewName" class="title"></div>\n      <div id="profileViewBio" class="profileBioLine">Bio: —</div>\n      <button class="editProfileLink" onclick="toggleProfileEdit(true)">Edit profile →</button>\n    </div>\n  </div>\n  <div class="profileEdit profileFields">\n    <input id="profileName" maxlength="40" placeholder="Display name">\n    <textarea id="profileBio" maxlength="160" placeholder="Short bio about you"></textarea>\n    <label class="miniBtn" style="text-align:center;cursor:pointer">Change profile photo<input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="uploadProfilePhoto(this)"></label>\n    <div class="toolrow"><button class="miniBtn" onclick="toggleProfileEdit(false)">Cancel</button><button class="btn refresh" style="margin-top:0;flex:1" onclick="saveProfile(this)">Save profile</button></div>\n    <div id="profileStatus" class="status">Your tag is managed by RunSGD.</div>\n  </div>\n</article>'''
if old not in s: raise SystemExit('profile block not found')
s=s.replace(old,new,1)

old_apply="if(profileCard){profileCard.style.display='block';$('profileName').value=name||'';$('profileBio').value=communityProfile.bio||'';txt('profileEmail',communityUser.email||'');let tag=communityRole==='admin'?'admin':(communityProfile.badge||'newbie');$('profileBadge').textContent=tag;$('profileBadge').classList.toggle('admin',communityRole==='admin');let av=communityProfile.avatar_url||communityUser.user_metadata?.avatar_url||communityUser.user_metadata?.picture||'';$('profileAvatar').src=av||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22%3E%3Crect width=%2270%22 height=%2270%22 rx=%2222%22 fill=%22%23eef3ff%22/%3E%3Ctext x=%2235%22 y=%2243%22 text-anchor=%22middle%22 font-size=%2228%22%3E👤%3C/text%3E%3C/svg%3E'}"
new_apply="if(profileCard){profileCard.style.display='block';profileCard.classList.remove('editing');$('profileName').value=name||'';$('profileBio').value=communityProfile.bio||'';txt('profileEmail',communityUser.email||'');txt('profileViewName',name||'Member');txt('profileViewBio','Bio: '+(communityProfile.bio||'—'));let tag=communityRole==='admin'?'admin':(communityProfile.badge||'newbie');$('profileBadge').textContent=tag;$('profileBadge').classList.toggle('admin',communityRole==='admin');let av=communityProfile.avatar_url||communityUser.user_metadata?.avatar_url||communityUser.user_metadata?.picture||'';$('profileAvatar').src=av||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22%3E%3Crect width=%2270%22 height=%2270%22 rx=%2222%22 fill=%22%23eef3ff%22/%3E%3Ctext x=%2235%22 y=%2243%22 text-anchor=%22middle%22 font-size=%2228%22%3E👤%3C/text%3E%3C/svg%3E'}"
if old_apply not in s: raise SystemExit('apply profile block not found')
s=s.replace(old_apply,new_apply,1)

anchor="async function saveProfile(btn){if(!communityUser)return;"
if anchor not in s: raise SystemExit('saveProfile anchor not found')
s=s.replace(anchor,"function toggleProfileEdit(on){let c=$('profileCard');if(!c)return;c.classList.toggle('editing',!!on);if(on){$('profileName')?.focus();txt('profileStatus','Your tag is managed by RunSGD.')}}\n"+anchor,1)

old_save="txt('profileStatus','Profile saved.');await applyMemberState();if(activeRoom)await loadCommunityMessages()}"
new_save="txt('profileStatus','Profile saved.');await applyMemberState();toggleProfileEdit(false);if(activeRoom)await loadCommunityMessages()}"
if old_save not in s: raise SystemExit('save completion not found')
s=s.replace(old_save,new_save,1)

p.write_text(s,encoding='utf-8')
print('patched v1.6.6')
