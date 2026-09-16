from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')
if 'v1.5.2' in s:
    print('v1.5.2 already applied')
    raise SystemExit(0)

s = s.replace('v1.5.1', 'v1.5.2')
pattern = r"function renderFeed\(type,items,label\)\{.*?\nfunction showExplore\(type,force=false\)\{"
replacement = r'''function feedTime(v){
 if(!v)return 0;let s=String(v).trim();
 if(/^\d{8}T\d{6}Z?$/.test(s))s=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T'+s.slice(9,11)+':'+s.slice(11,13)+':'+s.slice(13,15)+'Z';
 let t=Date.parse(s);return Number.isFinite(t)?t:0
}
function feedDate(v){let t=feedTime(v);return t?new Date(t).toLocaleString('en-SG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}
function renderFeed(type,items,label){let f=$('exploreFeed');items=[...items].sort((a,b)=>feedTime(b.date)-feedTime(a.date));live.feeds[type]=items;txt('feedStatus',label+' · newest first');if(items.length){f.innerHTML=items.map(a=>`<a class="feedcard" target="_blank" rel="noopener" href="${a.url}"><span class="feedtag">${type.toUpperCase()}</span><h3>${esc(a.title)}</h3><div class="feedmeta">${esc(a.source||'Web')}${feedDate(a.date)?' · '+esc(feedDate(a.date)):''}</div></a>`).join('');return}let searches={news:['Latest SG ↔ JB news','Singapore Johor Causeway latest news'],shopping:['Current SG/JB sales & promotions','Singapore Johor shopping sales today'],events:['Events happening this week','Singapore Johor events this week']};let x=searches[type];f.innerHTML=`<a class="feedcard" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(x[1])}"><span class="feedtag">CURRENT SEARCH</span><h3>${x[0]}</h3><div class="sub">Open fresh web results while the in-app feed is unavailable.</div></a>`}
function showExplore(type,force=false){'''
s2, n = re.subn(pattern, lambda m: replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Could not locate Explore render block')
p.write_text(s2, encoding='utf-8')
print('Applied RunSGD v1.5.2')
