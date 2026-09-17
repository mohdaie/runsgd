from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'v2.1.2' not in s: raise SystemExit('v2.1.2 missing')
s=s.replace('v2.1.2','v2.1.3')
tag='<script src="/runsgd/cwbus.js?v=213"></script>'
if tag not in s:s=s.replace('</body>',tag+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('patched index v2.1.3')