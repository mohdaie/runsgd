from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.12' in s:
    raise SystemExit('already patched')
if 'runSGD v1.6.11' not in s:
    raise SystemExit('expected v1.6.11 not found')

s=s.replace('runSGD v1.6.11','runSGD v1.6.12').replace('RunSGD v1.6.11','RunSGD v1.6.12').replace('>v1.6.11<','>v1.6.12<')

css='''
/* v1.6.12: denser community thread so more messages fit in the same viewport */
#community .chatList{gap:7px;padding-top:10px;padding-bottom:11px}
#community .chatMsg,
#community .chatMsg.mine{padding:7px 10px;border-radius:17px}
#community .chatMeta{font-size:9px;margin-bottom:3px;gap:6px;line-height:1.2}
#community .chatAvatar{width:23px;height:23px}
#community .chatName{font-size:10px;max-width:110px}
#community .chatBadge{font-size:7px;padding:2px 5px}
#community .chatText{font-size:13px;line-height:1.34;font-weight:650}
#community .moderateBtn{font-size:8px;padding:3px 6px;margin-left:3px}
'''
s=s.replace('</style>',css+'\n</style>',1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v1.6.12')
