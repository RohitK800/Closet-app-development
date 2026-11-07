/*
  app.js — Closet
  Sections (search for the ===== lines to jump between them):
   1. Reference data      colours, clothing types, fits, occasions, weather
   2. Storage             saving to this browser, backup and restore
   3. Harmony Logic       how outfits are scored (colour, fit, Magic Mix)
   4. Helpers             small tools used everywhere
   5. Style me tab        outfit cards, wear / save / share, complete the look
   6. My clothes tab      search, filters, clothing cards, in the wash, style it
   7. Saved tab
   8. Add / edit dialog   including colour detection from photos
   9. Weather             live weather from Open-Meteo (free, no key)
  10. Start-up
*/
"use strict";

/* ===== 1. Reference data ===== */
const COLORS = [
  {k:"black",n:"Black",h:"#1C1C1E",neutral:1},{k:"white",n:"White",h:"#F7F7F4",neutral:1},
  {k:"cream",n:"Cream",h:"#EFE4CC",neutral:1},{k:"grey",n:"Grey",h:"#9A9CA1",neutral:1},
  {k:"navy",n:"Navy",h:"#24314F",neutral:1},{k:"denim",n:"Denim blue",h:"#4C6C96",neutral:1},
  {k:"beige",n:"Beige",h:"#D9C6A5",neutral:1},{k:"brown",n:"Brown",h:"#7A5236",neutral:1},
  {k:"olive",n:"Olive",h:"#6A6B3B",neutral:1},
  {k:"maroon",n:"Maroon",h:"#6E1F2B"},{k:"red",n:"Red",h:"#C9312F"},{k:"rust",n:"Rust",h:"#B5522E"},
  {k:"orange",n:"Orange",h:"#E07B2E"},{k:"peach",n:"Peach",h:"#F2B79F"},{k:"pink",n:"Pink",h:"#E9A5B7"},
  {k:"mustard",n:"Mustard",h:"#C99A2E"},{k:"yellow",n:"Yellow",h:"#E9C443"},{k:"green",n:"Green",h:"#3E8A5A"},
  {k:"teal",n:"Teal",h:"#2E7D7A"},{k:"sky",n:"Sky blue",h:"#9CC4E7"},{k:"purple",n:"Purple",h:"#6C4A8B"},
  {k:"print",n:"Print / multi",h:"conic-gradient(#C9312F,#E9C443,#3E8A5A,#4C6C96,#C9312F)"}
];
const CMAP = Object.fromEntries(COLORS.map(c => [c.k, c]));
// Bright colours that look good together (neutrals go with everything)
const GOOD_PAIRS = new Set([
  "sky|pink","sky|yellow","sky|orange","green|pink","purple|pink","maroon|sky","maroon|pink","red|sky",
  "green|sky","yellow|purple","orange|green","maroon|mustard","teal|peach","teal|mustard","rust|teal",
  "teal|pink","rust|sky","peach|sky","mustard|purple","peach|green"
].flatMap(p => { const [a, b] = p.split("|"); return [a + "|" + b, b + "|" + a]; }));

const TYPES = [
  {k:"top",n:"Top"},{k:"bottom",n:"Bottom"},{k:"dress",n:"Dress / one-piece"},
  {k:"set",n:"Ethnic set (saree, suit)"},{k:"layer",n:"Jacket / layer"},{k:"shoes",n:"Shoes"},{k:"acc",n:"Accessory"}
];
const TMAP = Object.fromEntries(TYPES.map(t => [t.k, t.n]));
const SHORT_TYPE = {top:"Top",bottom:"Bottom",dress:"Dress",set:"Ethnic set",layer:"Layer",shoes:"Shoes",acc:"Accessory"};
const FITS = [{k:"slim",n:"Slim"},{k:"regular",n:"Regular"},{k:"loose",n:"Loose"}];
const STYLES = [{k:"casual",n:"Casual"},{k:"work",n:"Office"},{k:"party",n:"Party"},{k:"ethnic",n:"Ethnic / festive"},{k:"date",n:"Date"},{k:"sport",n:"Gym / sport"}];
const WX = [{k:"hot",n:"Hot"},{k:"mild",n:"Pleasant"},{k:"cold",n:"Cold"},{k:"rain",n:"Rainy"}];
const SEASONS = [{k:"hot",n:"Hot"},{k:"mild",n:"Pleasant"},{k:"cold",n:"Cold"}];
const DAY = 864e5;

/* ===== 2. Storage ===== */
// Each signed-in person gets their own wardrobe on this browser.
const ME = (window.Auth && Auth.current()) || null;
const LS_KEY = "closet-v1" + (ME ? ":" + ME.email : "");

const S = {
  items: [], saved: [], log: [], prefs: { autoWeather: false },
  occasion: "casual", weather: "hot", pin: null,
  typeFilter: "all", q: "", fColor: "", fOcc: "", fSeason: "", sort: "type",
  seen: new Set(), looks: [], allCount: 0
};

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    S.items = (d.items || []).map(normaliseItem);
    S.saved = d.saved || [];
    S.log = d.log || [];
    S.prefs = Object.assign({ autoWeather: false }, d.prefs || {});
  } catch (e) { /* start empty */ }
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ items: S.items, saved: S.saved, log: S.log.slice(-300), prefs: S.prefs }));
    return true;
  } catch (e) {
    toast("Storage is full. Remove a few photos or download a backup.", "warn");
    return false;
  }
}
// Fills in fields that older saved items don't have yet
function normaliseItem(it) {
  return Object.assign({ fit: "", styles: [], seasons: [], photo: "", wornCount: 0, lastWorn: null, wash: false, added: Date.now() }, it);
}

function exportBackup() {
  const data = { app: "closet", version: 2, exportedAt: new Date().toISOString(), items: S.items, saved: S.saved, log: S.log };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  downloadBlob(blob, "closet-backup-" + todayStr() + ".json");
  toast("Backup downloaded");
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    const ok = d && d.app === "closet" && Array.isArray(d.items) && d.items.every(i => i && i.id && i.name && i.type && i.color);
    if (!ok) throw new Error("bad");
    const msg = S.items.length
      ? `Replace your closet (${S.items.length} pieces) with this backup (${d.items.length} pieces)?`
      : `Restore ${d.items.length} pieces from this backup?`;
    if (!confirm(msg)) return;
    S.items = d.items.map(normaliseItem);
    S.saved = Array.isArray(d.saved) ? d.saved : [];
    S.log = Array.isArray(d.log) ? d.log : [];
    S.pin = null;
    if (save()) toast("Closet restored");
    refreshAll(true);
  } catch (e) {
    toast("That file isn't a Closet backup.", "warn");
  }
}

/* ===== 3. Harmony Logic ===== */
function colorScore(keys) {
  const bright = [...new Set(keys.filter(k => !CMAP[k]?.neutral))];
  let s = 0; const why = [];
  if (bright.length === 0) { s += 2; why.push("Safe neutral combo"); }
  else if (bright.length === 1) { s += 4; why.push(CMAP[bright[0]].n + " pops against neutrals"); }
  else if (bright.length === 2) {
    if (bright.includes("print")) s -= 4;
    else if (GOOD_PAIRS.has(bright[0] + "|" + bright[1])) { s += 3; why.push(CMAP[bright[0]].n + " and " + CMAP[bright[1]].n.toLowerCase() + " work well together"); }
    else s -= 3;
  } else s -= 6;
  if (keys.filter(k => k === "print").length > 1) s -= 5;
  if (keys[0] && keys[0] === keys[1] && CMAP[keys[0]]?.neutral) { s -= 1; why.push("Tonal look"); }
  return { s, why: why[0] || "" };
}
// Silhouette: two loose pieces look shapeless; one loose + one fitted is balanced
function fitScore(pieces) {
  const top = pieces.find(p => p.type === "top"), bottom = pieces.find(p => p.type === "bottom");
  if (!top || !bottom || !top.fit || !bottom.fit) return { s: 0, why: "" };
  if (top.fit === "loose" && bottom.fit === "loose") return { s: -2, why: "" };
  if (top.fit !== bottom.fit && (top.fit === "loose" || bottom.fit === "loose")) return { s: 1, why: "Loose and fitted pieces balance each other" };
  return { s: 0, why: "" };
}
// Magic Mix: rest what you wore recently, bring back what you've forgotten
function freshness(pieces) {
  let s = 0, revive = null;
  for (const p of pieces) {
    if (p.type === "acc") continue;
    const d = p.lastWorn ? daysSince(p.lastWorn) : Infinity;
    if (d < 2) s -= 3;
    else if (d < 6) s -= 1;
    else if (d >= 21 && daysSince(p.added || Date.now()) >= 21) { s += 1; if (!revive) revive = p; }
  }
  let why = "";
  if (revive) why = "Brings back your " + revive.name.toLowerCase() + (revive.lastWorn ? ", not worn in " + ago(revive.lastWorn, true) : ", not worn yet");
  return { s, why };
}
function fits(it, occ, wx) {
  const styleOk = !it.styles?.length || it.styles.includes(occ);
  const seasonOk = !it.seasons?.length || it.seasons.includes(wx) || (wx === "rain" && it.seasons.includes("mild"));
  return styleOk && seasonOk;
}

function buildLooks(opts = {}) {
  const { items = S.items, occ = S.occasion, wx = S.weather, pin = S.pin, magic = true, jitter = true, withAcc = true } = opts;
  const pinItem = pin ? items.find(i => i.id === pin) : null;
  const pool = items.filter(it => !it.wash && (it === pinItem || fits(it, occ, wx)));
  const by = t => pool.filter(i => i.type === t);
  const tops = by("top"), bottoms = by("bottom"), shoes = by("shoes"), layers = by("layer"), accs = by("acc");

  let bases = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of [...by("dress"), ...by("set")]) bases.push([d]);
  if (pinItem && ["top", "bottom", "dress", "set"].includes(pinItem.type)) bases = bases.filter(b => b.includes(pinItem));

  const shoeOpts = pinItem?.type === "shoes" ? [pinItem] : (shoes.length ? shoes : [null]);
  let layerOpts = (wx === "cold" && layers.length) ? layers : (layers.length && wx !== "hot" ? [null, ...layers] : [null]);
  if (pinItem?.type === "layer") layerOpts = [pinItem];

  const looks = [];
  for (const base of bases) for (const sh of shoeOpts) for (const ly of layerOpts) {
    const pieces = [ly, ...base, sh].filter(Boolean);
    const cs = colorScore(pieces.map(p => p.color));
    const fs = fitScore(pieces);
    const fr = magic ? freshness(pieces) : { s: 0, why: "" };
    let score = cs.s + fs.s + fr.s;
    if (wx === "cold" && !ly && layers.length) score -= 2;
    if (sh && ["white", "black", "brown", "beige", "cream"].includes(sh.color)) score += 0.5;

    let acc = null;
    if (pinItem?.type === "acc") acc = pinItem;
    else if (withAcc && accs.length) {
      let best = -99;
      for (const a of accs) { const s2 = colorScore(pieces.concat(a).map(p => p.color)).s; if (s2 > best) { best = s2; acc = a; } }
      if (best < cs.s - 1) acc = null;
    }
    const all = acc ? pieces.concat(acc) : pieces;
    const ids = all.map(p => p.id);
    looks.push({
      key: keyOf(ids), ids,
      base: cs.s + fs.s,
      score: score + (jitter ? Math.random() * 1.5 : 0),
      why: [fr.why, cs.why, fs.why].filter(Boolean).slice(0, 2).join(". ")
    });
  }
  const dedup = new Map();
  for (const l of looks) if (!dedup.has(l.key) || dedup.get(l.key).score < l.score) dedup.set(l.key, l);
  const floor = pinItem ? -6 : -2;
  return [...dedup.values()].filter(l => l.score > floor).sort((a, b) => b.score - a.score);
}

function pickLooks(fresh) {
  const all = buildLooks();
  if (fresh) S.seen.clear();
  let pool = all.filter(l => !S.seen.has(l.key));
  if (pool.length < Math.min(6, all.length)) { S.seen.clear(); pool = all; }
  const pick = varied(pool, 6);
  pick.forEach(l => S.seen.add(l.key));
  S.looks = pick;
  S.allCount = all.length;
}
// Variety: once a piece appears in a suggestion, outfits repeating it rank a little lower
function varied(list, n) {
  const uses = {}, out = [], rest = list.slice();
  while (out.length < n && rest.length) {
    let bi = 0, bs = -Infinity;
    rest.forEach((l, i) => {
      const s = l.score - 1.6 * l.ids.reduce((t, id) => { const it = byId(id); return t + (it && it.type !== "acc" && it.type !== "shoes" && id !== S.pin ? (uses[id] || 0) : 0); }, 0);
      if (s > bs) { bs = s; bi = i; }
    });
    const l = rest.splice(bi, 1)[0];
    l.ids.forEach(id => uses[id] = (uses[id] || 0) + 1);
    out.push(l);
  }
  return out;
}

// Complete the look: which one neutral piece would unlock the most new outfits?
function completeTip() {
  if (S.items.length < 3) return null;
  const opts = { occ: S.occasion, wx: S.weather, pin: null, magic: false, jitter: false, withAcc: false };
  const good = items => buildLooks(Object.assign({ items }, opts)).filter(l => l.base > 0).length;
  const now = good(S.items);
  const colours = ["white", "black", "navy", "beige", "denim", "brown", "grey", "olive"];
  let best = null;
  for (const type of ["top", "bottom", "shoes"]) for (const color of colours) {
    if (S.items.some(i => i.type === type && i.color === color && !i.wash)) continue;
    const fake = normaliseItem({ id: "__new", name: "new", type, color, styles: [S.occasion], fit: "regular" });
    const gain = good(S.items.concat(fake)) - now;
    if (!best || gain > best.gain) best = { type, color, gain };
  }
  return best && best.gain >= 2 ? best : null;
}
function pieceLabel(type, color) {
  const c = CMAP[color].n.toLowerCase();
  if (type === "shoes") return c + " shoes";
  if (type === "top") return "a " + c + " top";
  if (type === "bottom") return color === "denim" ? "blue jeans" : c + " trousers";
  return "a " + c + " piece";
}

/* ===== 4. Helpers ===== */
const $ = id => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const keyOf = ids => [...ids].sort().join("+");
const byId = id => S.items.find(i => i.id === id);
function todayStr(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysSince(ts) { return Math.floor((Date.now() - ts) / DAY); }
function ago(ts, bare) {
  const d = daysSince(ts);
  if (d <= 0) return bare ? "a day" : "today";
  if (d === 1) return bare ? "a day" : "yesterday";
  if (d < 14) return d + " days" + (bare ? "" : " ago");
  if (d < 60) return Math.round(d / 7) + " weeks" + (bare ? "" : " ago");
  return Math.round(d / 30) + " months" + (bare ? "" : " ago");
}
function textOn(hex) { if (!hex.startsWith("#")) return "#fff"; const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1D2130" : "#fff"; }
// A piece's picture: its photo if it has one, otherwise a drawing of the garment in its colour
function fabric(it, cls) {
  if (it.photo) return el("div", { class: cls }, el("img", { src: it.photo, alt: "" }));
  const box = el("div", { class: cls + " illus" });
  box.innerHTML = (it.type === "shoes" || it.type === "acc") ? shelfSvg(it) : garmentSvg(it, true);
  return box;
}
function chipGroup(host, opts, getVal, setVal, multi, justTapped) {
  host.innerHTML = "";
  opts.forEach((o, n) => {
    const on = multi ? getVal().includes(o.k) : getVal() === o.k;
    host.append(el("button", { type: "button", class: "chip" + (o.k === justTapped ? " just" : ""), style: "--n:" + n, "aria-pressed": String(on), onclick: () => {
      if (multi) { const v = getVal(); setVal(v.includes(o.k) ? v.filter(x => x !== o.k) : v.concat(o.k)); } else setVal(o.k);
      chipGroup(host, opts, getVal, setVal, multi, o.k);
    } }, o.n));
  });
}
function downloadBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// Clothing-tag messages
function toast(msg, kind) {
  const host = $("toasts");
  while (host.children.length > 2) host.firstChild.remove();
  const t = el("div", { class: "tag-toast" + (kind ? " " + kind : "") }, el("span", { class: "hole", "aria-hidden": "true" }), el("span", {}, msg));
  host.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
}
function swing(on) { $("brandIcon").classList.toggle("swinging", on); }
const icon = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};
function iconEl(name) { const s = el("span", { class: "ico" }); s.innerHTML = icon[name]; return s; }

/* ===== 5. Style me tab ===== */
function wornTodayEntry(key) { const t = todayStr(); return S.log.find(e => e.key === key && e.day === t); }
function toggleWear(ids) {
  const key = keyOf(ids), ex = wornTodayEntry(key);
  if (ex) {
    for (const id of ex.ids) { const it = byId(id); if (it) { it.wornCount = Math.max(0, (it.wornCount || 0) - 1); it.lastWorn = ex.prev[id] || null; } }
    S.log.splice(S.log.indexOf(ex), 1);
    toast("Removed from today");
  } else {
    const prev = {};
    for (const id of ids) { const it = byId(id); if (it) { prev[id] = it.lastWorn || null; it.wornCount = (it.wornCount || 0) + 1; it.lastWorn = Date.now(); } }
    S.log.push({ key, ids, day: todayStr(), at: Date.now(), prev });
    toast("Marked as worn today");
  }
  save(); renderLooks(false); renderSaved(); renderGrid();
}
function savedEntry(ids) { const k = keyOf(ids); return S.saved.find(s => keyOf(s.ids) === k); }
function toggleSave(ids, why) {
  const ex = savedEntry(ids);
  if (ex) { S.saved = S.saved.filter(s => s !== ex); toast("Removed from saved"); }
  else { S.saved.push({ id: uid(), ids, why: why || "", at: Date.now() }); toast("Look saved"); }
  save(); renderLooks(false); renderSaved();
}

function lookCard(pieces, { why = "", animate = false, idx = 0, onRemove } = {}) {
  const ids = pieces.map(p => p.id), key = keyOf(ids);
  const worn = !!wornTodayEntry(key), saved = !!savedEntry(ids);
  const card = el("article", { class: "look" + (animate ? " dress" : ""), style: `--i:${idx}` });
  pieces.forEach((p, j) => card.append(
    el("div", { class: "piece", style: `--j:${j}` }, fabric(p, "fab"),
      el("div", { class: "t" }, el("b", {}, p.name), el("span", {}, SHORT_TYPE[p.type] + " · " + (CMAP[p.color]?.n || ""))))
  ));
  if (why) card.append(el("p", { class: "why" }, why));
  const wearBtn = el("button", { type: "button", class: "save wear", "aria-pressed": String(worn), onclick: () => toggleWear(ids) },
    worn ? [iconEl("check"), "Worn today"] : "Wear today");
  const actions = el("footer", {}, wearBtn);
  if (onRemove) actions.append(el("button", { type: "button", class: "save", onclick: onRemove }, "Remove"));
  else actions.append(el("button", { type: "button", class: "save", "aria-pressed": String(saved), onclick: () => toggleSave(ids, why) }, saved ? "Saved" : "Save"));
  actions.append(el("button", { type: "button", class: "save icon-btn", "aria-label": "Share this outfit", title: "Share", onclick: () => shareLook(pieces) }, iconEl("share")));
  card.append(actions);
  return card;
}

function renderLooks(animate) {
  const host = $("looks"); host.innerHTML = "";
  renderPinbar();
  const active = S.items.filter(i => !i.wash);
  const hasBase = (active.some(i => i.type === "top") && active.some(i => i.type === "bottom")) || active.some(i => i.type === "dress" || i.type === "set");
  if (!S.items.length) {
    host.append(el("div", { class: "empty" }, el("strong", {}, "Your closet is empty"),
      "Add a few tops, bottoms and shoes to get outfit ideas, or load a sample closet to see how it works.",
      el("div", { class: "row center" },
        el("button", { class: "btn", onclick: () => { switchTab("wardrobe"); openItem(); } }, "Add a piece"),
        el("button", { class: "btn ghost", onclick: loadSample }, "Load sample closet"))));
    $("shuffle").hidden = true; $("looksSub").textContent = "Picked by Harmony Logic from your own clothes."; return;
  }
  $("shuffle").hidden = false;
  const looks = S.looks.map(l => ({ l, pieces: l.ids.map(byId).filter(Boolean) })).filter(x => x.pieces.length === x.l.ids.length);
  if (!looks.length) {
    let msg = !hasBase ? "Add at least one top and one bottom, or a dress or ethnic set, to start pairing."
      : "Nothing in your closet is tagged for this plan and weather. Try another option, or add pieces tagged for it.";
    if (S.pin) msg = "No outfits with this piece yet. Add something that goes with it, or try another occasion.";
    host.append(el("div", { class: "empty" }, el("strong", {}, "No outfits yet"), msg));
    $("looksSub").textContent = ""; return;
  }
  $("looksSub").textContent = `Harmony Logic found ${S.allCount} combination${S.allCount === 1 ? "" : "s"}, matched on colour, fit and what you wore recently.`;
  looks.forEach(({ l, pieces }, i) => host.append(lookCard(pieces, { why: l.why, animate, idx: i })));
}
function renderPinbar() {
  const bar = $("pinbar"), it = S.pin && byId(S.pin);
  if (!it) { bar.hidden = true; return; }
  bar.hidden = false; bar.innerHTML = "";
  bar.append(fabric(it, "pin-fab"), el("span", {}, "Outfits with ", el("b", {}, it.name)),
    el("button", { type: "button", class: "linkish", onclick: () => { S.pin = null; pickLooks(true); renderLooks(true); renderTip(); } }, "Show all outfits"));
}
function renderTip() {
  const host = $("tip"); host.innerHTML = "";
  if (S.pin) return;
  const t = completeTip(); if (!t) return;
  const occ = STYLES.find(s => s.k === S.occasion).n.toLowerCase();
  const wx = WX.find(w => w.k === S.weather).n.toLowerCase();
  host.append(el("aside", { class: "tip" },
    el("div", { class: "tip-swatch", style: "background:" + CMAP[t.color].h, "aria-hidden": "true" }),
    el("div", {}, el("b", {}, "Complete the look"),
      el("p", {}, "Adding ", el("strong", {}, pieceLabel(t.type, t.color)), " would give you ", el("strong", {}, t.gain + " more"), ` ${occ} outfits for ${wx} days.`))));
}

// Share: draws the outfit as an image, then opens the phone's share menu (or downloads it)
async function shareLook(pieces) {
  try {
    const blob = await outfitImage(pieces);
    const text = "My outfit from Closet: " + pieces.map(p => p.name).join(" + ");
    const file = new File([blob], "closet-outfit.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: "My Closet outfit" }); }
      catch (e) { if (e.name !== "AbortError") throw e; }
      return;
    }
    downloadBlob(blob, "closet-outfit.png");
    toast("Outfit image downloaded");
  } catch (e) { toast("Couldn't create the outfit image.", "warn"); }
}
async function outfitImage(pieces) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#F1ECE2"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(29,33,48,.035)"; g.lineWidth = 1;
  for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = "#1D2130"; g.font = "800 64px Outfit, sans-serif"; g.fillText("Closet", 72, 120);
  g.fillStyle = "#E9C443"; g.fillRect(72, 150, W - 144, 16);
  g.fillStyle = "#1D2130"; for (let x = 72; x < W - 72; x += 18) g.fillRect(x, 150, 2, x % 90 === 0 ? 12 : 7);
  const n = pieces.length, top = 210, avail = H - top - 150, row = Math.min(250, avail / n), sq = row - 30;
  for (let i = 0; i < n; i++) {
    const p = pieces[i], y = top + i * row, col = CMAP[p.color] || CMAP.grey;
    roundRect(g, 72, y, sq, sq, 22);
    g.save(); g.clip();
    if (p.photo) {
      const img = new Image(); img.src = p.photo; await img.decode();
      const s = Math.max(sq / img.width, sq / img.height);
      g.drawImage(img, 72 + (sq - img.width * s) / 2, y + (sq - img.height * s) / 2, img.width * s, img.height * s);
    } else if (col.h.startsWith("#")) { g.fillStyle = col.h; g.fill(); }
    else { ["#C9312F", "#E9C443", "#3E8A5A", "#4C6C96"].forEach((h, k) => { g.fillStyle = h; g.fillRect(72 + k * sq / 4, y, sq / 4 + 1, sq); }); }
    g.restore();
    g.fillStyle = "#1D2130"; g.font = "700 46px Outfit, sans-serif"; g.fillText(fitText(g, p.name, W - 140 - sq - 72), 72 + sq + 40, y + sq / 2 - 6);
    g.fillStyle = "#5E6372"; g.font = "400 32px Outfit, sans-serif"; g.fillText(SHORT_TYPE[p.type] + " · " + col.n, 72 + sq + 40, y + sq / 2 + 42);
  }
  g.fillStyle = "#5E6372"; g.font = "500 30px Outfit, sans-serif"; g.fillText("Styled with Closet", 72, H - 72);
  return new Promise(res => c.toBlob(res, "image/png"));
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitText(g, t, max) { if (g.measureText(t).width <= max) return t; while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1); return t + "…"; }

/* ===== 6. My clothes tab ===== */
function forgotten(it) { return it.type !== "acc" && (it.lastWorn ? daysSince(it.lastWorn) >= 30 : daysSince(it.added || Date.now()) >= 30); }
function wornText(it) {
  if (!it.wornCount) return forgotten(it) ? el("span", { class: "forgot" }, "Not worn in " + ago(it.added, true)) : "Not worn yet";
  const t = "Worn " + it.wornCount + "× · " + ago(it.lastWorn);
  return forgotten(it) ? el("span", { class: "forgot" }, t) : t;
}
function filteredItems() {
  const q = S.q.trim().toLowerCase();
  const list = S.items.filter(i =>
    (S.typeFilter === "all" || i.type === S.typeFilter) &&
    (!S.washOnly || i.wash) &&
    (!S.fColor || i.color === S.fColor) &&
    (!S.fOcc || !i.styles.length || i.styles.includes(S.fOcc)) &&
    (!S.fSeason || !i.seasons.length || i.seasons.includes(S.fSeason)) &&
    (!q || (i.name + " " + TMAP[i.type] + " " + (CMAP[i.color]?.n || "")).toLowerCase().includes(q)));
  const order = Object.fromEntries(TYPES.map((t, n) => [t.k, n]));
  const sorters = {
    type: (a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name),
    new: (a, b) => (b.added || 0) - (a.added || 0),
    least: (a, b) => (a.wornCount || 0) - (b.wornCount || 0) || (a.lastWorn || 0) - (b.lastWorn || 0),
    most: (a, b) => (b.wornCount || 0) - (a.wornCount || 0)
  };
  return list.sort(sorters[S.sort]);
}
/* --- The wardrobe illustration --- */
// Garment outlines, drawn in a 100 x 170 box with the hanger hook at the top centre
const HANGER = '<path d="M50 4c-5 0-8 3-8 7s7 4 8 9v4" fill="none" stroke="#3A2A1C" stroke-width="2.6" stroke-linecap="round"/>' +
  '<path d="M50 24 15 37h70z" fill="none" stroke="#C49A55" stroke-width="3.4" stroke-linejoin="round"/>';
const SHAPES = {
  top:    "M35 33 18 39 6 72l11 4 8-19v62q25 5 50 0V57l8 19 11-4-12-33-17-6q-15 9-30 0z",
  layer:  "M33 33 15 40 5 100l12 3 9-44v63h48V59l9 44 12-3-10-60-18-7q-17 8-34 0z",
  bottom: "M27 37h46l5 120H58L50 76l-8 81H22z",
  dress:  "M38 33 29 38l-4 26 9 2 3-14-14 98q27 7 54 0L63 52l3 14 9-2-4-26-9-5q-12 8-24 0z",
  set:    "M36 33 19 40 9 85l11 3 8-26-2 100h48l-2-100 8 26 11-3-10-45-17-7q-14 8-28 0z"
};
const DETAIL = {
  top:    '<path d="M42 35l8 9 8-9" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/>',
  layer:  '<path d="M50 44v77M37 36l13 8 13-8" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.6"/>',
  bottom: '<path d="M27 46h46M50 46v30" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/><path d="M24 37h52" stroke="#C49A55" stroke-width="3.4" stroke-linecap="round"/>',
  dress:  '<path d="M37 60q13 6 26 0" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/>',
  set:    '<path d="M64 36 32 162" stroke="rgba(255,255,255,.35)" stroke-width="9"/><path d="M50 40v26" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/>'
};
const SHOE = "M3 13q2-8 12-8l11 2q6 6 16 7 13 2 13 10v3H3z";
const WATCH = '<rect x="15" y="1" width="10" height="30" rx="4" fill="#5A3A22"/><circle cx="20" cy="16" r="10" fill="#E9D9A6" stroke="#8C6A26" stroke-width="2.5"/><path d="M20 10v6l4 3" stroke="#3A2A1C" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
const esc = s => String(s).replace(/[&"<>]/g, c => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
function fillFor(it, pid) {
  const c = CMAP[it.color] || CMAP.grey;
  if (it.photo && /^data:image\//.test(it.photo)) return { defs: `<pattern id="${pid}" patternUnits="objectBoundingBox" width="1" height="1"><image href="${esc(it.photo)}" width="100" height="170" preserveAspectRatio="xMidYMid slice"/></pattern>`, fill: `url(#${pid})` };
  if (!c.h.startsWith("#")) return { defs: `<linearGradient id="${pid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9312F"/><stop offset=".35" stop-color="#E9C443"/><stop offset=".65" stop-color="#3E8A5A"/><stop offset="1" stop-color="#4C6C96"/></linearGradient>`, fill: `url(#${pid})` };
  return { defs: "", fill: c.h };
}
function garmentSvg(it, noHanger) {
  const pid = "g" + it.id.replace(/[^a-z0-9]/gi, ""), f = fillFor(it, pid), shape = SHAPES[it.type] || SHAPES.top;
  return `<svg viewBox="${noHanger ? "0 28 100 138" : "0 0 100 170"}" aria-hidden="true"><defs>${f.defs}<linearGradient id="${pid}s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>` +
    (noHanger ? "" : HANGER) + `<path d="${shape}" fill="${f.fill}" stroke="rgba(0,0,0,.28)" stroke-width="1.4" stroke-linejoin="round"/><path d="${shape}" fill="url(#${pid}s)"/>` + (DETAIL[it.type] || "") + `</svg>`;
}
function shelfSvg(it) {
  const pid = "s" + it.id.replace(/[^a-z0-9]/gi, ""), f = fillFor(it, pid);
  if (it.type === "acc") return `<svg viewBox="0 0 40 32" class="acc" aria-hidden="true">${WATCH}</svg>`;
  return `<svg viewBox="0 0 58 28" aria-hidden="true"><defs>${f.defs}</defs><path d="${SHOE}" fill="${f.fill}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><rect x="2" y="24" width="54" height="4" rx="2" fill="rgba(0,0,0,.45)"/></svg>`;
}
const RAIL_ORDER = ["layer", "top", "set", "dress", "bottom"];
function renderWardrobe() {
  const rail = $("rail"), shelf = $("shelf");
  rail.innerHTML = ""; shelf.innerHTML = "";
  const shown = new Set(filteredItems().map(i => i.id));
  const filtering = S.items.length && shown.size !== S.items.length;
  const hang = S.items.filter(i => RAIL_ORDER.includes(i.type) && !i.wash).sort((a, b) => RAIL_ORDER.indexOf(a.type) - RAIL_ORDER.indexOf(b.type));
  const sit = S.items.filter(i => (i.type === "shoes" || i.type === "acc") && !i.wash);

  const piece = (it, cls, svg) => {
    const b = el("button", { type: "button", role: "listitem", class: cls + (filtering && !shown.has(it.id) ? " dim" : ""), "aria-label": it.name + ", " + (CMAP[it.color]?.n || "") + ". Edit", onclick: () => openItem(it) });
    b.innerHTML = svg;
    b.append(el("span", { class: "gtag" }, it.name));
    return b;
  };
  const addSlot = (type, label, cls) => {
    const b = el("button", { type: "button", role: "listitem", class: cls + " add-slot", "aria-label": "Add " + label.toLowerCase(), onclick: () => openItem(null, type) });
    b.innerHTML = cls === "garment"
      ? `<svg viewBox="0 0 100 170" aria-hidden="true">${HANGER}<path class="ghost-shape" d="${SHAPES[type] || SHAPES.top}"/></svg>`
      : `<svg viewBox="0 0 58 28" aria-hidden="true"><path class="ghost-shape" d="${type === "acc" ? "M20 4a10 10 0 1 0 .1 0z" : SHOE}" transform="${type === "acc" ? "translate(9 2)" : ""}"/></svg>`;
    b.append(el("span", { class: "add-tag" }, "+ " + label));
    return b;
  };

  $("wardrobe").classList.toggle("is-empty", !hang.length && !sit.length);
  hang.forEach(it => rail.append(piece(it, "garment", garmentSvg(it))));
  if (!hang.length) [["top", "Top"], ["bottom", "Bottom"], ["dress", "Dress"], ["set", "Ethnic set"], ["layer", "Jacket"]].forEach(([t, l]) => rail.append(addSlot(t, l, "garment")));
  else rail.append(addSlot("top", "Add", "garment"));

  sit.forEach(it => shelf.append(piece(it, "shelf-item", shelfSvg(it))));
  if (!sit.length) { shelf.append(addSlot("shoes", "Shoes", "shelf-item")); shelf.append(addSlot("acc", "Accessory", "shelf-item")); }
  const nWash = S.items.filter(i => i.wash).length;
  if (nWash) shelf.append(el("button", { type: "button", class: "basket" + (S.washOnly ? " on" : ""), "aria-pressed": String(!!S.washOnly),
    title: "Show what's in the wash", onclick: () => { S.washOnly = !S.washOnly; renderGrid(); } },
    el("span", { class: "basket-ico", "aria-hidden": "true" }), nWash + " in the wash"));
}
function openDoors() {
  const w = $("wardrobe");
  if (w.dataset.opened) return;
  w.dataset.opened = "1";
  w.classList.add("opening");
  // Remove the doors once they've swung open (or straight away if animations are off)
  const done = () => w.querySelectorAll(".door").forEach(d => d.classList.add("gone"));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
  else setTimeout(done, 1400);
}
function filterCount() { return [S.fColor, S.fOcc, S.fSeason].filter(Boolean).length + (S.washOnly ? 1 : 0); }

function renderGrid() {
  const host = $("grid"); host.innerHTML = "";
  $("cnt").textContent = S.items.length ? ` ${S.items.length}` : "";
  moveTabInk(); // the count changes the tab's width
  const nForgot = S.items.filter(forgotten).length, nWash = S.items.filter(i => i.wash).length;
  $("closetSummary").textContent = S.items.length
    ? [S.items.length + " pieces", nForgot && nForgot + " not worn in a month", nWash && nWash + " in the wash"].filter(Boolean).join(" · ")
    : "Tap a hanger to add your first piece.";
  renderWardrobe();

  // Empty closet: keep the page calm, no search or filters yet
  const empty = !S.items.length;
  $("closetTools").hidden = empty;
  $("closetEmpty").innerHTML = "";
  if (empty) {
    $("closetEmpty").append(el("div", { class: "empty" }, el("strong", {}, "Your wardrobe is empty"),
      "Tap any hanger above to add that kind of piece, or load a sample closet to explore.",
      el("div", { class: "row center" },
        el("button", { class: "btn", onclick: () => openItem() }, "Add a piece"),
        el("button", { class: "btn ghost", onclick: loadSample }, "Load sample closet"))));
    return;
  }
  const n = filterCount();
  $("filterCount").hidden = !n; $("filterCount").textContent = n;

  chipGroup($("typeFilter"), [{ k: "all", n: "All" }, ...TYPES.map(t => ({ k: t.k, n: SHORT_TYPE[t.k] }))], () => S.typeFilter, v => { S.typeFilter = v; renderGrid(); });
  const list = filteredItems();
  if (!list.length) {
    host.append(el("div", { class: "empty" }, el("strong", {}, "Nothing matches"), "Try clearing the search or filters."));
    return;
  }
  for (const it of list) {
    host.append(el("article", { class: "item" + (it.wash ? " is-wash" : "") },
      el("button", { type: "button", class: "pic-btn", "aria-label": "Edit " + it.name, onclick: () => openItem(it) },
        fabric(it, "pic"), it.wash ? el("span", { class: "wash-badge" }, "In the wash") : null),
      el("div", { class: "meta" },
        el("button", { type: "button", class: "nm", onclick: () => openItem(it) }, it.name),
        el("div", { class: "tg" }, [SHORT_TYPE[it.type], CMAP[it.color]?.n, FITS.find(f => f.k === it.fit)?.n].filter(Boolean).join(" · ")),
        el("div", { class: "worn" }, wornText(it)),
        el("div", { class: "acts" },
          el("button", { type: "button", class: "mini", disabled: it.wash, onclick: () => styleThis(it) }, "Style it"),
          el("button", { type: "button", class: "mini", "aria-pressed": String(!!it.wash), onclick: () => toggleWash(it) }, it.wash ? "Back in closet" : "In the wash")))));
  }
}
function toggleWash(it) {
  it.wash = !it.wash;
  if (it.wash && S.pin === it.id) S.pin = null;
  save();
  toast(it.wash ? "In the wash. Left out of outfits" : "Back in your closet");
  refreshAll(false);
}
function styleThis(it) {
  S.pin = it.id;
  // If the piece isn't tagged for the current occasion (e.g. a kurta on "Casual"), switch to one it suits
  if (it.styles.length && !it.styles.includes(S.occasion)) {
    S.occasion = it.styles[0];
    chipGroup($("occ"), STYLES, () => S.occasion, onOccasion);
  }
  switchTab("style");
  pickLooks(true); renderLooks(true); renderTip();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function fillSelect(sel, first, opts) {
  sel.innerHTML = "";
  sel.append(el("option", { value: "" }, first));
  for (const o of opts) sel.append(el("option", { value: o.k }, o.n));
}

/* ===== 7. Saved tab ===== */
function renderSaved() {
  const host = $("savedLooks"); host.innerHTML = "";
  const list = S.saved.slice().sort((a, b) => b.at - a.at)
    .map(s => ({ s, pieces: s.ids.map(byId).filter(Boolean) })).filter(x => x.pieces.length);
  if (!list.length) { host.append(el("div", { class: "empty" }, el("strong", {}, "No saved outfits"), "Tap “Save” on any outfit you like.")); return; }
  for (const { s, pieces } of list) host.append(lookCard(pieces, { why: s.why, onRemove: () => { S.saved = S.saved.filter(x => x !== s); save(); renderSaved(); renderLooks(false); toast("Removed from saved"); } }));
}

/* ===== 8. Add / edit dialog ===== */
const F = {};
function openItem(it, presetType) {
  const editing = !!it;
  const type = presetType || "top";
  Object.assign(F, editing
    ? { id: it.id, type: it.type, color: it.color, colorManual: true, fit: it.fit || "", styles: it.styles.slice(), seasons: it.seasons.slice(), photo: it.photo || "" }
    : { id: null, type, color: "", colorManual: false, fit: ["shoes", "acc"].includes(type) ? "" : "regular", styles: type === "set" ? ["ethnic"] : ["casual"], seasons: [], photo: "" });
  $("dlgTitle").textContent = editing ? "Edit piece" : "Add a piece";
  $("fSave").textContent = editing ? "Save changes" : "Save piece";
  $("fDelete").hidden = !editing;
  $("fName").value = editing ? it.name : "";
  $("fPhoto").value = "";
  $("fPrev").innerHTML = "";
  if (F.photo) $("fPrev").append(el("img", { src: F.photo, alt: "" })); else $("fPrev").textContent = "No photo";
  $("fErr").textContent = "";
  drawForm();
  $("dlg").showModal();
  if (!editing) setTimeout(() => $("fName").focus(), 50);
}
function drawForm() {
  chipGroup($("fType"), TYPES, () => F.type, v => F.type = v);
  chipGroup($("fFit"), FITS, () => F.fit, v => F.fit = v);
  chipGroup($("fStyle"), STYLES, () => F.styles, v => F.styles = v, true);
  chipGroup($("fSeason"), SEASONS, () => F.seasons, v => F.seasons = v, true);
  const host = $("fColor"); host.innerHTML = "";
  for (const c of COLORS) host.append(el("button", { type: "button", class: "sw", title: c.n, "aria-label": c.n, "aria-pressed": String(F.color === c.k), style: "background:" + c.h,
    onclick: () => { F.color = c.k; F.colorManual = true; $("fColorName").textContent = c.n; drawForm(); } }));
  if (!F.color) $("fColorName").textContent = "Pick the main colour";
  else if (F.colorManual) $("fColorName").textContent = CMAP[F.color].n;
}
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = rej; img.src = url;
  });
}
// Auto colour: looks at the middle of the photo and finds the closest swatch
function detectColor(dataUrl) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = 48;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, 48, 48);
      const d = g.getImageData(12, 12, 24, 24).data, votes = {};
      const sw = COLORS.filter(x => x.h.startsWith("#")).map(x => { const n = parseInt(x.h.slice(1), 16); return { k: x.k, r: n >> 16, g: n >> 8 & 255, b: n & 255 }; });
      for (let i = 0; i < d.length; i += 4) {
        let best = null, bd = Infinity;
        for (const s of sw) {
          const rm = (d[i] + s.r) / 2, dr = d[i] - s.r, dg = d[i + 1] - s.g, db = d[i + 2] - s.b;
          const dist = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
          if (dist < bd) { bd = dist; best = s.k; }
        }
        votes[best] = (votes[best] || 0) + 1;
      }
      res(Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || null);
    };
    img.onerror = () => res(null);
    img.src = dataUrl;
  });
}
async function onPhoto(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    F.photo = await shrink(f, 360);
    $("fPrev").innerHTML = ""; $("fPrev").append(el("img", { src: F.photo, alt: "" }));
    if (!F.colorManual) {
      const k = await detectColor(F.photo);
      if (k) { F.color = k; drawForm(); $("fColorName").textContent = "Looks like " + CMAP[k].n + ". Tap another colour if that's wrong."; }
    }
  } catch (err) { $("fErr").textContent = "That photo couldn't be read. Try a JPG or PNG."; }
}
function saveItem() {
  const name = $("fName").value.trim();
  if (!name) { $("fErr").textContent = "Give it a name, like “Blue denim jeans”."; return; }
  if (!F.color) { $("fErr").textContent = "Pick a colour so it can be matched."; return; }
  const fields = { name, type: F.type, color: F.color, fit: F.fit, styles: F.styles, seasons: F.seasons, photo: F.photo || "" };
  if (F.id) Object.assign(byId(F.id), fields);
  else S.items.push(normaliseItem(Object.assign({ id: uid(), added: Date.now() }, fields)));
  if (!save()) return;
  $("dlg").close();
  toast(F.id ? "Changes saved" : "Added to your closet");
  refreshAll(false);
}
function deleteItem() {
  const it = byId(F.id); if (!it) return;
  if (!confirm("Remove “" + it.name + "” from your closet?")) return;
  S.items = S.items.filter(x => x !== it);
  S.saved = S.saved.filter(s => !s.ids.includes(it.id));
  if (S.pin === it.id) S.pin = null;
  save(); $("dlg").close();
  toast("Removed from your closet");
  refreshAll(false);
}

async function loadSample() {
  const now = Date.now(), d = n => now - n * DAY;
  const rows = [
    ["White cotton shirt", "top", "white", "regular", ["work", "casual", "date"], [], 5, d(1)],
    ["Navy polo", "top", "navy", "slim", ["casual", "sport"], ["hot", "mild"], 3, d(8)],
    ["Maroon kurta", "top", "maroon", "regular", ["ethnic", "party"], [], 0, null],
    ["Mustard kurta", "top", "mustard", "loose", ["ethnic", "party"], [], 1, d(40)],
    ["Sky blue linen shirt", "top", "sky", "loose", ["casual", "work", "date"], ["hot", "mild"], 2, d(25)],
    ["Black graphic tee", "top", "black", "regular", ["casual", "party"], [], 6, d(3)],
    ["Blue denim jeans", "bottom", "denim", "slim", ["casual", "date", "party"], [], 8, d(2)],
    ["Beige chinos", "bottom", "beige", "regular", ["work", "casual", "date"], [], 3, d(10)],
    ["Black trousers", "bottom", "black", "slim", ["work", "party"], [], 1, d(45)],
    ["White pyjama", "bottom", "white", "loose", ["ethnic"], [], 1, d(40)],
    ["Grey joggers", "bottom", "grey", "loose", ["sport", "casual"], [], 4, d(5)],
    ["White sneakers", "shoes", "white", "", ["casual", "date", "sport"], [], 10, d(1)],
    ["Brown loafers", "shoes", "brown", "", ["work", "date", "party", "ethnic"], [], 2, d(30)],
    ["Olive bomber jacket", "layer", "olive", "regular", ["casual", "date", "party"], ["cold", "mild"], 1, d(60)],
    ["Tan leather watch", "acc", "brown", "", ["work", "date", "ethnic", "party", "casual"], [], 0, null]
  ];
  S.items = S.items.concat(rows.map(([name, type, color, fit, styles, seasons, wornCount, lastWorn]) =>
    normaliseItem({ id: uid(), name, type, color, fit, styles, seasons, wornCount, lastWorn, added: d(70) })));
  save();
  toast("Sample closet added");
  refreshAll(true);
}

/* ===== 9. Weather ===== */
function setWeatherNote(t) { $("wxNote").textContent = t; }
async function autoWeather() {
  if (!navigator.geolocation) { setWeatherNote("This browser can't share location. Pick the weather yourself."); return; }
  swing(true); setWeatherNote("Checking today's weather…");
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, maximumAge: 30 * 60 * 1000 }));
    const { latitude: lat, longitude: lon } = pos.coords;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,precipitation,weather_code&timezone=auto`);
    if (!r.ok) throw new Error("http");
    const cur = (await r.json()).current;
    const t = cur.temperature_2m, code = cur.weather_code;
    const rainy = cur.precipitation > 0.1 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    const k = rainy ? "rain" : t >= 29 ? "hot" : t <= 18 ? "cold" : "mild";
    S.prefs.autoWeather = true; save();
    setWeather(k);
    setWeatherNote(`Now ${Math.round(t)}°C${rainy ? " with rain" : ""}, so it's set to ${WX.find(w => w.k === k).n.toLowerCase()}. Tap another option to change it.`);
  } catch (e) {
    if (e && e.code === 1) { S.prefs.autoWeather = false; save(); setWeatherNote("Location is turned off. Pick the weather yourself."); }
    else setWeatherNote("Couldn't get the weather right now. Pick it yourself.");
  } finally { swing(false); }
}
function setWeather(k) {
  S.weather = k;
  chipGroup($("wx"), WX, () => S.weather, v => { setWeather(v); setWeatherNote(""); });
  pickLooks(true); renderLooks(true); renderTip();
}

/* ===== 10. Start-up ===== */
function refreshAll(animate) { pickLooks(true); renderLooks(animate); renderTip(); renderGrid(); renderSaved(); }
const TAB_ORDER = ["style", "wardrobe", "saved"];
let currentTab = "style";
function switchTab(t) {
  const from = TAB_ORDER.indexOf(currentTab), to = TAB_ORDER.indexOf(t);
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  TAB_ORDER.forEach(k => $("tab-" + k).hidden = k !== t);
  moveTabInk();
  // Slide the new page in from the side you're moving towards
  if (t !== currentTab) {
    const sec = $("tab-" + t);
    sec.classList.remove("tab-in-left", "tab-in-right");
    void sec.offsetWidth; // restart the animation
    sec.classList.add(to > from ? "tab-in-right" : "tab-in-left");
    sec.addEventListener("animationend", function done(e) { if (e.target === sec) { sec.classList.remove("tab-in-left", "tab-in-right"); sec.removeEventListener("animationend", done); } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  currentTab = t;
  if (t === "wardrobe") openDoors();
}
// The highlight behind the selected tab glides to the new tab
function moveTabInk() {
  const btn = document.querySelector('nav.tabs button[aria-selected="true"]'), ink = $("tabInk");
  if (!btn || !ink) return;
  ink.style.width = btn.offsetWidth + "px";
  ink.style.transform = `translateX(${btn.offsetLeft}px)`;
}
window.addEventListener("resize", moveTabInk);
const motionOK = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
function onOccasion(v) { S.occasion = v; pickLooks(true); renderLooks(true); renderTip(); }
chipGroup($("occ"), STYLES, () => S.occasion, onOccasion);
chipGroup($("wx"), WX, () => S.weather, v => { setWeather(v); setWeatherNote(""); });
$("wxAuto").onclick = autoWeather;
$("shuffle").onclick = () => { pickLooks(false); renderLooks(true); };
$("addBtn").onclick = () => openItem();
$("fCancel").onclick = () => $("dlg").close();
$("fSave").onclick = saveItem;
$("fDelete").onclick = deleteItem;
$("fPhoto").onchange = onPhoto;
$("exportBtn").onclick = exportBackup;
$("importFile").onchange = e => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ""; };
document.querySelector('label[for="importFile"]').addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("importFile").click(); } });

fillSelect($("fColorSel"), "Any colour", COLORS.map(c => ({ k: c.k, n: c.n })));
fillSelect($("fOccSel"), "Any occasion", STYLES);
fillSelect($("fSeasonSel"), "Any weather", SEASONS);
$("q").oninput = e => { S.q = e.target.value; renderGrid(); };
$("fColorSel").onchange = e => { S.fColor = e.target.value; renderGrid(); };
$("fOccSel").onchange = e => { S.fOcc = e.target.value; renderGrid(); };
$("fSeasonSel").onchange = e => { S.fSeason = e.target.value; renderGrid(); };
$("sortSel").onchange = e => { S.sort = e.target.value; renderGrid(); };
$("filterBtn").onclick = () => {
  const open = $("filters").hidden;
  $("filters").hidden = !open;
  $("filterBtn").setAttribute("aria-expanded", String(open));
};
$("clearFilters").onclick = () => {
  S.fColor = S.fOcc = S.fSeason = ""; S.washOnly = false; S.q = "";
  ["fColorSel", "fOccSel", "fSeasonSel", "q"].forEach(id => $(id).value = "");
  renderGrid();
};

if (ME) $("hello").textContent = "Hi, " + (ME.name || ME.email).split(" ")[0];
$("logout").onclick = () => {
  if (!window.Auth) return;
  document.documentElement.classList.add("leaving");
  setTimeout(() => { Auth.signOut(); window.location.replace("login.html"); }, motionOK() ? 320 : 0);
};

load();
refreshAll(true);
$("brandIcon").classList.add("swing-once");
// Place the tab highlight without sliding, then let it glide on later changes
requestAnimationFrame(() => { moveTabInk(); requestAnimationFrame(() => $("tabInk").classList.add("ready")); });
document.fonts?.ready.then(moveTabInk);
// The entrance animation runs once, so later updates don't replay it
setTimeout(() => document.documentElement.classList.remove("page-enter"), 1800);
if (S.prefs.autoWeather) autoWeather();
