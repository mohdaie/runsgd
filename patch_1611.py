from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.11' in s:
    raise SystemExit('already patched')
if 'runSGD v1.6.10' not in s:
    raise SystemExit('expected v1.6.10 not found')

s=s.replace('runSGD v1.6.10','runSGD v1.6.11').replace('RunSGD v1.6.10','RunSGD v1.6.11').replace('>v1.6.10<','>v1.6.11<')

css='''
/* v1.6.11: brighter, higher-contrast community message bubbles */
#community .chatMsg,
#community .chatMsg.mine{
  background:#fff;
  color:#1f2a44;
  border:1px solid #e5e7ef;
  box-shadow:0 8px 20px rgba(65,72,120,.08);
}
#community .chatMsg{
  border-left:3px solid #ff5f8f;
}
#community .chatMsg.mine{
  border-left:1px solid #e5e7ef;
  border-right:3px solid #756cf2;
}
#community .chatText{
  color:#1d2942;
  font-weight:650;
}
#community .chatMeta{
  color:#8d94a6;
}
#community .chatName{
  color:#2b3855;
}
'''
s=s.replace('</style>',css+'\n</style>',1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v1.6.11')
