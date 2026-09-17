from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('v1.6.0','v1.6.1')
p.write_text(s,encoding='utf-8')
print('fixed v1.6.1 badge')
