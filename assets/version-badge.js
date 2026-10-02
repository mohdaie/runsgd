// Fills [data-runsgd-badge] labels with the deployed release from /VERSION,
// so admin pages never carry a hard-coded version that drifts from the app.
fetch('/VERSION?badge='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(v=>{
 v=String(v||'').trim();
 if(!/^\d+\.\d+\.\d+$/.test(v))return;
 document.querySelectorAll('[data-runsgd-badge]').forEach(el=>{el.textContent=el.dataset.runsgdBadge+' · v'+v});
}).catch(()=>{});
