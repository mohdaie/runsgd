from pathlib import Path

files=[Path('index.html'),Path('admin/index.html')]
for p in files:
    s=p.read_text(encoding='utf-8')
    s=s.replace('runSGD v2.0.0','runSGD v2.0.1')
    s=s.replace('RunSGD v2.0.0','RunSGD v2.0.1')
    s=s.replace('>v2.0.0<','>v2.0.1<')
    s=s.replace('gemini-2.5-flash-lite','gemini-3.5-flash-lite')
    s=s.replace('Gemini 2.5 Flash-Lite','Gemini 3.5 Flash-Lite')
    p.write_text(s,encoding='utf-8')
print('patched RunSGD v2.0.1')
