from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'v1.5.4' in s:
    print('v1.5.4 already applied')
    raise SystemExit(0)

s=s.replace('v1.5.3','v1.5.4')

# Remove API key configuration from More.
s=re.sub(r'\n?<article class="card toolbox"><div class="title">💱 Twelve Data FX</div>.*?</article>', '', s, count=1, flags=re.S)

# Add temporary Admin link in More.
admin_card='''\n<article class="card toolbox"><div class="title">⚙️ Admin settings</div><p class="sub">Manage API keys and test integrations from the temporary admin page.</p><a class="feedcard" style="margin-top:12px;text-align:center;font-weight:800;color:#4965c7" href="./admin/">Open Admin →</a></article>'''
more_end=s.find('</section>',s.find('<section id="more" class="page">'))
if more_end==-1: raise SystemExit('More section not found')
s=s[:more_end]+admin_card+'\n'+s[more_end:]

# Add IPU card after Weather card.
weather_marker='''<article class="card">\n  <div class="head"><div class="title">🌦 Weather</div><span id="weatherBadge" class="tag">Loading</span></div>'''
wm=s.find(weather_marker)
if wm==-1: raise SystemExit('Weather card not found')
weather_end=s.find('</article>',wm)+len('</article>')
ipu_card='''\n\n<article class="card">\n  <div class="head"><div class="title">🌫 IPU / Air Quality</div><span id="ipuBadge" class="tag">Location</span></div>\n  <div id="ipuValue" class="big">—</div><div id="ipuLevel" class="sub">Enable location to estimate air quality at your current area.</div>\n  <div id="ipuMeta" class="status">Uses a 24-hour PM2.5 estimate and Malaysia DOE IPU breakpoints.</div>\n</article>'''
s=s[:weather_end]+ipu_card+s[weather_end:]

# Extend live state.
s=s.replace("const live={rate:null,weather:{},prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};",
            "const live={rate:null,weather:{},air:null,prayer:null,holidays:[],location:null,nearby:[],feeds:{news:[],shopping:[],events:[]}};")

# Request-location refresh now includes air quality.
s=s.replace("await Promise.allSettled([loadPrayer(),loadNearbyPrayer()]);",
            "await Promise.allSettled([loadPrayer(),loadNearbyPrayer(),loadAir()]);")

# Insert air quality helpers before prayer loader.
anchor='async function loadPrayer(){'
idx=s.find(anchor)
if idx==-1: raise SystemExit('Prayer loader not found')
air_js=r'''function pm25ToIpu(x){
 x=Number(x);if(!Number.isFinite(x)||x<0)return null;
 let bands=[[0,12.0,0,50],[12.1,75.5,51,100],[75.5,150.4,101,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]];
 if(x>500.4)return 500;
 for(let [cl,ch,il,ih] of bands){if(x>=cl&&x<=ch)return Math.round(((ih-il)/(ch-cl))*(x-cl)+il)}
 return null
}
function ipuLabel(v){return v<=50?'Baik / Good':v<=100?'Sederhana / Moderate':v<=200?'Tidak Sihat / Unhealthy':v<=300?'Sangat Tidak Sihat / Very Unhealthy':'Berbahaya / Hazardous'}
async function loadAir(){
 let p=live.location;if(!p){txt('ipuBadge','Location');txt('ipuValue','—');txt('ipuLevel','Enable location to estimate air quality at your current area.');txt('ipuMeta','Uses a 24-hour PM2.5 estimate and Malaysia DOE IPU breakpoints.');return}
 txt('ipuBadge','Loading');
 try{
   let j=await get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}&hourly=pm2_5&past_days=1&forecast_days=1&timezone=Asia%2FSingapore`,12000),times=j.hourly?.time||[],vals=j.hourly?.pm2_5||[],now=Date.now(),a=[];
   for(let i=0;i<times.length;i++){let t=Date.parse(times[i]);let v=Number(vals[i]);if(Number.isFinite(t)&&t<=now&&Number.isFinite(v))a.push({t,v})}
   a=a.slice(-24);if(!a.length)throw Error('no pm25');let avg=a.reduce((n,x)=>n+x.v,0)/a.length,ipu=pm25ToIpu(avg);if(ipu==null)throw Error('bad ipu');
   live.air={ipu,pm25:avg,label:ipuLabel(ipu),location:p.name};save('air',live.air);
   txt('ipuValue',String(ipu));txt('ipuLevel',live.air.label);txt('ipuBadge',p.name);txt('ipuMeta',`Estimated from ${a.length}h PM2.5 avg ${avg.toFixed(1)} µg/m³ · Open-Meteo model`)
 }catch{let a=old('air');if(a){live.air=a;txt('ipuValue',String(a.ipu));txt('ipuLevel',a.label);txt('ipuBadge','Saved');txt('ipuMeta',`Saved estimate · PM2.5 ${Number(a.pm25).toFixed(1)} µg/m³`)}else{txt('ipuBadge','Unavailable');txt('ipuMeta','Air-quality service unavailable.')}}
 updateBrief()
}
'''
s=s[:idx]+air_js+s[idx:]

# Include air quality in refreshAll and initial restored-location load.
s=s.replace("await Promise.allSettled([loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve()]);",
            "await Promise.allSettled([loadRate(),loadWeather(),loadPrayer(),loadHolidays(),live.location?loadNearbyPrayer():Promise.resolve(),live.location?loadAir():Promise.resolve()]);")
s=s.replace("if(live.location)loadNearbyPrayer()}","if(live.location){loadNearbyPrayer();loadAir()}}")

p.write_text(s,encoding='utf-8')
print('Applied RunSGD v1.5.4')
