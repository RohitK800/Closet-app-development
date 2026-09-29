/* ---------- reference data ---------- */
const COLORS = [
 {k:"black",n:"Black",h:"#1C1C1E",neutral:1},{k:"white",n:"White",h:"#F7F7F4",neutral:1},
 {k:"grey",n:"Grey",h:"#9A9CA1",neutral:1},{k:"navy",n:"Navy",h:"#24314F",neutral:1},
 {k:"denim",n:"Denim blue",h:"#4C6C96",neutral:1},{k:"beige",n:"Beige",h:"#D9C6A5",neutral:1},
 {k:"brown",n:"Brown",h:"#7A5236",neutral:1},{k:"olive",n:"Olive",h:"#6A6B3B",neutral:1},
 {k:"maroon",n:"Maroon",h:"#6E1F2B"},{k:"red",n:"Red",h:"#C9312F"},{k:"pink",n:"Pink",h:"#E9A5B7"},
 {k:"orange",n:"Orange",h:"#E07B2E"},{k:"yellow",n:"Yellow",h:"#E9C443"},{k:"green",n:"Green",h:"#3E8A5A"},
 {k:"sky",n:"Sky blue",h:"#9CC4E7"},{k:"purple",n:"Purple",h:"#6C4A8B"},{k:"print",n:"Print / multi",h:"conic-gradient(#C9312F,#E9C443,#3E8A5A,#4C6C96,#C9312F)"}
];
const CMAP = Object.fromEntries(COLORS.map(c=>[c.k,c]));
const GOOD_PAIRS = new Set(["sky|pink","sky|yellow","sky|orange","green|pink","purple|pink","maroon|sky","maroon|pink","red|sky","green|sky","yellow|purple","orange|green"].flatMap(p=>{const[a,b]=p.split("|");return[a+"|"+b,b+"|"+a]}));
const TYPES = [{k:"top",n:"Top"},{k:"bottom",n:"Bottom"},{k:"dress",n:"Dress / one-piece"},{k:"layer",n:"Jacket / layer"},{k:"shoes",n:"Shoes"},{k:"acc",n:"Accessory"}];
const TMAP = Object.fromEntries(TYPES.map(t=>[t.k,t.n]));
const STYLES = [{k:"casual",n:"Casual"},{k:"work",n:"Office"},{k:"party",n:"Party"},{k:"ethnic",n:"Ethnic / festive"},{k:"date",n:"Date"},{k:"sport",n:"Gym / sport"}];
const WX = [{k:"hot",n:"Hot"},{k:"mild",n:"Pleasant"},{k:"cold",n:"Cold"},{k:"rain",n:"Rainy"}];

/* ---------- state ---------- */
const S = { items:[], saved:[], occasion:"casual", weather:"hot", typeFilter:"all", seen:new Set(), mode:"local" };
let cloud = null; // {itemsCol, savedCol}
// Each signed-in person gets their own wardrobe on this browser.
const ME = (window.Auth && Auth.current()) || null;
const LS_KEY = "closet-v1" + (ME ? ":" + ME.email : "");

function lsLoad(){ try{ const d = JSON.parse(localStorage.getItem(LS_KEY)||"{}"); S.items=d.items||[]; S.saved=d.saved||[]; }catch(e){} }
function lsSave(){ if(S.mode!=="local") return; try{ localStorage.setItem(LS_KEY, JSON.stringify({items:S.items,saved:S.saved})); }catch(e){ note("Your browser storage is full — try removing a few photos."); } }
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

async function putItem(it){
  if(cloud){ await cloud.itemsCol.doc(it.id).set(it); }
  else { S.items = S.items.filter(x=>x.id!==it.id).concat(it); lsSave(); renderAll(); }
}
async function removeItem(id){
  if(cloud){ await cloud.itemsCol.doc(id).delete(); }
  else { S.items = S.items.filter(x=>x.id!==id); lsSave(); renderAll(); }
}
async function putSaved(l){
  if(cloud){ await cloud.savedCol.doc(l.id).set(l); }
  else { S.saved = S.saved.filter(x=>x.id!==l.id).concat(l); lsSave(); renderAll(); }
}
async function removeSaved(id){
  if(cloud){ await cloud.savedCol.doc(id).delete(); }
  else { S.saved = S.saved.filter(x=>x.id!==id); lsSave(); renderAll(); }
}

async function initCloud(){
  if(!window.claude || typeof window.claude.use!=="function") return;
  try{
    const [db,user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if(!db || !user) return;
    const id = await user.id();
    if(!id) return;
    const root = db.doc("data/users/"+id+"/closet");
    const itemsCol = root.collection("items"), savedCol = root.collection("saved");
    const first = await itemsCol.get();
    const localItems = S.items.slice(), localSaved = S.saved.slice();
    cloud = {itemsCol, savedCol}; S.mode = "cloud";
    // move anything added before the connection came up
    if(first.empty && localItems.length){ for(const it of localItems) await itemsCol.doc(it.id).set(it); for(const l of localSaved) await savedCol.doc(l.id).set(l); }
    itemsCol.onSnapshot(s=>{ S.items = s.docs.map(d=>d.data()); renderAll(); }, ()=>{});
    savedCol.onSnapshot(s=>{ S.saved = s.docs.map(d=>d.data()); renderAll(); }, ()=>{});
    note("Your wardrobe is saved to your Claude account, private to you.");
  }catch(e){ cloud=null; S.mode="local"; }
}
function note(t){ document.getElementById("storeNote").textContent=t; }

/* ---------- matching engine ---------- */
function colorScore(keys){
  const bright = [...new Set(keys.filter(k=>!CMAP[k]?.neutral))];
  let s = 0, why = [];
  if(bright.length===0){ s+=2; why.push("Safe neutral combo"); }
  else if(bright.length===1){ s+=4; why.push(CMAP[bright[0]].n+" pops against neutrals"); }
  else if(bright.length===2){
    if(bright.includes("print")){ s-=4; }
    else if(GOOD_PAIRS.has(bright[0]+"|"+bright[1])){ s+=3; why.push(CMAP[bright[0]].n+" and "+CMAP[bright[1]].n.toLowerCase()+" work well together"); }
    else s-=3;
  } else s-=6;
  const prints = keys.filter(k=>k==="print").length; if(prints>1) s-=5;
  // tonal: same neutral top & bottom (e.g. black on black) is fine but plain
  if(keys[0] && keys[0]===keys[1] && CMAP[keys[0]]?.neutral){ s-=1; why.push("Tonal look"); }
  return {s, why};
}
function fits(it, occ, wx){
  const styleOk = !it.styles?.length || it.styles.includes(occ);
  const seasonOk = !it.seasons?.length || it.seasons.includes(wx) || (wx==="rain" && it.seasons.includes("mild"));
  return styleOk && seasonOk;
}
function buildLooks(){
  const {occasion:occ, weather:wx} = S;
  const pool = S.items.filter(it=>fits(it,occ,wx));
  const by = t => pool.filter(i=>i.type===t);
  const tops=by("top"), bottoms=by("bottom"), dresses=by("dress"), layers=by("layer"), shoes=by("shoes"), accs=by("acc");
  const bases = [];
  for(const t of tops) for(const b of bottoms) bases.push([t,b]);
  for(const d of dresses) bases.push([d]);
  const looks = [];
  for(const base of bases){
    const shoeOpts = shoes.length?shoes:[null];
    const layerOpts = (wx==="cold" && layers.length)?layers:(layers.length && wx!=="hot" ? [null,...layers] : [null]);
    for(const sh of shoeOpts) for(const ly of layerOpts){
      const pieces = [ly,...base,sh].filter(Boolean);
      const {s,why} = colorScore(pieces.map(p=>p.color));
      let score = s;
      if(wx==="cold" && !ly && layers.length) score-=2;
      if(sh && ["white","black","brown","beige"].includes(sh.color)) score+=0.5;
      // best accessory
      let acc = null;
      if(accs.length){ let best=-99; for(const a of accs){ const cs=colorScore(pieces.concat(a).map(p=>p.color)).s; if(cs>best){best=cs;acc=a;} } if(best<s-1) acc=null; }
      const all = acc?pieces.concat(acc):pieces;
      looks.push({key:all.map(p=>p.id).sort().join("+"), pieces:all, score:score+Math.random()*1.5, why:why[0]||""});
    }
  }
  const dedup = new Map(); for(const l of looks){ if(!dedup.has(l.key) || dedup.get(l.key).score<l.score) dedup.set(l.key,l); }
  return [...dedup.values()].filter(l=>l.score>-2).sort((a,b)=>b.score-a.score);
}
let currentLooks = [];
function pickLooks(fresh){
  const all = buildLooks();
  if(fresh) S.seen.clear();
  let pick = all.filter(l=>!S.seen.has(l.key)).slice(0,6);
  if(pick.length<Math.min(6,all.length)){ S.seen.clear(); pick = all.slice(0,6); }
  pick.forEach(l=>S.seen.add(l.key));
  currentLooks = pick;
  return all.length;
}

/* ---------- rendering ---------- */
const $ = id => document.getElementById(id);
function el(tag, attrs={}, ...kids){ const e=document.createElement(tag); for(const[k,v] of Object.entries(attrs)){ if(k==="class") e.className=v; else if(k==="style") e.style.cssText=v; else if(k.startsWith("on")) e.addEventListener(k.slice(2),v); else e.setAttribute(k,v);} for(const k of kids) if(k!=null) e.append(k.nodeType?k:document.createTextNode(k)); return e; }
function textOn(hex){ if(!hex.startsWith("#")) return "#fff"; const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255; return (r*299+g*587+b*114)/1000>150?"#1D2130":"#fff"; }
function fabric(it, cls){
  const c = CMAP[it.color]||CMAP.grey;
  const box = el("div",{class:cls, style:`background:${c.h};color:${textOn(c.h)}`});
  if(it.photo) box.append(el("img",{src:it.photo, alt:it.name}));
  else box.append(TMAP[it.type]?.split(" ")[0]||"");
  return box;
}
function chipGroup(host, opts, getVal, setVal, multi){
  host.innerHTML="";
  for(const o of opts){
    const on = multi ? getVal().includes(o.k) : getVal()===o.k;
    host.append(el("button",{type:"button",class:"chip","aria-pressed":String(on),onclick:()=>{
      if(multi){ const v=getVal(); setVal(v.includes(o.k)?v.filter(x=>x!==o.k):v.concat(o.k)); } else setVal(o.k);
      chipGroup(host,opts,getVal,setVal,multi);
    }}, o.n));
  }
}
function lookCard(pieces, {why="", saved=false, onSave, onRemove}={}){
  const card = el("article",{class:"look"});
  for(const p of pieces){
    card.append(el("div",{class:"piece"}, fabric(p,"fab"), el("div",{class:"t"}, el("b",{},p.name), el("span",{}, TMAP[p.type]+" · "+(CMAP[p.color]?.n||"")))));
  }
  if(why) card.append(el("p",{class:"why"},why));
  const ft = el("footer",{}, el("span",{class:"score"}, pieces.length+" pieces"));
  if(onSave) ft.append(el("button",{class:"save","aria-pressed":String(saved),onclick:onSave}, saved?"Saved":"Save look"));
  if(onRemove) ft.append(el("button",{class:"save",onclick:onRemove},"Remove"));
  card.append(ft);
  return card;
}
function isSaved(ids){ const key=[...ids].sort().join("+"); return S.saved.find(s=>[...s.ids].sort().join("+")===key); }
function toggleSave(pieces, why){
  const ids = pieces.map(p=>p.id); const ex = isSaved(ids);
  if(ex) removeSaved(ex.id); else putSaved({id:uid(), ids, why:why||"", at:Date.now()});
}

function renderLooks(total){
  const host=$("looks"); host.innerHTML="";
  const hasTB = S.items.some(i=>i.type==="top") && S.items.some(i=>i.type==="bottom");
  const hasDress = S.items.some(i=>i.type==="dress");
  if(!S.items.length){
    host.append(el("div",{class:"empty",style:"grid-column:1/-1"}, el("strong",{},"Your closet is empty"),
      "Add a few tops, bottoms and shoes to get outfit ideas — or load a sample closet to see how it works.",
      el("div",{class:"row",style:"justify-content:center;margin-top:14px"},
        el("button",{class:"btn",onclick:()=>{switchTab("wardrobe");openAdd();}},"Add a piece"),
        el("button",{class:"btn ghost",onclick:loadSample},"Load sample closet"))));
    $("shuffle").hidden=true; $("looksSub").textContent="Picked by colour matching from your own clothes."; return;
  }
  $("shuffle").hidden=false;
  if(!currentLooks.length){
    const msg = (!hasTB && !hasDress) ? "Add at least one top and one bottom (or a dress) to start pairing."
      : "Nothing in your closet is tagged for this plan and weather. Try another option, or add pieces tagged for it.";
    host.append(el("div",{class:"empty",style:"grid-column:1/-1"}, el("strong",{},"No outfits yet"), msg));
    $("looksSub").textContent=""; return;
  }
  $("looksSub").textContent = `${total} possible combination${total===1?"":"s"} — showing the best matches.`;
  for(const l of currentLooks) host.append(lookCard(l.pieces,{why:l.why, saved:!!isSaved(l.pieces.map(p=>p.id)), onSave:()=>toggleSave(l.pieces,l.why)}));
}
function renderGrid(){
  const host=$("grid"); host.innerHTML="";
  $("cnt").textContent = S.items.length?` ${S.items.length}`:"";
  chipGroup($("typeFilter"), [{k:"all",n:"All"},...TYPES], ()=>S.typeFilter, v=>{S.typeFilter=v; renderGrid();});
  const list = S.items.filter(i=>S.typeFilter==="all"||i.type===S.typeFilter).sort((a,b)=>(a.type>b.type?1:-1));
  if(!list.length){ host.append(el("div",{class:"empty",style:"grid-column:1/-1"}, el("strong",{},S.items.length?"Nothing of this type yet":"Start with what you wear most"), "Tap “Add a piece” to add clothes.")); return; }
  for(const it of list){
    host.append(el("div",{class:"item"}, fabric(it,"pic"),
      el("div",{class:"meta"}, el("div",{class:"nm"},it.name), el("div",{class:"tg"}, TMAP[it.type]+" · "+(CMAP[it.color]?.n||""))),
      el("button",{class:"del","aria-label":"Remove "+it.name, title:"Remove", onclick:()=>{ if(confirm("Remove “"+it.name+"” from your closet?")) removeItem(it.id); }},"×")));
  }
}
function renderSaved(){
  const host=$("savedLooks"); host.innerHTML="";
  const byId = Object.fromEntries(S.items.map(i=>[i.id,i]));
  const list = S.saved.slice().sort((a,b)=>b.at-a.at).map(s=>({s, pieces:s.ids.map(id=>byId[id]).filter(Boolean)})).filter(x=>x.pieces.length);
  if(!list.length){ host.append(el("div",{class:"empty",style:"grid-column:1/-1"}, el("strong",{},"No saved outfits"), "Tap “Save look” on any outfit you like.")); return; }
  for(const {s,pieces} of list) host.append(lookCard(pieces,{why:s.why, onRemove:()=>removeSaved(s.id)}));
}
function renderAll(fresh){ const total = pickLooks(fresh); renderLooks(total); renderGrid(); renderSaved(); $("aiBox").hidden = !(aiAvailable && S.items.length>=3); }

function switchTab(t){
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tab===t)));
  ["style","wardrobe","saved"].forEach(k=>$("tab-"+k).hidden = k!==t);
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
chipGroup($("occ"), STYLES, ()=>S.occasion, v=>{S.occasion=v; renderAll(true);});
chipGroup($("wx"), WX, ()=>S.weather, v=>{S.weather=v; renderAll(true);});
$("shuffle").onclick = ()=>{ const t=pickLooks(false); renderLooks(t); };

/* ---------- add item dialog ---------- */
const F = {};
function resetForm(){ Object.assign(F,{type:"top",color:"",styles:["casual"],seasons:[],photo:""}); $("fName").value=""; $("fPhoto").value=""; $("fPrev").innerHTML="No photo"; $("fErr").textContent=""; drawForm(); }
function drawForm(){
  chipGroup($("fType"), TYPES, ()=>F.type, v=>F.type=v);
  chipGroup($("fStyle"), STYLES, ()=>F.styles, v=>F.styles=v, true);
  chipGroup($("fSeason"), [{k:"hot",n:"Hot"},{k:"mild",n:"Pleasant"},{k:"cold",n:"Cold"}], ()=>F.seasons, v=>F.seasons=v, true);
  const host=$("fColor"); host.innerHTML="";
  for(const c of COLORS) host.append(el("button",{type:"button",class:"sw",title:c.n,"aria-label":c.n,"aria-pressed":String(F.color===c.k),style:"background:"+c.h,onclick:()=>{F.color=c.k; $("fColorName").textContent=c.n; drawForm();}}));
  if(!F.color) $("fColorName").textContent="Pick the main colour";
}
function openAdd(){ resetForm(); $("dlg").showModal(); setTimeout(()=>$("fName").focus(),50); }
$("addBtn").onclick = openAdd;
$("fCancel").onclick = ()=>$("dlg").close();
$("fPhoto").onchange = async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ F.photo = await shrink(f, 360); $("fPrev").innerHTML=""; $("fPrev").append(el("img",{src:F.photo,alt:""})); }
  catch(err){ $("fErr").textContent="That photo couldn't be read. Try a JPG or PNG."; }
};
function shrink(file, max){
  return new Promise((res,rej)=>{ const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ const r=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement("canvas"); c.width=Math.round(img.width*r); c.height=Math.round(img.height*r); c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg",0.72)); };
    img.onerror=rej; img.src=url; });
}
$("fSave").onclick = async ()=>{
  const name=$("fName").value.trim();
  if(!name){ $("fErr").textContent="Give it a name, like “Blue denim jeans”."; return; }
  if(!F.color){ $("fErr").textContent="Pick a colour so it can be matched."; return; }
  $("fSave").disabled=true;
  try{ await putItem({id:uid(), name, type:F.type, color:F.color, styles:F.styles, seasons:F.seasons, photo:F.photo||""}); $("dlg").close(); }
  catch(e){ $("fErr").textContent = e?.code==="quota_exceeded" ? "Your closet is full. Remove a few pieces first." : "Couldn't save that piece. Try again."; }
  finally{ $("fSave").disabled=false; }
};

async function loadSample(){
  const sample = [
    ["White cotton shirt","top","white",["work","casual","date"],[]],["Navy polo","top","navy",["casual","sport"],["hot","mild"]],
    ["Maroon kurta","top","maroon",["ethnic","party"],[]],["Sky blue linen shirt","top","sky",["casual","work","date"],["hot","mild"]],
    ["Black graphic tee","top","black",["casual","party"],[]],["Blue denim jeans","bottom","denim",["casual","date","party"],[]],
    ["Beige chinos","bottom","beige",["work","casual","date"],[]],["Black trousers","bottom","black",["work","party"],[]],
    ["White pyjama","bottom","white",["ethnic"],[]],["Grey joggers","bottom","grey",["sport","casual"],[]],
    ["White sneakers","shoes","white",["casual","date","sport"],[]],["Brown loafers","shoes","brown",["work","date","party","ethnic"],[]],
    ["Olive bomber jacket","layer","olive",["casual","date","party"],["cold","mild"]],["Tan leather watch","acc","brown",["work","date","ethnic","party","casual"],[]]
  ].map(([name,type,color,styles,seasons])=>({id:uid(),name,type,color,styles,seasons,photo:""}));
  if(cloud){ for(const it of sample) await cloud.itemsCol.doc(it.id).set(it); }
  else { S.items=S.items.concat(sample); lsSave(); renderAll(true); }
}

/* ---------- AI stylist (optional) ---------- */
let aiAvailable=false, sampleFn=null, aiCtl=null;
async function initAi(){
  if(!window.claude || typeof window.claude.use!=="function") return;
  try{ sampleFn = await window.claude.use("sample"); aiAvailable = !!sampleFn; renderAll(); }catch(e){}
}
$("stopAi").onclick = ()=>aiCtl?.abort();
$("askAi").onclick = async ()=>{
  const pool = S.items; const byId = Object.fromEntries(pool.map(i=>[i.id,i]));
  const list = pool.map(i=>`${i.id} | ${i.name} | ${TMAP[i.type]} | ${CMAP[i.color]?.n} | good for: ${(i.styles||[]).join(", ")||"any"} | weather: ${(i.seasons||[]).join(", ")||"any"}`).join("\n");
  const occ = STYLES.find(s=>s.k===S.occasion).n, wx = WX.find(w=>w.k===S.weather).n;
  const prompt = `You are a friendly personal stylist. Using ONLY the clothes listed below, suggest 3 different outfits for this plan: occasion "${occ}", weather "${wx}".
Each outfit needs either a top + bottom or a one-piece, plus shoes if available; add a layer or accessory only if it helps. Consider colour harmony and the occasion.
Clothes (id | name | type | colour | good for | weather):
${list}
Reply with ONLY JSON, no other text, shaped exactly like:
{"outfits":[{"ids":["id1","id2","id3"],"why":"one short friendly sentence, max 20 words"}]}`;
  $("askAi").disabled=true; $("stopAi").hidden=false; $("aiStatus").textContent="Thinking…"; $("aiLooks").innerHTML="";
  aiCtl = new AbortController();
  try{
    const data = await sampleFn.json(prompt,{signal:aiCtl.signal});
    const outs = (data?.outfits||[]).map(o=>({pieces:(o.ids||[]).map(id=>byId[id]).filter(Boolean), why:String(o.why||"").slice(0,160)})).filter(o=>o.pieces.length>=2);
    if(!outs.length){ $("aiStatus").textContent="The stylist didn't return usable outfits. Try again."; }
    else { $("aiStatus").textContent=""; for(const o of outs) $("aiLooks").append(lookCard(o.pieces,{why:o.why, saved:!!isSaved(o.pieces.map(p=>p.id)), onSave:(ev)=>{toggleSave(o.pieces,o.why); ev.target.setAttribute("aria-pressed","true"); ev.target.textContent="Saved";}})); }
  }catch(e){
    const map={cancelled:"Stopped.",not_granted:"The stylist needs your permission to run. Allow it when asked, or keep using the colour-matched outfits above.",rate_limited:"Too many requests just now. Wait a minute and try again."};
    $("aiStatus").textContent = map[e?.code] || "The stylist couldn't answer right now. Try again in a moment.";
    if(e?.code==="not_granted"){ aiAvailable=false; $("aiBox").hidden=true; }
  }finally{ $("askAi").disabled=false; $("stopAi").hidden=true; }
};

/* ---------- boot ---------- */
if(ME){ $("hello").textContent = "Hi, " + (ME.name || ME.email).split(" ")[0]; }
$("logout").onclick = ()=>{ if(window.Auth){ Auth.signOut(); window.location.replace("login.html"); } };
lsLoad(); renderAll(true);
note("Your wardrobe is saved in this browser.");
initCloud(); initAi();
