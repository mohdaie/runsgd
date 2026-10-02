import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-runsgd-health-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type CheckStatus = "healthy" | "warning" | "failed" | "not_tested" | "skipped";
type HealthCheck = {
  check_id: string;
  name: string;
  group_name: string;
  status: CheckStatus;
  ok: boolean | null;
  latency_ms: number;
  detail: string;
  data: Record<string, unknown>;
  checked_at: string;
};

function key() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try { return JSON.parse(modern).default || ""; } catch {}
  }
  return "";
}

function projectUrl() {
  return Deno.env.get("SUPABASE_URL") || "https://gdycbluljgfezhgslppe.supabase.co";
}

function serviceHeaders(extra: Record<string,string> = {}) {
  const k = key();
  return { apikey: k, Authorization: "Bearer " + k, ...extra };
}

async function fetchAny(url: string, init: RequestInit = {}, timeout = 12000) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout), cache: "no-store" });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(String(json?.error?.message || json?.error || json?.message || ("HTTP " + r.status)));
  return { r, text, json };
}

function safeError(e: unknown) {
  const s = e instanceof Error ? e.message : String(e || "Unavailable");
  return s.replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]").replace(/sb_(?:secret|publishable)_[0-9A-Za-z_-]+/g, "[redacted]").slice(0, 300);
}

async function makeCheck(
  check_id: string,
  name: string,
  group_name: string,
  fn: () => Promise<{detail?: string; data?: Record<string,unknown>; status?: CheckStatus; ok?: boolean | null}>,
  failStatus: CheckStatus = "failed"
): Promise<HealthCheck> {
  const started = performance.now();
  const checked_at = new Date().toISOString();
  try {
    const out = await fn();
    const status = out.status || "healthy";
    return {
      check_id, name, group_name, status,
      ok: out.ok === undefined ? status === "healthy" : out.ok,
      latency_ms: Math.max(1, Math.round(performance.now() - started)),
      detail: String(out.detail || "OK").slice(0, 1000),
      data: out.data || {},
      checked_at
    };
  } catch (e) {
    return {
      check_id, name, group_name, status: failStatus,
      ok: false,
      latency_ms: Math.max(1, Math.round(performance.now() - started)),
      detail: safeError(e),
      data: {},
      checked_at
    };
  }
}

async function rest(path: string, init: RequestInit = {}) {
  const url = projectUrl() + "/rest/v1/" + path;
  return fetchAny(url, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers || {}) }
  });
}

async function appSetting(name: string) {
  const x = await rest("app_settings?select=secret_value,updated_at&key=eq." + encodeURIComponent(name) + "&limit=1");
  const row = Array.isArray(x.json) ? x.json[0] : null;
  return { value: String(row?.secret_value || ""), updated_at: row?.updated_at || null };
}

async function callFunction(slug: string, body: any, timeout = 25000, extraHeaders: Record<string,string> = {}) {
  return fetchAny(projectUrl() + "/functions/v1/" + slug, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body)
  }, timeout);
}

async function tableCount(table: string) {
  const r = await fetch(projectUrl() + "/rest/v1/" + table + "?select=id&limit=1", {
    headers: { ...serviceHeaders(), Prefer: "count=exact" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store"
  });
  if (!r.ok) throw new Error(table + " HTTP " + r.status);
  const range = r.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });

  const suiteStarted = performance.now();
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = String(body?.trigger || "scheduled") === "manual" ? "manual" : "scheduled";
    const force = body?.force === true || trigger === "manual";

    const supplied = (req.headers.get("x-runsgd-health-secret") || "").trim();
    const secret = await appSetting("extensive_health_secret");
    if (!secret.value || !supplied || supplied !== secret.value) {
      return new Response(JSON.stringify({ error: "Extensive health authorization failed" }), { status: 403, headers: cors });
    }

    const recent = await rest("extensive_health_runs?select=id,started_at,completed_at,status&status=in.(healthy,degraded,failed)&order=started_at.desc&limit=1");
    const last = Array.isArray(recent.json) ? recent.json[0] : null;
    const dueAt = last?.started_at ? new Date(new Date(last.started_at).getTime() + 72 * 3600_000) : null;
    if (!force && dueAt && dueAt.getTime() > Date.now()) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "Not due yet",
        last_run_at: last.started_at,
        due_at: dueAt.toISOString()
      }), { headers: cors });
    }

    let appVersion = "";
    try {
      const live = await fetchAny("https://runsgd.site/VERSION?health=" + Date.now(), {}, 8000);
      appVersion = live.text.trim();
    } catch {}

    const runCreate = await rest("extensive_health_runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ trigger, status: "running", app_version: appVersion || null, summary: { suite: "RunSGD Extensive Test v1" } })
    });
    const run = Array.isArray(runCreate.json) ? runCreate.json[0] : null;
    if (!run?.id) throw new Error("Could not create extensive-health run");
    const runId = run.id;
    const checks: HealthCheck[] = [];

    checks.push(await makeCheck("live-deployment","Live app deployment","Core",async()=>{
      const stamp=Date.now();
      const [liveVersion,repoVersion,liveHtml,liveSw] = await Promise.all([
        fetchAny("https://runsgd.site/VERSION?health="+stamp,{},8000),
        fetchAny("https://raw.githubusercontent.com/mohdaie/runsgd/main/VERSION?health="+stamp,{},8000),
        fetchAny("https://runsgd.site/index.html?health="+stamp,{},10000),
        fetchAny("https://runsgd.site/sw.js?health="+stamp,{},10000)
      ]);
      const liveV=liveVersion.text.trim(),repoV=repoVersion.text.trim();
      const htmlMatch=liveHtml.text.match(/const RUNSGD_VERSION=['\"]([^'\"]+)['\"]/);
      const htmlV=htmlMatch?.[1]||"";
      const compact=repoV.replace(/[^0-9]/g,"");
      const swMatch=liveSw.text.match(/runsgd-shell-v(\d+)/);
      const swCompact=swMatch?.[1]||"";
      const aligned=!!repoV&&liveV===repoV&&htmlV===repoV&&swCompact===compact;
      return {
        status:aligned?"healthy":"warning",
        ok:aligned,
        detail:aligned?"VERSION, production HTML and service-worker cache are aligned":"Deployment version mismatch between VERSION, HTML or service worker",
        data:{live_version:liveV,repo_version:repoV,html_version:htmlV,service_worker_cache:swCompact?("v"+swCompact):null,expected_service_worker_cache:"v"+compact}
      };
    },"warning"));

    checks.push(await makeCheck("supabase-db","Supabase Database","Core",async()=>{
      const x=await rest("profiles?select=id&limit=1");
      return {detail:"Data API responding",data:{sample_rows:Array.isArray(x.json)?x.json.length:0}};
    }));

    checks.push(await makeCheck("client-version-observability","Client version observability","Core",async()=>{
      const since=new Date(Date.now()-24*3600_000).toISOString();
      const x=await rest("app_page_views?select=app_version,created_at&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=5000");
      const rows=Array.isArray(x.json)?x.json:[];
      const counts:Record<string,number>={};
      for(const row of rows){const v=String(row?.app_version||"unknown");counts[v]=(counts[v]||0)+1}
      return {status:"healthy",ok:true,detail:"Recent client app versions captured for stale-client diagnosis",data:{last_24h:counts,samples:rows.length}};
    },"warning"));

    checks.push(await makeCheck("supabase-auth","Supabase Auth","Core",async()=>{
      const x=await fetchAny(projectUrl()+"/auth/v1/admin/users?page=1&per_page=1",{headers:serviceHeaders()},10000);
      return {detail:"Auth admin endpoint responding",data:{users_returned:Array.isArray(x.json?.users)?x.json.users.length:null}};
    }));

    checks.push(await makeCheck("database-footprint","Database footprint","Core",async()=>{
      const names=["profiles","app_page_views","journey_history","ai_usage","ai_guest_usage","community_posts","google_maps_usage_events","affiliate_clicks"];
      const pairs=await Promise.all(names.map(async n=>[n,await tableCount(n)]));
      return {detail:"Key table counts captured",data:Object.fromEntries(pairs)};
    },"warning"));

    const depJobs = [
      makeCheck("lta-traffic","LTA Traffic Camera","Transport",async()=>{
        const x=await fetchAny(projectUrl()+"/functions/v1/lta-traffic-snapshot?camera=2701",{},12000);
        if(!x.json?.image_url)throw new Error(x.json?.error||"No Causeway snapshot");
        return {detail:"Causeway snapshot available",data:{camera_id:x.json.camera_id||"2701",captured_at:x.json.captured_at||null}};
      }),
      makeCheck("lta-transit","LTA MRT & Bus","Transport",async()=>{
        const x=await fetchAny(projectUrl()+"/functions/v1/lta-public-transport",{},15000);
        if(x.json?.configured===false||!x.json?.train)throw new Error(x.json?.error||"No train status");
        return {detail:"LTA train status responding",data:{train_status:x.json?.train?.status||null}};
      }),
      makeCheck("weather","Open-Meteo Weather","Environment",async()=>{
        const x=await fetchAny("https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m",{},9000);
        if(x.json?.current?.temperature_2m==null)throw new Error("Weather data unavailable");
        return {detail:"Singapore weather responding",data:{temperature_c:x.json.current.temperature_2m}};
      }),
      makeCheck("air","Open-Meteo Air Quality","Environment",async()=>{
        const x=await fetchAny("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=1.3521&longitude=103.8198&hourly=pm2_5&forecast_days=1&timezone=Asia%2FSingapore",{},9000);
        if(!Array.isArray(x.json?.hourly?.pm2_5))throw new Error("Air quality unavailable");
        return {detail:"Air-quality feed responding",data:{samples:x.json.hourly.pm2_5.length}};
      }),
      makeCheck("prayer","AlAdhan Prayer Times","Utility",async()=>{
        const x=await fetchAny("https://api.aladhan.com/v1/timingsByCity?city=Singapore&country=Singapore&method=3",{},9000);
        if(!x.json?.data?.timings?.Fajr)throw new Error("Prayer times unavailable");
        return {detail:"Prayer timetable responding",data:{fajr:x.json.data.timings.Fajr}};
      }),
      makeCheck("holidays","Nager Public Holidays","Utility",async()=>{
        const y=new Date().getUTCFullYear();
        const x=await fetchAny("https://date.nager.at/api/v3/PublicHolidays/"+y+"/SG",{},9000);
        if(!Array.isArray(x.json))throw new Error("Holiday data unavailable");
        return {detail:x.json.length+" Singapore holidays returned",data:{count:x.json.length,year:y}};
      }),
      makeCheck("fawaz","Currency API · Fawaz","Currency",async()=>{
        const x=await fetchAny("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sgd.json",{},9000);
        const rate=Number(x.json?.sgd?.myr);if(!rate)throw new Error("No SGD/MYR rate");
        return {detail:"Fallback FX responding",data:{sgd_myr:rate}};
      }),
      makeCheck("er-api","ExchangeRate API","Currency",async()=>{
        const x=await fetchAny("https://open.er-api.com/v6/latest/SGD",{},9000);
        const rate=Number(x.json?.rates?.MYR);if(!rate)throw new Error("No SGD/MYR rate");
        return {detail:"Fallback FX responding",data:{sgd_myr:rate}};
      }),
      makeCheck("frankfurter","Frankfurter FX","Currency",async()=>{
        const x=await fetchAny("https://api.frankfurter.dev/v2/rate/sgd/myr",{},9000);
        const rate=Number(x.json?.rate);if(!rate)throw new Error("No SGD/MYR rate");
        return {detail:"Fallback FX responding",data:{sgd_myr:rate}};
      })
    ];
    checks.push(...await Promise.all(depJobs));

    checks.push(await makeCheck("twelve","Twelve Data FX","Currency",async()=>{
      const s=await appSetting("twelve_data_api_key");
      if(!s.value)return {status:"not_tested",ok:null,detail:"No server-side Twelve Data key saved yet",data:{configured:false}};
      const x=await fetchAny("https://api.twelvedata.com/exchange_rate?symbol=SGD%2FMYR&apikey="+encodeURIComponent(s.value),{},9000);
      const rate=Number(x.json?.rate);if(!rate)throw new Error(x.json?.message||"No SGD/MYR rate");
      return {detail:"Primary FX provider responding",data:{configured:true,sgd_myr:rate}};
    },"warning"));

    checks.push(await makeCheck("overpass-pool","Nearby Prayer Lookup · Overpass","Location",async()=>{
      const mirrors=[
        ["Kumi","https://overpass.kumi.systems/api/interpreter"],
        ["Main","https://overpass-api.de/api/interpreter"],
        ["Coffee","https://overpass.private.coffee/api/interpreter"]
      ];
      const q='[out:json][timeout:6];nwr["amenity"="place_of_worship"]["religion"="muslim"](around:1500,1.3521,103.8198);out ids 1;';
      const rs=await Promise.all(mirrors.map(async ([name,url])=>{
        const t=performance.now();
        try{
          const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"data="+encodeURIComponent(q),signal:AbortSignal.timeout(7000),cache:"no-store"});
          const j=await r.json().catch(()=>null);
          return {name,ok:r.ok&&Array.isArray(j?.elements),code:r.status,latency_ms:Math.round(performance.now()-t)};
        }catch(e){return {name,ok:false,code:safeError(e),latency_ms:Math.round(performance.now()-t)}}
      }));
      const available=rs.filter(x=>x.ok).length;
      return {
        status: available===0?"failed":available<3?"warning":"healthy",
        ok: available>0,
        detail:available+"/3 Overpass mirrors available from server",
        data:{mirrors:rs}
      };
    }));

    checks.push(await makeCheck("sg-route-e2e","Singapore Route Engine · E2E","Routing",async()=>{
      const x=await callFunction("runsgd-route-sg",{action:"route",from:{lat:1.2838,lon:103.8591},to:{lat:1.3009,lon:103.8376},max_walk_m:1200},30000);
      const routes=Array.isArray(x.json?.routes)?x.json.routes:[];
      if(!routes.length)throw new Error(x.json?.error||"No Singapore route");
      const legs=routes.flatMap((r:any)=>Array.isArray(r?.legs)?r.legs:[]);
      if(!legs.length)throw new Error("Singapore route has no legs");
      return {detail:"OneMap returned "+routes.length+" route option(s)",data:{provider:x.json?.provider||"OneMap",routes:routes.length,legs:legs.length,future_departure:!!x.json?.future_departure}};
    }));

    // One provider pass, three independently recorded health results.
    let jbStatus:any=null,jbStatusError='';
    try{jbStatus=(await callFunction("runsgd-route-jb",{action:"status"},35000)).json;}
    catch(e){jbStatusError=safeError(e);}
    for(const [id,checkId,name] of [['places','jb-places','JB Google Places'],['drive','jb-drive-e2e','JB Driving Routes'],['two_wheeler','jb-motorcycle-e2e','JB Motorcycle Routes']]){
      const probe=Array.isArray(jbStatus?.checks)?jbStatus.checks.find((x:any)=>x.id===id):null;
      const result=await makeCheck(checkId,name,"Routing",async()=>{
        if(!probe?.ok)throw new Error(probe?.detail||jbStatusError||jbStatus?.error||'Routing health probe missing');
        return {detail:probe.detail,data:probe};
      });
      if(probe)result.latency_ms=Number(probe.latency_ms)||result.latency_ms;
      checks.push(result);
    }

    checks.push(await makeCheck("jb-transit-e2e","JB Transit Route Engine · E2E","Routing",async()=>{
      const x=await callFunction("runsgd-route-jb",{action:"route",travel_mode:"TRANSIT",from:{lat:1.4629,lon:103.7643},to:{lat:1.4854,lon:103.7622,name:"KSL City Mall"}},30000);
      const routes=Array.isArray(x.json?.routes)?x.json.routes:[];
      if(!routes.length)throw new Error(x.json?.error||"No JB transit route");
      return {detail:"Google Transit returned "+routes.length+" JB route option(s)",data:{routes:routes.length,provider:x.json?.provider||"Google Maps"}};
    }));

    checks.push(await makeCheck("cross-border-road-payload","Cross-border navigation payload","Navigation",async()=>{
      const x=await callFunction("runsgd-route-jb",{action:"route",travel_mode:"DRIVE",from:{lat:1.4629,lon:103.7643},to:{lat:1.4360,lon:103.7860,name:"Woodlands Checkpoint"}},30000);
      const route=Array.isArray(x.json?.routes)?x.json.routes[0]:null;
      if(!route)throw new Error(x.json?.error||"No cross-border driving route");
      if(!route.polyline)throw new Error("Driving route returned without encoded polyline");
      if(!Array.isArray(route.legs)||!route.legs.length)throw new Error("Driving route returned without navigation legs");
      return {detail:"Cross-border route contains geometry and navigation legs",data:{distance_m:route.distance_m||null,duration_sec:route.duration_sec||null,legs:route.legs.length,cross_border:!!route.cross_border}};
    }));

    checks.push(await makeCheck("ai-journey-e2e","AI Journey Planner · E2E","AI",async()=>{
      const x=await callFunction("runsgd-ai",{
        mode:"health",
        question:"My car is parked at Guoco Tower. Walk to my car first, then drive to Woodlands Checkpoint.",
        context:{health_check:true}
      },30000,{"x-runsgd-health-secret":secret.value});
      const j=x.json||{};
      const actions=Array.isArray(j.requested_actions)?j.requested_actions:[];
      const hasWalk=actions.some((a:any)=>/walk/i.test(String(a?.action||a?.mode||"")));
      const hasRetrieve=actions.some((a:any)=>/retrieve|access/i.test(String(a?.action||a?.mode||"")));
      const hasDrive=actions.some((a:any)=>/drive/i.test(String(a?.action||a?.mode||"")));
      const valid=j.vehicle_access_required===true&&j.direct_drive===false&&j.must_preserve_sequence===true&&hasWalk&&hasRetrieve&&hasDrive;
      const snapshot={
        model:j.model||null,
        answer:String(j.answer||"").slice(0,500),
        vehicle_access_required:j.vehicle_access_required??null,
        vehicle_access_mode:j.vehicle_access_mode??null,
        vehicle_access_location:j.vehicle_access_location??null,
        direct_drive:j.direct_drive??null,
        must_preserve_sequence:j.must_preserve_sequence??null,
        has_walk_action:hasWalk,
        has_retrieve_action:hasRetrieve,
        has_drive_action:hasDrive,
        requested_actions:actions.slice(0,12),
        resources:Array.isArray(j.resources)?j.resources.slice(0,12):[],
        constraints:Array.isArray(j.constraints)?j.constraints.slice(0,12):[],
        assumptions:Array.isArray(j.assumptions)?j.assumptions.slice(0,12):[],
        unresolved:Array.isArray(j.unresolved)?j.unresolved.slice(0,12):[],
        confidence:j.confidence??null
      };
      return valid
        ? {status:"healthy",ok:true,detail:"AI preserved WALK → RETRIEVE VEHICLE → DRIVE sequence",data:snapshot}
        : {status:"failed",ok:false,detail:"AI structured journey failed parked-car sequence contract",data:snapshot};
    }));

    checks.push(await makeCheck("ai-local-relevance-e2e","AI Local Journey Relevance · E2E","AI",async()=>{
      const x=await callFunction("runsgd-ai",{
        mode:"health_brief",
        question:"I want to take MRT to Paya Lebar.",
        context:{
          health_check:true,
          journey_id:"custom",
          journey_intent:"I want to take MRT to Paya Lebar.",
          journey_scope:"local_sg",
          cross_border_relevant:false,
          likely_direction:"Within Singapore / local journey unless the user explicitly says otherwise",
          location:"Downtown, SG",
          location_detail:{name:"Downtown, SG",country:"SG"},
          origin_country:"SG",
          destination_country:"SG",
          trip_stage:"local",
          causeway:{source:"LTA DataMall traffic camera",camera:"Woodlands Causeway",observation:"Heavy traffic"},
          public_transport:{
            source:"LTA DataMall",
            train:{status:"normal",messages:[{content:"Bus services 170 and 170X are diverted near Woodlands Checkpoint."}]},
            nearest_mrt:{name:"Downtown"}
          }
        }
      },30000,{"x-runsgd-health-secret":secret.value});
      const j=x.json||{};
      const combined=(String(j.answer||"")+" "+String(j.reason||"")+" "+JSON.stringify(j.sources||[])).toLowerCase();
      const irrelevant=/\b170x?\b|\b950\b|woodlands|johor|causeway|checkpoint|\bciq\b/.test(combined);
      const valid=!irrelevant&&String(j.answer||"").trim().length>0;
      const snapshot={model:j.model||null,answer:String(j.answer||"").slice(0,500),reason:String(j.reason||"").slice(0,500),sources:Array.isArray(j.sources)?j.sources.slice(0,10):[],irrelevant_cross_border_signal:irrelevant};
      return valid
        ? {status:"healthy",ok:true,detail:"Local MRT brief ignored unrelated Causeway / 170 / Woodlands signals",data:snapshot}
        : {status:"failed",ok:false,detail:"Local MRT brief leaked unrelated cross-border information",data:snapshot};
    }));

    checks.push(await makeCheck("google-dynamic-map-config","Google Dynamic Maps configuration","Browser",async()=>{
      const s=await appSetting("google_maps_browser_key");
      return s.value
        ? {status:"not_tested",ok:null,detail:"Browser key is configured; actual JavaScript map rendering requires a browser synthetic test",data:{configured:true,updated_at:s.updated_at,browser_only:true}}
        : {status:"warning",ok:false,detail:"Google Maps JavaScript browser key is not configured",data:{configured:false}};
    },"warning"));

    checks.push({
      check_id:"navigation-client-gps",
      name:"Production GPS matcher + maneuver UI",
      group_name:"Browser",
      status:"not_tested",
      ok:null,
      latency_ms:0,
      detail:"Requires a browser/device synthetic trace; backend suite validates route payload but cannot execute production phone GPS/UI logic.",
      data:{browser_only:true},
      checked_at:new Date().toISOString()
    });

    checks.push(await makeCheck("credentials-config","Server credential configuration","Configuration",async()=>{
      const keys=["lta_account_key","onemap_email","onemap_password","google_maps_api_key","google_maps_browser_key","gemini_api_key","twelve_data_api_key"];
      const vals=await Promise.all(keys.map(async k=>[k,!!(await appSetting(k)).value]));
      const configured=Object.fromEntries(vals);
      const required=["lta_account_key","onemap_email","onemap_password","google_maps_api_key","google_maps_browser_key","gemini_api_key"];
      const missing=required.filter(k=>!configured[k]);
      return {status:missing.length?"warning":"healthy",ok:missing.length===0,detail:missing.length?("Missing required credentials: "+missing.join(", ")):"Required server credentials configured",data:{configured}};
    },"warning"));

    checks.push(await makeCheck("google-usage","Google Maps usage counters","Usage",async()=>{
      const now=new Date();
      const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
      const x=await rest("google_maps_usage_events?select=action,context,created_at&created_at=gte."+encodeURIComponent(monthStart)+"&limit=50000");
      const rows=Array.isArray(x.json)?x.json:[];
      const app=rows.filter((r:any)=>r.context==="app");
      const data={
        month_total:app.length,
        places:app.filter((r:any)=>r.action==="places_search").length,
        routes:app.filter((r:any)=>r.action==="routes_compute").length,
        dynamic_maps:app.filter((r:any)=>r.action==="dynamic_map_load").length,
        admin_tests:rows.filter((r:any)=>r.context==="admin_test").length
      };
      const maxPct=Math.max(data.places/5000,data.routes/5000,data.dynamic_maps/10000)*100;
      return {status:maxPct>=85?"warning":"healthy",ok:maxPct<85,detail:maxPct>=85?"Google Maps usage is above 85% of a tracked free threshold":"Google Maps usage counters within tracked thresholds",data:{...data,max_percent:Math.round(maxPct)}};
    },"warning"));

    await rest("extensive_health_checks",{
      method:"POST",
      headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify(checks.map(c=>({run_id:runId,...c})))
    });

    const healthy=checks.filter(x=>x.status==="healthy").length;
    const warning=checks.filter(x=>x.status==="warning").length;
    const failed=checks.filter(x=>x.status==="failed").length;
    const skipped=checks.filter(x=>x.status==="not_tested"||x.status==="skipped").length;
    const total=checks.length;
    const duration=Math.max(1,Math.round(performance.now()-suiteStarted));
    const overall=failed||warning ? "degraded" : "healthy";
    const summary={
      suite:"RunSGD Extensive Test v1",
      due_every_hours:72,
      not_tested_checks:checks.filter(x=>x.status==="not_tested").map(x=>x.check_id),
      browser_only_checks:checks.filter(x=>x.status==="not_tested" && x.data?.browser_only===true).map(x=>x.check_id),
      failures:checks.filter(x=>x.status==="failed").map(x=>x.check_id),
      warnings:checks.filter(x=>x.status==="warning").map(x=>x.check_id)
    };

    await rest("extensive_health_runs?id=eq."+encodeURIComponent(runId),{
      method:"PATCH",
      headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({
        status:overall,
        completed_at:new Date().toISOString(),
        healthy_count:healthy,
        warning_count:warning,
        failed_count:failed,
        skipped_count:skipped,
        total_count:total,
        duration_ms:duration,
        summary
      })
    });

    return new Response(JSON.stringify({run_id:runId,status:overall,healthy,warning,failed,not_tested:skipped,total,duration_ms:duration,checks}),{headers:cors});
  } catch (e) {
    return new Response(JSON.stringify({error:safeError(e)}),{status:500,headers:cors});
  }
});
