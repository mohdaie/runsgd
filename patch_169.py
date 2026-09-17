from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'runSGD v1.6.9' in s:
    raise SystemExit('already patched')
if 'runSGD v1.6.8' not in s:
    raise SystemExit('expected v1.6.8 not found')

s=s.replace('runSGD v1.6.8','runSGD v1.6.9').replace('RunSGD v1.6.8','RunSGD v1.6.9').replace('>v1.6.8<','>v1.6.9<')

css='''
/* Explore tabs: never clip labels */
.tabs{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
.chip{flex:0 0 auto;width:max-content;min-width:max-content;max-width:none;white-space:nowrap;font-size:14px;padding:10px 15px;line-height:1.15}

/* Home widget customization */
.homeCustomizeBar{display:flex;justify-content:flex-end;margin-top:-7px}
.homeCustomizeBtn{border:0;background:transparent;color:#526bc1;font-size:12px;font-weight:850;padding:7px 4px}
.widgetManager{display:none;background:#fffffff0;border:1px solid #fff;border-radius:20px;padding:13px;box-shadow:0 8px 24px #46537d0d}
.widgetManager.open{display:block}
.widgetManagerTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
.widgetManagerList{display:flex;flex-direction:column;gap:7px;margin-top:9px}
.widgetManageRow{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #e8edf5;border-radius:14px;background:#fff}
.widgetManageName{flex:1;min-width:0;font-size:13px;font-weight:800;color:#41506c}
.widgetManageActions{display:flex;align-items:center;gap:5px}
.widgetIconBtn{border:0;background:#eef3fb;color:#4c5f82;border-radius:10px;min-width:32px;height:32px;padding:0 8px;font-weight:900}
.widgetIconBtn:disabled{opacity:.35}
.widgetToggle{border:0;border-radius:99px;padding:7px 10px;font-size:10px;font-weight:900;background:#edf7f0;color:#34704b}
.widgetToggle.off{background:#f1f2f5;color:#8993a5}
.homeWidgetStack{display:flex;flex-direction:column;gap:19px}
.homeWidget[hidden]{display:none!important}
'''
s=s.replace('</style>',css+'\n</style>',1)

# Update brief loading copy so it does not assume Prayer is relevant for everyone.
s=s.replace('Looking at weather, prayer, holidays and current context.','Looking at border, weather, holidays and your enabled signals.')

# Insert customize controls after the fixed What should I do card and start movable widget stack.
anchor='''  <div id="briefExtra" class="actionline">RunSGD only recommends an action when a signal is actually useful.</div>\n</article>\n\n<article class="card">\n  <div class="head"><div class="title">🚦 Causeway snapshot</div>'''
replacement='''  <div id="briefExtra" class="actionline">RunSGD only recommends an action when a signal is actually useful.</div>\n</article>\n\n<div class="homeCustomizeBar"><button id="homeCustomizeBtn" class="homeCustomizeBtn" onclick="toggleHomeWidgetManager()">⚙ Customize Home</button></div>\n<div id="homeWidgetManager" class="widgetManager">\n  <div class="widgetManagerTop"><div><div class="title">Arrange Home widgets</div><div class="sub">Move or hide anything you do not need.</div></div><button class="miniBtn" onclick="resetHomeWidgets()">Reset</button></div>\n  <div id="homeWidgetManagerList" class="widgetManagerList"></div>\n</div>\n\n<div id="homeWidgetStack" class="homeWidgetStack">\n<article class="card homeWidget" data-widget="traffic">\n  <div class="head"><div class="title">🚦 Causeway snapshot</div>'''
if anchor not in s:
    raise SystemExit('brief / traffic anchor not found')
s=s.replace(anchor,replacement,1)

repls={
'''<article class="card">\n  <div class="head"><div class="title">💱 SGD / MYR</div>''':'''<article class="card homeWidget" data-widget="currency">\n  <div class="head"><div class="title">💱 SGD / MYR</div>''',
'''<article class="card">\n  <div class="head"><div class="title">🌦 Weather</div>''':'''<article class="card homeWidget" data-widget="weather">\n  <div class="head"><div class="title">🌦 Weather</div>''',
'''<article class="card">\n  <div class="head"><div class="title">🌫 IPU / Air Quality</div>''':'''<article class="card homeWidget" data-widget="air">\n  <div class="head"><div class="title">🌫 IPU / Air Quality</div>''',
'''<article class="card">\n  <div class="head"><div class="title">🕌 Prayer</div>''':'''<article class="card homeWidget" data-widget="prayer">\n  <div class="head"><div class="title">🕌 Prayer</div>''',
'''<article class="card">\n  <div class="head"><div class="title">📅 Coming up</div>''':'''<article class="card homeWidget" data-widget="holidays">\n  <div class="head"><div class="title">📅 Coming up</div>'''
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit('widget anchor missing: '+old[:50])
    s=s.replace(old,new,1)

# Close movable widget stack before the fixed Home refresh button.
refresh='<button class="btn refresh" onclick="refreshAll(this)">↻ Refresh live data</button>'
pos=s.find(refresh)
if pos<0:
    raise SystemExit('home refresh button not found')
s=s[:pos]+'</div>\n'+s[pos:]

js='''
const HOME_WIDGETS=[
 {id:'traffic',label:'🚦 Causeway snapshot'},
 {id:'currency',label:'💱 SGD / MYR'},
 {id:'weather',label:'🌦 Weather'},
 {id:'air',label:'🌫 IPU / Air Quality'},
 {id:'prayer',label:'🕌 Prayer'},
 {id:'holidays',label:'📅 Coming up'}
];
function getHomeWidgetPrefs(){
 let d={order:HOME_WIDGETS.map(x=>x.id),hidden:[]};
 try{
   let p=JSON.parse(localStorage.getItem('runsgdHomeWidgets')||'null');
   if(p&&Array.isArray(p.order)&&Array.isArray(p.hidden)){
     let valid=HOME_WIDGETS.map(x=>x.id),order=p.order.filter(x=>valid.includes(x));
     valid.forEach(x=>{if(!order.includes(x))order.push(x)});
     d={order,hidden:p.hidden.filter(x=>valid.includes(x))}
   }
 }catch{}
 return d
}
function saveHomeWidgetPrefs(p){localStorage.setItem('runsgdHomeWidgets',JSON.stringify(p))}
function homeWidgetEnabled(id){return !getHomeWidgetPrefs().hidden.includes(id)}
function applyHomeWidgets(){
 let box=$('homeWidgetStack');if(!box)return;
 let p=getHomeWidgetPrefs();
 p.order.forEach(id=>{let el=box.querySelector('[data-widget="'+id+'"]');if(el){el.hidden=p.hidden.includes(id);box.appendChild(el)}});
 renderHomeWidgetManager()
}
function renderHomeWidgetManager(){
 let list=$('homeWidgetManagerList');if(!list)return;
 let p=getHomeWidgetPrefs();
 list.innerHTML=p.order.map((id,i)=>{
   let w=HOME_WIDGETS.find(x=>x.id===id),off=p.hidden.includes(id);
   return `<div class="widgetManageRow"><div class="widgetManageName">${w?.label||id}</div><div class="widgetManageActions"><button class="widgetIconBtn" ${i===0?'disabled':''} onclick="moveHomeWidget('${id}',-1)" aria-label="Move up">↑</button><button class="widgetIconBtn" ${i===p.order.length-1?'disabled':''} onclick="moveHomeWidget('${id}',1)" aria-label="Move down">↓</button><button class="widgetToggle ${off?'off':''}" onclick="toggleHomeWidget('${id}')">${off?'Hidden':'Shown'}</button></div></div>`
 }).join('')
}
function toggleHomeWidgetManager(){
 let m=$('homeWidgetManager'),b=$('homeCustomizeBtn');if(!m)return;
 let open=!m.classList.contains('open');m.classList.toggle('open',open);if(b)b.textContent=open?'Done ✓':'⚙ Customize Home';if(open)renderHomeWidgetManager()
}
function moveHomeWidget(id,dir){
 let p=getHomeWidgetPrefs(),i=p.order.indexOf(id),j=i+dir;if(i<0||j<0||j>=p.order.length)return;
 [p.order[i],p.order[j]]=[p.order[j],p.order[i]];saveHomeWidgetPrefs(p);applyHomeWidgets()
}
function toggleHomeWidget(id){
 let p=getHomeWidgetPrefs(),i=p.hidden.indexOf(id);if(i>=0)p.hidden.splice(i,1);else p.hidden.push(id);
 saveHomeWidgetPrefs(p);applyHomeWidgets();updateBrief()
}
function resetHomeWidgets(){localStorage.removeItem('runsgdHomeWidgets');applyHomeWidgets();updateBrief()}
'''
anchor_js='function signalCards(){let c=[],r=Math.max(live.weather.SG?.rain||0,live.weather.JB?.rain||0);'
if anchor_js not in s:
    raise SystemExit('JS anchor not found')
s=s.replace(anchor_js,js+'\n'+anchor_js,1)

# If Prayer is hidden, it also stops influencing the fixed recommendation card.
s=s.replace("else if(live.prayer?.mins!=null&&live.prayer.mins<=45){","else if(homeWidgetEnabled('prayer')&&live.prayer?.mins!=null&&live.prayer.mins<=45){",1)

# Apply saved order/visibility during startup.
old_init='async function init(){greeting();restoreLocation();loadTwelveKeyField();let hash=location.hash.replace(\'#\',\'\'),saved=localStorage.getItem(\'runsgdPage\'),page='
if old_init not in s:
    raise SystemExit('init anchor missing')
s=s.replace('async function init(){greeting();restoreLocation();loadTwelveKeyField();','async function init(){greeting();restoreLocation();loadTwelveKeyField();applyHomeWidgets();',1)

p.write_text(s,encoding='utf-8')
print('patched RunSGD v1.6.9')
