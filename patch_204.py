from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Keep installed app name clean and move versioning into the UI only.
s=s.replace('<title>runSGD v2.0.3</title>','<title>RunSGD</title>')
s=s.replace('RunSGD Beta · v2.0.3','RunSGD Beta · v2.0.4').replace('>v2.0.3<','>v2.0.4<')

head_marker='<meta name="theme-color" content="#f8fbff">\n'
pwa_head='''<meta name="theme-color" content="#f8fbff">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="apple-mobile-web-app-title" content="RunSGD">\n<link rel="manifest" href="/runsgd/manifest.webmanifest">\n<link rel="icon" href="/runsgd/icon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/runsgd/icon.svg">\n'''
if '<link rel="manifest"' not in s:
    if head_marker not in s: raise SystemExit('theme marker not found')
    s=s.replace(head_marker,pwa_head,1)

register='''\nif('serviceWorker' in navigator){\n  window.addEventListener('load',()=>{\n    navigator.serviceWorker.register('/runsgd/sw.js',{scope:'/runsgd/'}).catch(e=>console.warn('RunSGD service worker',e));\n  });\n}\n'''
if "navigator.serviceWorker.register('/runsgd/sw.js'" not in s:
    s=s.replace('\n</script>\n</body>',register+'\n</script>\n</body>',1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v2.0.4 PWA install support')
