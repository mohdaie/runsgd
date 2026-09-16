from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')
if 'v1.5.3' in s:
    print('v1.5.3 already applied')
    raise SystemExit(0)

s = s.replace('v1.5.2', 'v1.5.3')

rate_block = r'''function loadTwelveKeyField(){let e=document.getElementById('twelveKey');if(e)e.value=localStorage.getItem('runsgdTwelveDataKey')||''}
function saveTwelveKey(btn){let e=document.getElementById('twelveKey'),v=(e?.value||'').trim();if(v)localStorage.setItem('runsgdTwelveDataKey',v);else localStorage.removeItem('runsgdTwelveDataKey');txt('twelveKeyStatus',v?'Saved on this device. Testing live SGD/MYR now…':'Key cleared. RunSGD will use fallback FX sources.');loadRate().finally(()=>txt('twelveKeyStatus',v?'Saved on this device. Twelve Data is now the primary FX source.':'Key cleared.'));}
async function loadRate(){
 txt('rateBadge','Loading');
 let tdKey=(localStorage.getItem('runsgdTwelveDataKey')||'').trim();
 if(tdKey){
   try{
     let j=await get('https://api.twelvedata.com/exchange_rate?symbol=SGD%2FMYR&apikey='+encodeURIComponent(tdKey),10000),v=Number(j.rate);
     if(v>2&&v<5){
       live.rate=v;save('rate',v);save('rateMeta',{source:'Twelve Data',timestamp:j.timestamp||Math.floor(Date.now()/1000)});
       txt('rate',v.toFixed(4));txt('rateBadge','Live');
       let stamp=j.timestamp?new Date(j.timestamp*1000):new Date();
       txt('rateStatus','Twelve Data · live market · '+stamp.toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'}));
       convert();updateBrief();return
     }
   }catch(e){console.warn('Twelve Data unavailable',e)}
 }
 let ps=[
   ['Fawaz currency API',async()=>Number((await get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sgd.json')).sgd?.myr)],
   ['ExchangeRate-API',async()=>Number((await get('https://open.er-api.com/v6/latest/SGD')).rates?.MYR)],
   ['Frankfurter',async()=>Number((await get('https://api.frankfurter.dev/v2/rate/sgd/myr')).rate)]
 ];
 for(let [name,fn] of ps)try{let v=await fn();if(v>2&&v<5){live.rate=v;save('rate',v);save('rateMeta',{source:name,timestamp:Math.floor(Date.now()/1000)});txt('rate',v.toFixed(4));txt('rateBadge',tdKey?'Fallback':'Live');txt('rateStatus',name+(tdKey?' · Twelve Data unavailable':' · reference rate')+' · '+new Date().toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'}));convert();updateBrief();return}}catch{}
 let v=old('rate'),meta=old('rateMeta');if(v){live.rate=+v;txt('rate',live.rate.toFixed(4));txt('rateBadge','Saved');txt('rateStatus','Saved '+(meta?.source||'reference')+' rate.');convert()}else{txt('rateBadge','Unavailable');txt('rateStatus',tdKey?'Twelve Data and fallback providers are currently unreachable.':'Add a Twelve Data API key in More, or retry later.')}updateBrief()
}
function convert(){'''
pattern = r"async function loadRate\(\)\{.*?\nfunction convert\(\)\{"
s, n = re.subn(pattern, lambda m: rate_block, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Could not locate loadRate block')

more_card = '''<article class="card toolbox"><div class="title">💱 Twelve Data FX</div><p class="sub">Primary live SGD/MYR source for this test build. The API key is stored only in this browser's local storage.</p><div class="toolrow"><input id="twelveKey" class="toolInput" type="password" placeholder="Twelve Data API key" autocomplete="off"><button class="miniBtn" onclick="saveTwelveKey(this)">Save & test</button></div><div id="twelveKeyStatus" class="status">If no key is saved, RunSGD uses the existing fallback FX providers.</div></article>'''
marker = '<section id="more" class="page">'
idx = s.find(marker)
if idx == -1:
    raise SystemExit('Could not locate More section')
end = s.find('</section>', idx)
if end == -1:
    raise SystemExit('Could not locate end of More section')
if 'id="twelveKey"' not in s[idx:end]:
    s = s[:end] + more_card + '\n' + s[end:]

s = s.replace('async function init(){greeting();restoreLocation();', 'async function init(){greeting();restoreLocation();loadTwelveKeyField();')

p.write_text(s, encoding='utf-8')
print('Applied RunSGD v1.5.3')
