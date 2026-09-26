import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://runsgd.site",
  "https://www.runsgd.site",
]);
const rate = new Map<string,{count:number,reset:number}>();

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)?origin:"*",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    "Vary":"Origin",
  };
}
function respond(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:cors(req)});
}
function clientId(req:Request){
  return (req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
}
function rateAllowed(req:Request){
  const id=clientId(req),now=Date.now(),cur=rate.get(id);
  if(!cur||cur.reset<now){rate.set(id,{count:1,reset:now+60000});return true}
  cur.count++;return cur.count<=45;
}
async function fetchJson(url:string,init:RequestInit={},timeout=15000){
  const r=await fetch(url,{...init,signal:AbortSignal.timeout(timeout),cache:"no-store"});
  const text=await r.text();let j:any=null;try{j=text?JSON.parse(text):null}catch{}
  if(!r.ok)throw new Error(String(j?.error?.message||j?.error||j?.message||("HTTP "+r.status)));
  return j;
}
function serviceKey(){
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
async function logUsage(action:string,context:"app"|"admin_test"){
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
    if(!supabaseUrl||!key)return;
    await fetch(supabaseUrl+"/rest/v1/google_maps_usage_events",{
      method:"POST",
      headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({action,context}),
      signal:AbortSignal.timeout(4000),
    });
  }catch{}
}
async function getMapsKey(){
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
  if(!supabaseUrl||!key)throw new Error("Supabase server environment unavailable");
  const rows=await fetchJson(supabaseUrl+"/rest/v1/app_settings?select=secret_value&key=eq.google_maps_api_key",{
    headers:{apikey:key,Authorization:"Bearer "+key}
  });
  const apiKey=String(rows?.[0]?.secret_value||"").trim();
  if(!apiKey)throw new Error("Google Maps key is not configured in Admin");
  return apiKey;
}
async function getBrowserMapsKey(required=true){
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
  if(!supabaseUrl||!key)throw new Error("Supabase server environment unavailable");
  const rows=await fetchJson(supabaseUrl+"/rest/v1/app_settings?select=secret_value&key=eq.google_maps_browser_key",{
    headers:{apikey:key,Authorization:"Bearer "+key}
  }).catch(()=>[]);
  const apiKey=String(rows?.[0]?.secret_value||"").trim();
  if(required&&!apiKey)throw new Error("Google Maps browser key is not configured in Admin");
  return apiKey;
}
async function requireSignedInUser(req:Request){
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
  const auth=req.headers.get("authorization")||"",token=auth.replace(/^Bearer\s+/i,"").trim();
  if(!supabaseUrl||!key||!token)throw new Error("Signed-in RunSGD session required");
  const user=await fetchJson(supabaseUrl+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token}});
  if(!user?.id)throw new Error("Signed-in RunSGD session required");
  return user;
}
function cleanError(e:unknown){
  const s=e instanceof Error?e.message:String(e||"Unavailable");
  return s.replace(/AIza[0-9A-Za-z_-]+/g,"[redacted]").slice(0,260);
}
function parseDuration(v:any){
  if(typeof v==="number")return Math.round(v);
  const m=String(v||"").match(/^([0-9.]+)s$/);return m?Math.round(Number(m[1])):0;
}
function latLng(loc:any){
  const p=loc?.latLng||loc?.location?.latLng||loc;
  const lat=Number(p?.latitude??p?.lat),lon=Number(p?.longitude??p?.lng??p?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
}
function inJohor(lat:number,lon:number){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=1.20&&lat<=1.85&&lon>=103.35&&lon<=104.15&&!inSingapore(lat,lon);
}
function inSingapore(lat:number,lon:number){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=1.15&&lon>=103.55&&lon<=104.10&&
    ((lon<103.70&&lat<=1.365)||(lon>=103.70&&lat<=1.462));
}
function validRoadCoord(lat:number,lon:number){
  return inJohor(lat,lon)||inSingapore(lat,lon);
}
function metersBetween(lat1:number,lon1:number,lat2:number,lon2:number){
  const r=6371000,toRad=(v:number)=>v*Math.PI/180;
  const p1=toRad(lat1),p2=toRad(lat2),dp=toRad(lat2-lat1),dl=toRad(lon2-lon1);
  const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return Math.round(2*r*Math.asin(Math.min(1,Math.sqrt(a))));
}
function normSearch(v:any){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function searchRelevance(q:string,name:string,address:string){
  const nq=normSearch(q),n=normSearch(name),a=normSearch(address);
  if(!nq)return 0;
  let score=0;
  if(n===nq)score=100;
  else if(n.startsWith(nq))score=92;
  else if(n.includes(nq))score=86;
  else if(a.includes(nq))score=72;
  const qt=nq.split(" ").filter(Boolean);
  if(qt.length){
    const nameHits=qt.filter(t=>n.includes(t)).length/qt.length;
    const allHits=qt.filter(t=>(n+" "+a).includes(t)).length/qt.length;
    score+=Math.round(nameHits*12+allHits*8);
  }
  return score;
}

function vehicleMode(step:any){
  const raw=String(step?.transitDetails?.transitLine?.vehicle?.type||step?.travelMode||"").toUpperCase();
  if(raw.includes("BUS"))return "BUS";
  if(raw.includes("SUBWAY")||raw.includes("METRO"))return "SUBWAY";
  if(raw.includes("TRAM")||raw.includes("LIGHT_RAIL"))return "TRAM";
  if(raw.includes("RAIL")||raw.includes("TRAIN"))return "TRAIN";
  if(raw==="WALK")return "WALK";
  return raw==="TRANSIT"?"TRANSIT":raw||"WALK";
}
function stopObj(stop:any,fallbackLoc:any=null){
  if(stop){
    const p=latLng(stop.location);
    return {name:String(stop.name||"").trim(),stopCode:"",lat:p?.lat??null,lon:p?.lon??null};
  }
  const p=latLng(fallbackLoc);
  return {name:"",stopCode:"",lat:p?.lat??null,lon:p?.lon??null};
}
function moneyValue(m:any){
  if(!m)return null;
  const units=Number(m.units||0),nanos=Number(m.nanos||0),value=units+nanos/1e9;
  return Number.isFinite(value)?value:null;
}
function normalizeTransitStep(step:any){
  const td=step?.transitDetails||{},line=td?.transitLine||{},stops=td?.stopDetails||{};
  const mode=vehicleMode(step),from=stopObj(stops.departureStop,step.startLocation),to=stopObj(stops.arrivalStop,step.endLocation);
  return {
    mode,
    duration_sec:parseDuration(step.staticDuration),
    distance_m:Math.round(Number(step.distanceMeters||0)),
    route:String(line.nameShort||line.name||td.tripShortText||"").trim(),
    route_name:String(line.name||"").trim(),
    vehicle:String(line.vehicle?.name?.text||line.vehicle?.type||"").trim(),
    headsign:String(td.headsign||"").trim(),
    from,to,
    start_time:stops.departureTime||null,
    end_time:stops.arrivalTime||null,
    intermediate_stops:Number(td.stopCount||0),
    instruction:String(step.navigationInstruction?.instructions||"").trim(),
  };
}
function normalizeWalkGroup(steps:any[],nextTransit:any,destination:any,previousTransit:any){
  const first=steps[0]||{},last=steps[steps.length-1]||{};
  const fromPoint=latLng(first.startLocation),toPoint=latLng(last.endLocation);
  const nextStop=nextTransit?.transitDetails?.stopDetails?.departureStop;
  const prevStop=previousTransit?.transitDetails?.stopDetails?.arrivalStop;
  const fromName=prevStop?.name||"Current location";
  const toName=nextStop?.name||destination?.name||destination?.address||"Destination";
  const stepPolylines=steps.map((x:any)=>String(x?.polyline?.encodedPolyline||"").trim()).filter(Boolean);
  const walkInstructions=steps.map((x:any,index:number)=>{
    const p=latLng(x?.startLocation);
    return {
      id:index,
      action:String(x?.navigationInstruction?.maneuver||"").trim(),
      path_name:"",
      distance_m:Math.round(Number(x?.distanceMeters||0)),
      lat:p?.lat??null,
      lon:p?.lon??null,
      instruction:String(x?.navigationInstruction?.instructions||"").trim(),
      polyline:String(x?.polyline?.encodedPolyline||"").trim(),
    };
  }).filter((x:any)=>x.instruction||x.polyline);
  return {
    mode:"WALK",
    duration_sec:steps.reduce((n,x)=>n+parseDuration(x.staticDuration),0),
    distance_m:Math.round(steps.reduce((n,x)=>n+Number(x.distanceMeters||0),0)),
    route:"",
    route_name:"",
    vehicle:"Walk",
    headsign:"",
    from:{name:String(fromName),stopCode:"",lat:fromPoint?.lat??null,lon:fromPoint?.lon??null},
    to:{name:String(toName),stopCode:"",lat:toPoint?.lat??null,lon:toPoint?.lon??null},
    start_time:null,end_time:null,intermediate_stops:0,
    instruction:String(first.navigationInstruction?.instructions||last.navigationInstruction?.instructions||"").trim(),
    step_polylines:stepPolylines,
    walk_instructions:walkInstructions,
    pedestrian_path:stepPolylines.length>0,
  };
}
function groupSteps(steps:any[],destination:any){
  const hops:any[]=[];let walk:any[]=[];
  const flush=(nextTransit:any=null,prevTransit:any=null)=>{if(walk.length){hops.push(normalizeWalkGroup(walk,nextTransit,destination,prevTransit));walk=[]}};
  let prevTransit:any=null;
  for(let i=0;i<steps.length;i++){
    const s=steps[i],mode=String(s?.travelMode||"").toUpperCase();
    if(mode==="WALK"){walk.push(s);continue}
    if(mode==="TRANSIT"){
      flush(s,prevTransit);
      const hop=normalizeTransitStep(s);hops.push(hop);prevTransit=s;continue;
    }
    if(walk.length)flush(null,prevTransit);
    const p1=latLng(s.startLocation),p2=latLng(s.endLocation);
    hops.push({mode:mode||"WALK",duration_sec:parseDuration(s.staticDuration),distance_m:Number(s.distanceMeters||0),route:"",route_name:"",vehicle:mode,headsign:"",from:{name:"",stopCode:"",lat:p1?.lat??null,lon:p1?.lon??null},to:{name:"",stopCode:"",lat:p2?.lat??null,lon:p2?.lon??null},start_time:null,end_time:null,intermediate_stops:0,instruction:String(s.navigationInstruction?.instructions||"").trim(),maneuver:String(s.navigationInstruction?.maneuver||"").trim(),polyline:String(s?.polyline?.encodedPolyline||"")});
  }
  flush(null,prevTransit);
  return hops.filter(x=>x.to?.lat!=null&&x.to?.lon!=null);
}
function normalizeRoute(route:any,idx:number,destination:any,travelMode="TRANSIT"){
  const allSteps=(route?.legs||[]).flatMap((l:any)=>Array.isArray(l.steps)?l.steps:[]);
  const hops=groupSteps(allSteps,destination);
  const transitCount=hops.filter((x:any)=>x.mode!=="WALK").length;
  const fare=route?.travelAdvisory?.transitFare;
  const fareValue=moneyValue(fare);
  return {
    id:idx,
    travel_mode:travelMode,
    duration_sec:parseDuration(route.duration),
    distance_m:Math.round(Number(route.distanceMeters||0)),
    walk_distance_m:Math.round(hops.filter((x:any)=>x.mode==="WALK").reduce((n:number,x:any)=>n+Number(x.distance_m||0),0)),
    transfers:Math.max(0,transitCount-1),
    fare_myr:fare?.currencyCode==="MYR"?fareValue:null,
    fare_sgd:fare?.currencyCode==="SGD"?fareValue:null,
    fare_currency:fare?.currencyCode||null,
    fare_value:fareValue,
    route_labels:Array.isArray(route.routeLabels)?route.routeLabels:[],
    polyline:String(route?.polyline?.encodedPolyline||""),
    legs:hops,
  };
}
async function placesSearch(apiKey:string,q:string,pageSize=7,usageAction="places_search",context:"app"|"admin_test"="app",origin:any=null){
  let j:any;
  try{j=await fetchJson("https://places.googleapis.com/v1/places:searchText",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":apiKey,
      "X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.location,places.types",
    },
    body:JSON.stringify({
      textQuery:/johor|jb|malaysia/i.test(q)?q:(q+", Johor Bahru, Johor, Malaysia"),
      pageSize:Math.max(1,Math.min(10,pageSize)),
      languageCode:"en",
      regionCode:"MY",
      locationBias:{circle:{center:{latitude:inJohor(Number(origin?.lat),Number(origin?.lon))?Number(origin.lat):1.4927,longitude:inJohor(Number(origin?.lat),Number(origin?.lon))?Number(origin.lon):103.7414},radius:40000}},
    })
  });}finally{await logUsage(usageAction,context)}
  const hasOrigin=inJohor(Number(origin?.lat),Number(origin?.lon)),oLat=Number(origin?.lat),oLon=Number(origin?.lon);
  return (Array.isArray(j?.places)?j.places:[]).map((p:any,index:number)=>{
    const name=String(p.displayName?.text||p.formattedAddress||"").trim(),address=String(p.formattedAddress||"").trim();
    const lat=Number(p.location?.latitude),lon=Number(p.location?.longitude);
    return {
      id:String(p.id||""),name,address,lat,lon,
      types:Array.isArray(p.types)?p.types:[],provider:"Google Maps",
      distance_m:hasOrigin&&inJohor(lat,lon)?metersBetween(oLat,oLon,lat,lon):null,
      _relevance:searchRelevance(q,name,address),_index:index,
    };
  }).filter((p:any)=>inJohor(p.lat,p.lon))
    .sort((a:any,b:any)=>(b._relevance-a._relevance)||((a.distance_m??Number.MAX_SAFE_INTEGER)-(b.distance_m??Number.MAX_SAFE_INTEGER))||(a._index-b._index))
    .map(({_relevance,_index,...x}:any)=>x);
}
async function computeRoute(apiKey:string,from:any,to:any,travelMode="TRANSIT",usageAction="routes_compute",context:"app"|"admin_test"="app",transitPreference=""){
  const modeRaw=String(travelMode||"TRANSIT").toUpperCase();
  const mode=["TRANSIT","DRIVE","TWO_WHEELER","WALK"].includes(modeRaw)?modeRaw:"TRANSIT";
  const fieldMask=[
    "routes.duration","routes.distanceMeters","routes.routeLabels","routes.polyline.encodedPolyline",
    "routes.travelAdvisory.transitFare",
    "routes.legs.steps.distanceMeters","routes.legs.steps.staticDuration","routes.legs.steps.travelMode","routes.legs.steps.polyline.encodedPolyline",
    "routes.legs.steps.startLocation","routes.legs.steps.endLocation",
    "routes.legs.steps.navigationInstruction.instructions","routes.legs.steps.navigationInstruction.maneuver",
    "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
    "routes.legs.steps.transitDetails.stopDetails.arrivalStop.location",
    "routes.legs.steps.transitDetails.stopDetails.arrivalTime",
    "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
    "routes.legs.steps.transitDetails.stopDetails.departureStop.location",
    "routes.legs.steps.transitDetails.stopDetails.departureTime",
    "routes.legs.steps.transitDetails.headsign","routes.legs.steps.transitDetails.stopCount",
    "routes.legs.steps.transitDetails.tripShortText",
    "routes.legs.steps.transitDetails.transitLine.name","routes.legs.steps.transitDetails.transitLine.nameShort",
    "routes.legs.steps.transitDetails.transitLine.vehicle.type","routes.legs.steps.transitDetails.transitLine.vehicle.name.text"
  ].join(",");
  const body:any={
    origin:{location:{latLng:{latitude:Number(from.lat),longitude:Number(from.lon)}}},
    destination:{location:{latLng:{latitude:Number(to.lat),longitude:Number(to.lon)}}},
    travelMode:mode,
    computeAlternativeRoutes:true,
    languageCode:"en",
    units:"METRIC",
  };
  if(mode==="TRANSIT"){
    // Keep the existing Johor less-walking behaviour. Singapore defaults to
    // Google's primary route unless the commuter asked for fewer transfers.
    const preference=String(transitPreference||"").toUpperCase();
    if(preference==="LESS_WALKING"||preference==="FEWER_TRANSFERS")body.transitPreferences={routingPreference:preference};
    else if(inJohor(Number(from.lat),Number(from.lon))&&inJohor(Number(to.lat),Number(to.lon)))body.transitPreferences={routingPreference:"LESS_WALKING"};
    body.polylineQuality="OVERVIEW";
  }else if(mode==="WALK"){
    body.polylineQuality="HIGH_QUALITY";
  }else{
    body.routingPreference="TRAFFIC_AWARE";
    body.polylineQuality="HIGH_QUALITY";
  }
  body.polylineEncoding="ENCODED_POLYLINE";
  try{return await fetchJson("https://routes.googleapis.com/directions/v2:computeRoutes",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Goog-Api-Key":apiKey,"X-Goog-FieldMask":fieldMask},
    body:JSON.stringify(body)
  },20000);}finally{await logUsage(usageAction,context)}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return respond(req,{error:"POST only"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&!allowedOrigins.has(origin))return respond(req,{error:"Origin not allowed"},403);
  if(!rateAllowed(req))return respond(req,{error:"Too many route requests. Try again shortly."},429);
  try{
    const body=await req.json().catch(()=>({})),action=String(body?.action||"").trim();

    if(action==="map_config"){
      await requireSignedInUser(req);
      const browserKey=await getBrowserMapsKey(false);
      return respond(req,{enabled:!!browserKey,key:browserKey||null,provider:"Google Maps JavaScript API",usage_sku:"Dynamic Maps"});
    }
    if(action==="map_loaded"){
      await requireSignedInUser(req);
      const context=String(body?.context||"")==="admin_test"?"admin_test":"app";
      await logUsage("dynamic_map_load",context);
      return respond(req,{recorded:true,action:"dynamic_map_load",context});
    }

    const apiKey=await getMapsKey();

    if(action==="status"){
      const places=await placesSearch(apiKey,"Johor Bahru City Square",1,"status_places","admin_test");
      if(!places.length)throw new Error("Places API did not return a Johor result");
      const drive=await computeRoute(apiKey,{lat:1.4629,lon:103.7643},{lat:1.4854,lon:103.7622},"DRIVE","status_routes_drive","admin_test");
      if(!Array.isArray(drive?.routes)||!drive.routes.length)throw new Error("Routes API did not return a car test route");
      const motorcycle=await computeRoute(apiKey,{lat:1.4629,lon:103.7643},{lat:1.4854,lon:103.7622},"TWO_WHEELER","status_routes_motorcycle","admin_test");
      if(!Array.isArray(motorcycle?.routes)||!motorcycle.routes.length)throw new Error("Routes API did not return a motorcycle test route");
      const browserMapsConfigured=!!(await getBrowserMapsKey(false));
      return respond(req,{connected:true,provider:"Google Maps",places:true,routes:true,browser_maps_configured:browserMapsConfigured,modes:{transit:true,drive:true,two_wheeler:true,walk:true}});
    }

    if(action==="search"){
      const q=String(body?.q||"").trim().slice(0,120);
      if(q.length<2)return respond(req,{error:"Enter at least 2 characters."},400);
      const from=body?.from||{};
      const results=(await placesSearch(apiKey,q,10,"places_search","app",from)).slice(0,4);
      return respond(req,{provider:"Google Maps",region:"Johor Bahru",query:q,sorted_by:inJohor(Number(from.lat),Number(from.lon))?"relevance_distance":"relevance",results,attribution:"Google Maps"});
    }

    if(action==="route"){
      const from=body?.from||{},to=body?.to||{};
      const fromLat=Number(from.lat),fromLon=Number(from.lon),toLat=Number(to.lat),toLon=Number(to.lon);
      const travelMode=String(body?.travel_mode||"TRANSIT").toUpperCase();
      if(!["TRANSIT","DRIVE","TWO_WHEELER","WALK"].includes(travelMode))return respond(req,{error:"Unsupported travel mode."},400);
      if(travelMode==="TRANSIT"){
        const sameRegion=(inJohor(fromLat,fromLon)&&inJohor(toLat,toLon))||(inSingapore(fromLat,fromLon)&&inSingapore(toLat,toLon));
        if(!sameRegion)return respond(req,{error:"Google public-transport routing must stay within Singapore or Johor."},400);
      }else if(travelMode==="WALK"){
        const sameRegion=(inJohor(fromLat,fromLon)&&inJohor(toLat,toLon))||(inSingapore(fromLat,fromLon)&&inSingapore(toLat,toLon));
        if(!sameRegion)return respond(req,{error:"Walking reroute must stay within the current local region."},400);
      }else{
        if(!validRoadCoord(fromLat,fromLon)||!validRoadCoord(toLat,toLon)){
          return respond(req,{error:"Road routing supports locations within Johor and Singapore."},400);
        }
      }
      const crossBorder=(inJohor(fromLat,fromLon)&&inSingapore(toLat,toLon))||(inSingapore(fromLat,fromLon)&&inJohor(toLat,toLon));
      const j=await computeRoute(apiKey,{lat:fromLat,lon:fromLon},{lat:toLat,lon:toLon},travelMode,"routes_compute","app",String(body?.transit_preference||""));
      const raw=Array.isArray(j?.routes)?j.routes:[];
      const destination={name:String(to.name||"").trim(),address:String(to.address||"").trim()};
      const routes=raw.slice(0,3).map((x:any,i:number)=>normalizeRoute(x,i,destination,travelMode)).filter((x:any)=>x.legs.length)
        .map((x:any)=>({...x,cross_border:crossBorder,border_variable:crossBorder}));
      const modeLabel=travelMode==="DRIVE"?"car":travelMode==="TWO_WHEELER"?"motorcycle":travelMode==="WALK"?"walking":"public-transport";
      if(!routes.length)throw new Error("Google Maps did not return a "+modeLabel+" route for this trip.");
      const roadRegion=crossBorder?"Singapore ↔ Johor":inSingapore(fromLat,fromLon)&&inSingapore(toLat,toLon)?"Singapore":"Johor Bahru";
      return respond(req,{provider:"Google Maps",region:roadRegion,travel_mode:travelMode,cross_border:crossBorder,generated_at:new Date().toISOString(),routes,attribution:"Google Maps",notice:crossBorder?"Road ETA does not include immigration or checkpoint queue time.":null});
    }

    return respond(req,{error:"Unknown action"},400);
  }catch(e){return respond(req,{error:cleanError(e)},500)}
});
