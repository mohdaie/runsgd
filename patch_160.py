from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('v1.5.4','v1.6.0')
p.write_text(s,encoding='utf-8')
print('fixed v1.6.0 badge')
