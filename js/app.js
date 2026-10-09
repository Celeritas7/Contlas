/* ---------- config & state ---------- */
const FILE_CFG = window.CONTLAS_CONFIG || {};
const LOCKED = !!(FILE_CFG.supabaseUrl && FILE_CFG.supabaseAnonKey); // config file wins; setup screen never shown
const CFG = Object.assign({ supabaseUrl: "", supabaseAnonKey: "" }, LOCKED ? FILE_CFG : JSON.parse(localStorage.getItem("contlas.config") || "{}"), { allowDemo: FILE_CFG.allowDemo !== false });
const LS_DATA = "contlas.local.v1", LS_GEO = "contlas.geocache.v1", LS_DEMO = "contlas.demo", NEW = "__new";
const DAY = 86400000, MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); };
const TABS = [{ id: "city", label: "CITY" }, { id: "warm", label: "WARM" }, { id: "bday", label: "BDAY" }, { id: "trip", label: "TRIPS" }, { id: "sync", label: "SYNC" }, { id: "az", label: "A–Z" }];

let D = { contacts: [], conversations: [], events: [], snoozes: [], trips: [] };
let sb = null, session = null, started = false;
const S = { feedUrl: "", openTrip: null, tripDraft: { city: "", from: "", to: "" }, bdDraft: "", rot: [10, 0], idle: true, selected: null, hover: null, query: "", tab: "city", heat: false, edits: {}, editing: false, logOpen: false, logChannel: "Call", land: null, busy: "", lastImport: null };

let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3600); }
async function run(fn) { try { await fn(); } catch (e) { console.error(e); toast(e.message || String(e)); renderAll(); } }

/* ---------- store: local or Supabase ---------- */
const KEY = { contacts: "contacts", conversations: "conversations", contact_events: "events", snoozes: "snoozes", trips: "trips" };
const Store = {
  mode: "local",
  async load() {
    if (this.mode === "supabase") {
      const r = await Promise.all(["contacts", "conversations", "contact_events", "snoozes"].map((t) => sb.from(t).select("*")));
      const bad = r.find((x) => x.error); if (bad) throw bad.error;
      D = { contacts: r[0].data, conversations: r[1].data, events: r[2].data, snoozes: r[3].data, trips: [] };
      const t = await sb.from("trips").select("*"); if (t.error) console.warn("trips table missing — re-run schema.sql", t.error); else D.trips = t.data;
    } else {
      const raw = localStorage.getItem(LS_DATA);
      D = raw ? JSON.parse(raw) : seedDemo(); D.trips = D.trips || [];
      this.persist();
    }
  },
  persist() { if (this.mode === "local") localStorage.setItem(LS_DATA, JSON.stringify(D)); },
  async insert(table, row) {
    if (this.mode === "supabase") { const { data, error } = await sb.from(table).insert(row).select().single(); if (error) throw error; row = data; }
    else row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
    D[KEY[table]].push(row); this.persist(); return row;
  },
  async patch(table, id, patch) {
    const row = D[KEY[table]].find((r) => r.id === id); if (row) Object.assign(row, patch); this.persist();
    if (this.mode === "supabase") { const { error } = await sb.from(table).update(patch).eq("id", id); if (error) throw error; }
  },
  async remove(table, id) {
    const k = KEY[table]; D[k] = D[k].filter((r) => r.id !== id);
    if (table === "contacts") { D.conversations = D.conversations.filter((r) => r.contact_id !== id); D.events = D.events.filter((r) => r.contact_id !== id); D.snoozes = D.snoozes.filter((r) => r.contact_id !== id); }
    this.persist();
    if (this.mode === "supabase") { const { error } = await sb.from(table).delete().eq("id", id); if (error) throw error; }
  },
  async snooze(contact_id, until) {
    D.snoozes = D.snoozes.filter((s) => s.contact_id !== contact_id).concat([{ contact_id, until }]); this.persist();
    if (this.mode === "supabase") { const { error } = await sb.from("snoozes").upsert({ contact_id, until }); if (error) throw error; }
  }
};

function seedDemo() {
  const A = window.ATLAS; const out = { contacts: [], conversations: [], events: [], snoozes: [], trips: [] };
  if (!A) return out;
  const t = Date.now(), idMap = {}; A.contacts.forEach((c) => { idMap[c.id] = "demo-" + c.id; });
  out.contacts = A.contacts.map((c) => ({ id: idMap[c.id], name: c.name, job: c.job, company: c.company, city: c.city, lat: c.lat, lon: c.lon, tz_offset: c.tz, tz_name: null, home_city: c.homeCity, home_lat: c.homeLat, home_lon: c.homeLon, birthday: c.bday, languages: c.langs, met_story: c.met, notes: c.notes, gift_ideas: c.gift, tags: c.tags, circle: c.conn.map((i) => idMap[i]), placed_by_hand: false, source: "demo", external_ref: null, created_at: new Date(t - 400 * DAY).toISOString() }));
  out.conversations = A.contacts.map((c) => ({ id: uid(), contact_id: idMap[c.id], channel: "call", note: "", happened_at: new Date(t - c.months * 30.44 * DAY - DAY).toISOString() }));
  const PATCH = { u1: { city: "Lisbon" }, u2: { company: "Fassi" }, u3: { notes: "Engaged to Rami. Wedding likely next summer." } }, AGO = { u1: 2, u2: 5, u3: 7, u4: 0 };
  A.updates.forEach((u) => out.events.push({ id: uid(), contact_id: idMap[u.who], kind: u.kind.toLowerCase().replace(" ", "_"), headline: u.text, detail: u.detail, proposed_patch: PATCH[u.id] || null, status: "pending", occurred_at: new Date(t - (AGO[u.id] || 0) * DAY).toISOString() }));
  A.contacts.forEach((c) => A.historyFor(c.id).forEach((h) => out.events.push({ id: uid(), contact_id: idMap[c.id], kind: h.k.toLowerCase().replace(" ", "_"), headline: h.t, detail: null, proposed_patch: null, status: "accepted", occurred_at: new Date(h.d).toISOString() })));
  return out;
}

/* ---------- derived ---------- */
function enrich(c) {
  const last = D.conversations.filter((v) => v.contact_id === c.id).reduce((m, v) => Math.max(m, +new Date(v.happened_at)), 0) || +new Date(c.created_at || Date.now());
  const evs = D.events.filter((e) => e.contact_id === c.id);
  const sn = D.snoozes.find((s) => s.contact_id === c.id);
  const seen = c.last_seen_lat != null && c.last_seen_lon != null;
  return Object.assign({}, c, {
    lives_city: c.city, seen,
    city: seen ? c.last_seen_city : c.city, lat: seen ? c.last_seen_lat : c.lat, lon: seen ? c.last_seen_lon : c.lon,
    tz_offset: seen ? Math.round(c.last_seen_lon / 15) : c.tz_offset,
    lastAt: last, months: Math.max(0, Math.round((Date.now() - last) / (30.44 * DAY))),
    pending: evs.filter((e) => e.status === "pending").length,
    snoozed: !!(sn && +new Date(sn.until) > Date.now()),
    placed: seen || (c.lat != null && c.lon != null),
    langsText: (c.languages || []).join(", "), tags: c.tags || [], circle: c.circle || []
  });
}
const people = () => D.contacts.map(enrich);
const byId = (id) => { const c = D.contacts.find((x) => x.id === id); return c ? enrich(c) : null; };
const fade = (m) => m <= 2 ? 1 : m >= 18 ? 0.26 : 1 - ((m - 2) / 16) * 0.74;
const warmth = (m) => m <= 3 ? "recent" : m <= 8 ? "cooling" : "cold";
function lastSpoke(c) {
  const d = Math.floor((Date.now() - c.lastAt) / DAY);
  if (d < 1) return "today"; if (d < 7) return d + "d ago"; if (d < 45) return Math.round(d / 7) + "w ago";
  const m = c.months; if (m < 12) return m + " months ago";
  const y = Math.floor(m / 12), r = m % 12; return y + (y > 1 ? " years" : " year") + (r ? " " + r + "m" : "") + " ago";
}
function cities(list) {
  const map = {};
  list.filter((c) => c.placed).forEach((c) => { const k = c.city || "Unnamed place"; if (!map[k]) map[k] = { city: k, lat: c.lat, lon: c.lon, people: [] }; map[k].people.push(c); });
  return Object.keys(map).map((k) => map[k]);
}
const citiesWestToEast = (list) => cities(list).sort((a, b) => a.lon - b.lon);
function daysToBirthday(b) {
  const p = String(b || "").trim().split(/\s+/), day = parseInt(p[0], 10), mi = MONTHS.indexOf(p[1]);
  if (isNaN(day) || mi < 0) return null;
  const T = new Date(); T.setHours(0, 0, 0, 0);
  let n = new Date(T.getFullYear(), mi, day); if (n < T) n = new Date(T.getFullYear() + 1, mi, day);
  return Math.round((n - T) / DAY);
}
function birthdayLabel(b) { const d = daysToBirthday(b); if (d === null) return ""; if (d === 0) return "today"; if (d === 1) return "tomorrow"; if (d < 45) return "in " + d + " days"; return "in " + Math.round(d / 30.5) + " months"; }
function matches(c) { const q = S.query.trim().toLowerCase(); if (!q) return true; return [c.name, c.city, c.lives_city, c.home_city, c.job, c.company, c.tags.join(" ")].join(" ").toLowerCase().indexOf(q) >= 0; }
function localParts(c) {
  if (c.tz_name) { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: c.tz_name, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); return { h: +p.find((x) => x.type === "hour").value % 24, m: +p.find((x) => x.type === "minute").value }; } catch (e) {} }
  const off = c.tz_offset != null ? c.tz_offset : c.lon != null ? Math.round(c.lon / 15) : 0;
  const d = new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + off * 3600000);
  return { h: d.getHours(), m: d.getMinutes() };
}
const timeLabel = (c) => { const t = localParts(c); return (t.h < 10 ? "0" : "") + t.h + ":" + (t.m < 10 ? "0" : "") + t.m; };
const isAsleep = (c) => { const h = localParts(c).h; return h < 8 || h >= 22; };
const openUpdates = () => D.events.filter((e) => e.status === "pending").sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
const reconnectQueue = () => people().filter((c) => c.months >= 6 && !c.snoozed).sort((a, b) => b.months - a.months);
const birthdayList = () => people().map((c) => ({ c, d: daysToBirthday(c.birthday) })).filter((x) => x.d !== null && x.d <= 30).sort((a, b) => a.d - b.d);
const validBday = (d, m) => { const mi = MONTHS.indexOf(m); return mi >= 0 && +d >= 1 && +d <= new Date(2024, mi + 1, 0).getDate(); };
const dayOpts = (sel) => '<option value="">Day</option>' + Array.from({ length: 31 }, (_, i) => "<option" + (+sel === i + 1 ? " selected" : "") + ">" + (i + 1) + "</option>").join("");
const monOpts = (sel) => '<option value="">Month</option>' + MONTHS.map((m) => "<option" + (sel === m ? " selected" : "") + ">" + m + "</option>").join("");
const splitBday = (b) => { const p = String(b || "").trim().split(/\s+/); return { d: p[0] || "", m: MONTHS.indexOf(p[1]) >= 0 ? p[1] : "" }; };
const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const ymd = (s) => { const p = String(s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const isoDay = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const TRIP_KM = 200, TRIP_LEAD = 7;
function km(a, b) { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r, s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(s)); }
function bdayInWindow(b, s, e) { const p = splitBday(b), d = parseInt(p.d, 10), mi = MONTHS.indexOf(p.m); if (isNaN(d) || mi < 0) return null; for (let y = s.getFullYear(); y <= e.getFullYear(); y++) { const t = new Date(y, mi, Math.min(d, new Date(y, mi + 1, 0).getDate())); if (t >= s && t <= e) return t; } return null; }
function tripInfo(t) {
  const s = ymd(t.start_date), e = ymd(t.end_date);
  const near = people().filter((c) => c.placed && t.lat != null).map((c) => ({ c, km: km(t, c) })).filter((x) => x.km <= TRIP_KM).sort((a, b) => a.km - b.km);
  const bdays = near.map((x) => ({ c: x.c, on: bdayInWindow(x.c.birthday, s, e) })).filter((x) => x.on).sort((a, b) => a.on - b.on);
  return { near, bdays };
}
const upcomingTrips = () => (D.trips || []).filter((t) => ymd(t.end_date) >= today0()).sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
const tripDays = (t) => Math.round((ymd(t.start_date) - today0()) / DAY);
const tripWhen = (t) => { const d = tripDays(t); return d <= 0 ? "now" : d === 1 ? "tomorrow" : "in " + d + " days"; };
const shortDay = (d) => d.getDate() + " " + MONTHS[d.getMonth()];
const tripRange = (t) => shortDay(ymd(t.start_date)) + " – " + shortDay(ymd(t.end_date));
const socialUrl = (k, v) => { v = String(v || "").trim(); if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; v = v.replace(/^@/, ""); return k === "instagram" ? "https://instagram.com/" + v : k === "linkedin" ? "https://www.linkedin.com/in/" + v : "https://facebook.com/" + v; };
const posKeys = (raw) => (raw.last_seen_lat != null ? ["last_seen_lat", "last_seen_lon"] : ["lat", "lon"]);

/* ---------- geocoding (Nominatim, cached) ---------- */
const geoCache = JSON.parse(localStorage.getItem(LS_GEO) || "{}");
async function geocode(q) {
  const k = String(q || "").trim().toLowerCase(); if (!k) return null;
  if (geoCache[k] !== undefined) return geoCache[k];
  const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(k), { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Geocoder unavailable (" + r.status + ")");
  const j = await r.json(), hit = j && j[0];
  const out = hit ? { lat: +hit.lat, lon: +hit.lon } : null;
  geoCache[k] = out; localStorage.setItem(LS_GEO, JSON.stringify(geoCache)); return out;
}
async function applyGeo(patch) {
  if (patch.city !== undefined) { const g = patch.city ? await geocode(patch.city) : null; patch.lat = g ? g.lat : null; patch.lon = g ? g.lon : null; patch.tz_offset = g ? Math.round(g.lon / 15) : null; patch.placed_by_hand = false; }
  if (patch.last_seen_city !== undefined) { const g = patch.last_seen_city ? await geocode(patch.last_seen_city) : null; patch.last_seen_lat = g ? g.lat : null; patch.last_seen_lon = g ? g.lon : null; if (!patch.last_seen_city) patch.last_seen_at = null; else if (!patch.last_seen_at) patch.last_seen_at = isoDay(new Date()); }
  if (patch.home_city !== undefined) { const g = patch.home_city ? await geocode(patch.home_city) : null; patch.home_lat = g ? g.lat : null; patch.home_lon = g ? g.lon : null; }
  return patch;
}

/* ---------- globe ---------- */
const svg = d3.select("#globe");
let R = 200, projection = d3.geoOrthographic().clipAngle(90), geoPath = d3.geoPath(projection), dragMoved = false;
const gSphere = svg.append("g"), gLand = svg.append("g"), gGrat = svg.append("g"), gHeat = svg.append("g"), gLinks = svg.append("g"), gPins = svg.append("g");
const graticule = d3.geoGraticule10();
function sizeGlobe() {
  const box = $("globeWrap").getBoundingClientRect(), size = Math.max(180, Math.min(box.width, box.height) - 8);
  R = size / 2; svg.attr("width", size).attr("height", size); projection.scale(R - 2).translate([R, R]); drawGlobe();
}
const visible = (c) => c.lat != null && c.lon != null && d3.geoDistance([c.lon, c.lat], [-S.rot[0], -S.rot[1]]) < Math.PI / 2 - 0.02;

function drawGlobe() {
  projection.rotate(S.rot);
  const all = people();
  gSphere.selectAll("circle.base").data([0]).join("circle").attr("class", "base").attr("cx", R).attr("cy", R).attr("r", R - 2).attr("fill", "#131A24");
  if (S.land) gLand.selectAll("path").data([S.land]).join("path").attr("d", geoPath).attr("fill", "#2C3A4C").attr("stroke", "none");
  gGrat.selectAll("path").data([graticule]).join("path").attr("d", geoPath).attr("fill", "none").attr("stroke", "rgba(140,170,200,0.16)").attr("stroke-width", 0.6);
  gSphere.selectAll("circle.rim").data([0]).join("circle").attr("class", "rim").attr("cx", R).attr("cy", R).attr("r", R - 2).attr("fill", "none").attr("stroke", "rgba(237,230,216,0.18)");

  gHeat.selectAll("circle").data(S.heat ? citiesWestToEast(all).filter((g) => visible({ lon: g.lon, lat: g.lat })) : [], (g) => g.city).join("circle")
    .attr("cx", (g) => projection([g.lon, g.lat])[0]).attr("cy", (g) => projection([g.lon, g.lat])[1])
    .attr("r", (g) => (R / 270) * (24 + g.people.length * 13)).attr("fill", "rgba(201,138,75,0.14)");

  const sel = S.selected && S.selected !== NEW ? byId(S.selected) : null, links = [];
  if (sel && visible(sel)) {
    const here = projection([sel.lon, sel.lat]);
    if (visible({ lon: sel.home_lon, lat: sel.home_lat })) links.push({ k: "home", a: here, b: projection([sel.home_lon, sel.home_lat]), stroke: "rgba(201,138,75,0.75)", dash: "4 4" });
    sel.circle.forEach((id) => { const m = byId(id); if (m && visible(m)) links.push({ k: "c" + id, a: here, b: projection([m.lon, m.lat]), stroke: "rgba(95,211,166,0.6)", dash: null }); });
  }
  gLinks.selectAll("line").data(links, (l) => l.k).join("line")
    .attr("x1", (l) => l.a[0]).attr("y1", (l) => l.a[1]).attr("x2", (l) => l.b[0]).attr("y2", (l) => l.b[1])
    .attr("stroke", (l) => l.stroke).attr("stroke-width", 1.1).attr("stroke-dasharray", (l) => l.dash);

  const shown = all.filter(visible).map((c) => {
    const p = projection([c.lon, c.lat]), on = matches(c), isSel = sel && sel.id === c.id, isHov = S.hover === c.id;
    return { c, x: p[0], y: p[1], on, isSel, isHov, first: c.name.split(" ")[0], prio: isSel ? 3 : isHov ? 2 : on ? 1 - c.months / 100 : -1 };
  });
  const cells = {};
  shown.forEach((p) => { const k = Math.round(p.x / 16) + ":" + Math.round(p.y / 16); (cells[k] = cells[k] || []).push(p); });
  Object.keys(cells).forEach((k) => { const grp = cells[k]; if (grp.length < 2) return; grp.forEach((p, i) => { const ang = (i / grp.length) * Math.PI * 2 - Math.PI / 2; p.x += Math.cos(ang) * 14; p.y += Math.sin(ang) * 14; p.flip = Math.cos(ang) < -0.3; }); });
  const placed = [];
  shown.slice().sort((a, b) => b.prio - a.prio).forEach((p) => {
    const w = p.first.length * 6.8 + 6; let x = p.flip ? p.x - w - 12 : p.x + (p.isSel || p.isHov ? 17 : 13);
    if (x + w > 2 * R - 4) x = p.x - w - 12; if (x < 4) x = p.x + 13;
    const box = { x1: x, y1: p.y - 7, x2: x + w, y2: p.y + 7 };
    const hitLabel = placed.some((q) => !(box.x2 < q.x1 || box.x1 > q.x2 || box.y2 < q.y1 || box.y1 > q.y2));
    const hitDot = shown.some((o) => o !== p && o.x > box.x1 - 5 && o.x < box.x2 + 5 && o.y > box.y1 - 4 && o.y < box.y2 + 4);
    p.showLabel = (!hitLabel && !hitDot) || p.prio >= 2; p.labelX = x; if (p.showLabel) placed.push(box);
  });

  const pins = gPins.selectAll("g.pin").data(shown, (p) => p.c.id).join((enter) => { const g = enter.append("g").attr("class", "pin"); g.append("circle").attr("class", "dot"); g.append("text").attr("class", "pinLabel"); return g; });
  pins.attr("transform", (p) => "translate(" + p.x + "," + p.y + ")")
    .attr("opacity", (p) => (p.on ? (p.isSel || p.isHov ? 1 : fade(p.c.months)) : 0.1))
    .on("mouseenter", (e, p) => { S.hover = p.c.id; drawGlobe(); syncHover(); })
    .on("mouseleave", () => { S.hover = null; drawGlobe(); syncHover(); })
    .on("click", (e, p) => { if (!dragMoved) select(p.c.id); });
  pins.select("circle.dot").attr("r", (p) => (p.isSel ? 7.5 : p.isHov ? 6.5 : 4.5))
    .attr("fill", (p) => (p.c.pending ? "var(--mint)" : isAsleep(p.c) ? "#8FA3BA" : "var(--ochre)"))
    .attr("stroke", (p) => (p.isSel || p.isHov ? "#F6F1E5" : "rgba(13,20,32,0.55)")).attr("stroke-width", (p) => (p.isSel || p.isHov ? 2 : 1));
  pins.select("text.pinLabel").attr("x", (p) => p.labelX - p.x).attr("y", 4).attr("display", (p) => (p.showLabel ? null : "none"))
    .attr("fill", (p) => (p.isSel || p.isHov ? "#F6F1E5" : "#D8D0BE")).attr("font-size", (p) => (p.isSel || p.isHov ? 12 : 10)).text((p) => p.first);

  pins.call(d3.drag()
    .on("start", (e) => { e.sourceEvent.stopPropagation(); dragMoved = false; S.idle = false; })
    .on("drag", (e, p) => { dragMoved = true; const inv = projection.invert([e.x, e.y]); if (!inv || isNaN(inv[0])) return; const raw = D.contacts.find((c) => c.id === p.c.id); if (raw) { const k = posKeys(raw); raw[k[0]] = inv[1]; raw[k[1]] = inv[0]; raw.placed_by_hand = true; } drawGlobe(); })
    .on("end", (e, p) => { if (dragMoved) { const raw = D.contacts.find((c) => c.id === p.c.id); const k = posKeys(raw); run(() => Store.patch("contacts", p.c.id, { [k[0]]: raw[k[0]], [k[1]]: raw[k[1]], placed_by_hand: true })); renderRail(); renderCard(); } setTimeout(() => { dragMoved = false; }, 120); }));
}
svg.call(d3.drag().on("start", () => { S.idle = false; svg.classed("grabbing", true); })
  .on("drag", (e) => { S.rot = [S.rot[0] + e.dx * 0.38, Math.max(-70, Math.min(70, S.rot[1] - e.dy * 0.22))]; drawGlobe(); })
  .on("end", () => svg.classed("grabbing", false)));
d3.interval(() => { if (S.idle && started) { S.rot = [S.rot[0] + 0.09, S.rot[1]]; drawGlobe(); } }, 40);
function glideTo(c) {
  if (!c || !c.placed) return;
  S.idle = false;
  const i = d3.interpolate(S.rot.slice(), [-c.lon, -Math.max(-55, Math.min(55, c.lat))]), dur = 1500;
  const tick = d3.timer((el) => { const k = Math.min(1, el / dur); S.rot = i(d3.easeCubicInOut(k)); drawGlobe(); if (k === 1) tick.stop(); });
}

/* ---------- selection ---------- */
function select(id) { if (S.editing) return commitEdits().then(() => select(id)); S.selected = id; S.editing = false; S.logOpen = false; S.edits = {}; glideTo(byId(id)); renderAll(); }
function deselect() { S.selected = null; S.editing = false; S.logOpen = false; S.edits = {}; renderAll(); }
function syncHover() { document.querySelectorAll(".prow").forEach((el) => el.classList.toggle("hov", S.hover != null && el.dataset.id === S.hover)); }
function renderAll() { renderRail(); renderCard(); drawGlobe(); renderStats(); }

/* ---------- header ---------- */
function renderStats() {
  const all = people(), un = all.filter((c) => !c.placed).length;
  const who = Store.mode === "supabase" ? (session && session.user ? session.user.email : "") : "demo · saved in this browser";
  $("stats").innerHTML =
    (S.busy ? "<span style='color:var(--mintInk)'>" + esc(S.busy) + "</span>" : "") +
    "<span>" + all.length + " contacts · " + cities(all).length + " cities" + (un ? " · <a id='unplacedLink'>" + un + " unplaced</a>" : "") + "</span>" +
    "<span>" + esc(who) + "</span>" +
    (Store.mode === "supabase" ? "<a id='signOut'>Sign out</a>" : "<a id='connectLink'>" + (LOCKED ? "Sign in" : "Connect Supabase") + "</a>");
}

/* ---------- rail ---------- */
function renderTabs() {
  $("tabs").innerHTML = TABS.map((t) => '<button class="tab ' + (S.tab === t.id ? "on" : "") + '" data-tab="' + t.id + '">' + t.label + (t.id === "sync" && openUpdates().length ? '<i class="dotc"></i>' : "") + "</button>").join("");
}
function renderReconnect() {
  const q = reconnectQueue(), soon = S.tab === "trip" ? [] : upcomingTrips().filter((t) => tripDays(t) <= TRIP_LEAD);
  const trips = soon.map((t) => { const i = tripInfo(t); return '<div class="rrow" style="border-top:none;border-bottom:1px solid var(--rule2)"><div class="lab" style="color:var(--mintInk)">Trip ' + tripWhen(t) + " · " + tripRange(t) + '</div><div class="nm" style="margin-top:4px">' + esc(t.city) + '</div><div class="mt">' + i.near.length + " within " + TRIP_KM + " km" + (i.bdays.length ? " · " + i.bdays.length + (i.bdays.length === 1 ? " birthday" : " birthdays") + " while you’re there" : "") + '</div><div class="acts"><button class="btn tiny solid" data-tripopen="' + t.id + '">See who’s there</button></div></div>'; }).join("");
  if ((!q.length || S.tab === "sync") && !trips) { $("reconnect").innerHTML = ""; return; }
  $("reconnect").innerHTML = trips + (!q.length || S.tab === "sync" ? "" : '<div class="rhead"><b>Reconnect</b><i>' + q.length + " fading</i></div>" + q.slice(0, 2).map((c) =>
    '<div class="rrow"><div class="nm">' + esc(c.name) + '</div><div class="mt">' + esc(lastSpoke(c)) + (c.city ? " · " + esc(c.city) + " " + timeLabel(c) : "") + "</div>" +
    '<div class="acts"><button class="btn tiny solid" data-reach="' + c.id + '">Reach out</button><button class="btn tiny" data-snooze="' + c.id + '">Snooze a month</button></div></div>').join(""));
}
function shortBday(c) { const d = daysToBirthday(c.birthday); return d === 0 ? "bday today" : d === 1 ? "bday tmrw" : "bday " + d + "d"; }
function personRow(c, extra, showCity) {
  const asleep = isAsleep(c), bd = daysToBirthday(c.birthday);
  return '<div class="prow" data-id="' + c.id + '"><span class="swatch" style="background:' + (c.pending ? "var(--mint)" : "var(--ochre)") + ";opacity:" + fade(c.months).toFixed(2) + '"></span>' +
    '<div style="flex:1;min-width:0"><div class="nm">' + esc(c.name) + '</div><div class="mt">' +
    (c.placed ? '<span' + (asleep ? ' class="asleep"' : "") + ">" + timeLabel(c) + (asleep ? " zzz" : "") + "</span>" : '<span class="asleep">no pin</span>') +
    (showCity && c.city ? '<span class="city">' + esc(c.city) + "</span>" : "") +
    (bd !== null && bd <= 30 ? '<span class="pill">' + shortBday(c) + "</span>" : "") +
    '</div></div><div class="rt">' + esc(extra || lastSpoke(c)) + "</div></div>";
}
function renderRail() {
  renderTabs(); renderReconnect();
  const body = $("railBody"), shown = people().filter(matches);
  if (S.tab === "city") {
    const groups = citiesWestToEast(shown), un = shown.filter((c) => !c.placed);
    body.innerHTML = (un.length ? '<div class="grouphead"><span>Unplaced</span><em class="r">' + un.length + "</em></div>" + un.map((c) => personRow(c, null, true)).join("") : "") +
      (groups.length ? groups.map((g) => '<div class="grouphead"><span>' + esc(g.city) + "</span><em>" + g.lon.toFixed(0) + '°</em><em class="r">' + g.people.length + "</em></div>" + g.people.map((c) => personRow(c, null, false)).join("")).join("") : "") +
      (!un.length && !groups.length ? '<div class="empty">' + (D.contacts.length ? "No one matches." : "No one here yet.<br />Add a person or import a file.") + "</div>" : "");
  } else if (S.tab === "warm") {
    const q = reconnectQueue().filter(matches);
    body.innerHTML = q.length ? '<div class="grouphead"><span>Coldest first</span><em class="r">' + q.length + "</em></div>" + q.map((c) => personRow(c, null, true)).join("") : '<div class="empty">Nobody is fading.<br />Everyone inside six months.</div>';
  } else if (S.tab === "bday") {
    const b = birthdayList().filter((x) => matches(x.c)), miss = shown.filter((c) => !c.birthday).sort((a, z) => a.name.localeCompare(z.name));
    body.innerHTML = (b.length ? '<div class="grouphead"><span>Next 30 days</span><em class="r">' + b.length + "</em></div>" + b.map((x) => personRow(x.c, birthdayLabel(x.c.birthday), true)).join("") : '<div class="empty" style="padding:22px 18px">No birthdays in the next 30 days.</div>') +
      '<div class="importBox"><div class="lab">Add someone new</div><input class="search" id="bdNewName" placeholder="Name" value="' + esc(S.bdDraft) + '" />' +
      '<div style="display:flex;gap:6px"><select class="bdSel" id="bdNewD">' + dayOpts("") + '</select><select class="bdSel" id="bdNewM" style="flex:1">' + monOpts("") + '</select><button class="btn solid" id="bdNewAdd">Add</button></div></div>' +
      '<div class="grouphead"><span>Missing a birthday</span><em class="r">' + miss.length + "</em></div>" +
      (miss.length ? miss.map((c) => '<div class="bdRow" data-bdid="' + c.id + '"><div style="flex:1;min-width:0"><div class="nm">' + esc(c.name) + '</div><div class="mt">' + esc(c.city || "no city") + '</div></div><select class="bdSel" data-bdd>' + dayOpts("") + '</select><select class="bdSel" data-bdm>' + monOpts("") + "</select></div>").join("") : '<div class="empty" style="padding:22px 18px">Everyone has a birthday on file.</div>');
  } else if (S.tab === "trip") {
    const ts = upcomingTrips(), dr = S.tripDraft;
    if (S.openTrip === null && ts.length) S.openTrip = ts[0].id;
    body.innerHTML = '<div class="importBox"><div class="lab">Plan a trip</div><div class="mt">Everyone within ' + TRIP_KM + ' km of where you last saw them, plus birthdays that fall while you’re there. A week before, a reminder shows here and in your calendar feed.</div>' +
      '<input class="search" id="tripCity" placeholder="City, Country" value="' + esc(dr.city) + '" />' +
      '<div style="display:flex;gap:6px"><input class="search" type="date" id="tripFrom" value="' + esc(dr.from) + '" /><input class="search" type="date" id="tripTo" value="' + esc(dr.to) + '" /></div>' +
      '<div style="display:flex;gap:6px"><button class="btn solid" id="tripSave"' + (S.busy ? " disabled" : "") + ">Save trip</button></div></div>" +
      (ts.length ? ts.map((t) => { const i = tripInfo(t), open = S.openTrip === t.id;
        return '<div class="rrow" data-trip="' + t.id + '" style="cursor:pointer;border-top:none;border-bottom:1px solid var(--rule2);' + (open ? "background:var(--paper3)" : "") + '"><div style="display:flex;align-items:baseline;gap:8px"><span class="nm">' + esc(t.city) + '</span><span class="lab" style="margin-left:auto;' + (tripDays(t) <= TRIP_LEAD ? "color:var(--mintInk)" : "") + '">' + tripWhen(t) + '</span></div><div class="mt">' + tripRange(t) + " · " + i.near.length + " nearby" + (i.bdays.length ? " · " + i.bdays.length + " bday" : "") + "</div></div>" +
          (open ? (i.bdays.length ? '<div class="grouphead"><span>Birthdays while you’re there</span><em class="r">' + i.bdays.length + "</em></div>" + i.bdays.map((x) => personRow(x.c, shortDay(x.on), true)).join("") : "") +
            '<div class="grouphead"><span>Within ' + TRIP_KM + ' km</span><em class="r">' + i.near.length + "</em></div>" +
            (i.near.length ? i.near.map((x) => personRow(x.c, Math.round(x.km) + " km", true)).join("") : '<div class="empty" style="padding:22px 18px">Nobody you know near ' + esc(t.city) + " yet.</div>") +
            '<div class="rrow" style="border-top:none;border-bottom:1px solid var(--rule)"><div class="acts" style="margin-top:0"><button class="btn tiny" data-tripgo="' + t.id + '">Show on globe</button><button class="btn tiny danger" data-tripdel="' + t.id + '">Delete trip</button></div></div>' : "");
      }).join("") : '<div class="empty">No trips planned.</div>');
  } else if (S.tab === "az") {
    const list = shown.slice().sort((a, b) => a.name.localeCompare(b.name));
    body.innerHTML = list.length ? list.map((c) => personRow(c, null, true)).join("") : '<div class="empty">No one matches.</div>';
  } else {
    const u = openUpdates(), li = S.lastImport;
    body.innerHTML =
      '<div class="importBox"><div class="lab">Import · CSV, vCard or calendar (.ics)</div>' +
      '<div class="mt">Export from Google Contacts, iCloud or your phone, then drop the file here. A calendar export adds birthdays to the people it names. Re-importing the same file later shows what changed, below.</div>' +
      '<div style="display:flex;gap:6px"><button class="btn solid" id="importBtn"' + (S.busy ? " disabled" : "") + '>' + (S.busy ? "Importing…" : "Choose file") + "</button>" +
      (li ? '<span class="mt" style="align-self:center">' + li.added + " added · " + li.review + " to review · " + li.same + " unchanged</span>" : "") + "</div></div>" +
      '<div class="importBox"><div class="lab">Calendar · birthdays live here</div>' +
      '<div class="mt">Contlas is the source of truth. Subscribe your calendar to this private link once; birthdays you edit here show up there (Google refreshes every few hours, Apple on its schedule). Nobody else can read it unless you share the link.</div>' +
      (Store.mode === "supabase" ?
        (S.feedUrl ? '<input class="mono" id="feedUrl" readonly value="' + esc(S.feedUrl) + '" style="width:100%;font-size:9px;padding:7px 8px;border:1px solid var(--rule);background:var(--paper2);color:var(--ink2)" />' : "") +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn solid" id="feedCopy">' + (S.feedUrl ? "Copy link" : "Create link") + '</button>' + (S.feedUrl ? '<button class="btn" id="feedRotate">Reset link</button>' : "") + '<button class="btn ghost" id="icsDl">Download .ics</button></div>'
        : '<div style="display:flex;gap:6px"><button class="btn solid" id="icsDl">Download .ics</button><span class="mt" style="align-self:center">Live link needs a Supabase account.</span></div>') +
      "</div>" +
      (u.length ? u.map((up) => {
        const who = byId(up.contact_id); if (!who) return "";
        return '<div class="rrow" style="border-top:none;border-bottom:1px solid var(--rule2);padding:15px 16px">' +
          '<div style="display:flex;align-items:center;gap:7px"><span class="swatch" style="background:var(--mint)"></span><span class="lab" style="color:var(--mintInk)">' + esc(up.kind.replace("_", " ")) + '</span><span class="lab" style="margin-left:auto">' + esc(fmtDate(up.occurred_at)) + "</span></div>" +
          '<div style="font-size:15px;line-height:1.45;margin-top:8px">' + esc(up.headline) + "</div>" +
          (up.detail ? '<div class="mt" style="margin-top:6px;line-height:1.6">' + esc(up.detail) + "</div>" : "") +
          '<div class="acts">' + (up.proposed_patch ? '<button class="btn tiny solid" data-acc="' + up.id + '">Accept</button>' : '<button class="btn tiny solid" data-open="' + up.id + '">Open card</button>') +
          '<button class="btn tiny ghost" data-dis="' + up.id + '">Dismiss</button></div></div>';
      }).join("") : '<div class="empty">Nothing waiting.<br />Your cards are up to date.</div>');
  }
  syncHover();
}

/* ---------- card ---------- */
function renderCard() {
  const card = $("card");
  if (!S.selected) { card.classList.remove("open"); return; }
  const isNew = S.selected === NEW;
  const c = isNew ? enrich({ id: NEW, name: "", languages: [], tags: [], circle: [], created_at: new Date().toISOString() }) : byId(S.selected);
  if (!c) { card.classList.remove("open"); return; }
  const asleep = isAsleep(c);
  const tl = D.conversations.filter((v) => v.contact_id === c.id).map((v) => ({ kind: v.channel, date: v.happened_at, text: v.note || "", mint: false }))
    .concat(D.events.filter((e) => e.contact_id === c.id).map((e) => ({ kind: e.kind.replace("_", " ") + (e.status === "pending" ? " · to review" : e.status === "dismissed" ? " · dismissed" : ""), date: e.occurred_at, text: e.headline, mint: true })))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const v = (k, fallback) => (S.edits[k] !== undefined ? S.edits[k] : fallback == null ? "" : fallback);
  const fields = [["Name", "name", c.name], ["Lives", "city", c.lives_city], ["Last seen in (wins on the map)", "last_seen_city", c.last_seen_city], ["Last seen on", "last_seen_at", c.last_seen_at, "date"], ["From", "home_city", c.home_city], ["Job", "job", c.job], ["Company", "company", c.company], ["Birthday", "birthday", c.birthday, "bday"], ["Instagram (handle or link)", "instagram", c.instagram], ["LinkedIn (handle or link)", "linkedin", c.linkedin], ["Facebook (handle or link)", "facebook", c.facebook], ["Languages, comma-separated", "languages", c.langsText], ["Tags, comma-separated", "tags", c.tags.join(", ")], ["Time zone (e.g. Europe/Lisbon)", "tz_name", c.tz_name], ["Email (used to match imports)", "external_ref", c.external_ref]];
  const socials = [["Instagram", "instagram"], ["LinkedIn", "linkedin"], ["Facebook", "facebook"]].filter((s) => c[s[1]]);
  const longs = [["How we met", "met_story", c.met_story], ["Notes", "notes", c.notes], ["Gift ideas", "gift_ideas", c.gift_ideas]];

  card.innerHTML = '<div class="cardScroll">' +
    '<div class="cardHead"><div class="row1"><button class="btn tiny" id="cardBack">← Close</button>' +
      (S.editing ? '<button class="btn tiny" id="cardCancel" style="margin-left:auto">Cancel</button><button class="btn tiny on" id="cardEdit">Save</button>' : '<button class="btn tiny" id="cardEdit" style="margin-left:auto">Edit</button>') + "</div>" +
      (isNew ? '<div class="lab" style="margin-top:14px;color:var(--brown)">New person</div><h2>' + esc(v("name", "") || "Someone new") + "</h2>" :
      '<div class="lab" style="margin-top:14px;color:var(--brown)">' + esc(warmth(c.months) === "cold" ? "Going cold" : c.tags.join(" · ")) + "</div><h2>" + esc(c.name) + "</h2>" +
      '<div class="role">' + esc([c.job, c.company].filter(Boolean).join(", ")) + "</div>" +
      '<div class="meta"><span class="swatch" style="background:var(--ochre);opacity:' + fade(c.months).toFixed(2) + '"></span> Spoke ' + esc(lastSpoke(c)) +
        (c.pending ? '<span style="margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--mintInk)"><i class="swatch" style="background:var(--mint)"></i>' + c.pending + " to review</span>" : "") + "</div>") +
    "</div>" +
    (isNew ? "" : c.placed ?
      '<div class="band"><div style="flex:1"><div class="lab">Local time · ' + esc(c.city || "") + '</div><div class="val" style="font-size:18px">' + timeLabel(c) + (asleep ? ' <span class="mono" style="font-size:11px;color:var(--ink3)">— asleep, don’t call</span>' : ' <span class="mono" style="font-size:11px;color:var(--mintInk)">— good hour</span>') + "</div></div>" +
      '<div style="text-align:right"><div class="lab">Birthday</div><div class="val">' + (c.birthday ? esc(c.birthday) + " · <i>" + esc(birthdayLabel(c.birthday)) + "</i>" : "—") + "</div></div></div>" +
      '<div class="band" style="background:transparent"><button class="btn solid" id="logBtn" style="flex:1">Log a talk</button><button class="btn" id="zoomBtn">Zoom to ' + esc(c.city || "here") + "</button></div>"
      :
      '<div class="band"><div style="flex:1"><div class="lab">Not on the globe</div><div class="val">' + (c.city ? "City “" + esc(c.city) + "” didn’t geocode." : "No city yet — add one in Edit.") + "</div></div>" +
      (c.city ? '<button class="btn" id="placeBtn">Place</button>' : "") + "</div>" +
      '<div class="band" style="background:transparent"><button class="btn solid" id="logBtn" style="flex:1">Log a talk</button></div>') +
    (S.logOpen ? '<div class="sect" style="background:var(--paper3);gap:11px"><div class="lab">How did you talk?</div><div style="display:flex;gap:6px">' +
      ["Call", "Coffee", "Message"].map((ch) => '<button class="btn ' + (S.logChannel === ch ? "on" : "") + '" data-ch="' + ch + '" style="flex:1">' + ch + "</button>").join("") + "</div>" +
      '<input class="search" id="logLine" placeholder="What did you talk about? (optional)" style="font-family:Spectral,Georgia,serif;font-size:14px" />' +
      '<div style="display:flex;gap:6px"><button class="btn mintSolid" id="logSave" style="flex:1">Save · resets the fade</button><button class="btn" id="logCancel">Cancel</button></div></div>' : "") +
    (S.editing ?
      '<div class="sect">' + fields.map(([lab, key, val, type]) => { if (type === "bday") { const p = splitBday(v(key, val)); return '<div class="field"><span class="lab">' + lab + '</span><div style="display:flex;gap:6px;margin-top:5px"><select class="bdSel" data-bdpart="d">' + dayOpts(p.d) + '</select><select class="bdSel" data-bdpart="m" style="flex:1">' + monOpts(p.m) + "</select></div></div>"; }
        return '<label class="field"><span class="lab">' + lab + '</span><input data-edit="' + key + '"' + (type ? ' type="' + type + '"' : "") + ' value="' + esc(v(key, val)) + '" /></label>'; }).join("") +
      longs.map(([lab, key, val]) => '<label class="field"><span class="lab">' + lab + '</span><textarea data-edit="' + key + '" rows="3">' + esc(v(key, val)) + "</textarea></label>").join("") +
      (isNew ? "" : '<button class="btn danger" id="deleteBtn" style="align-self:flex-start">Delete person</button>') + "</div>"
      :
      '<div class="sect"><div class="grid2">' +
        '<div><div class="lab">Lives</div><div class="val">' + esc(c.lives_city || "—") + '</div></div><div><div class="lab">From</div><div class="val">' + esc(c.home_city || "—") + "</div></div>" +
        (c.last_seen_city ? '<div style="grid-column:1 / -1"><div class="lab">Last seen</div><div class="val">' + esc(c.last_seen_city) + (c.last_seen_at ? ' <span class="mono" style="font-size:11px;color:var(--ink3)">· ' + esc(fmtDate(ymd(c.last_seen_at))) + "</span>" : "") + (c.seen ? "" : ' <span class="mono" style="font-size:11px;color:var(--red)">· didn’t geocode</span>') + "</div></div>" : "") +
        '<div><div class="lab">Languages</div><div class="val">' + esc(c.langsText || "—") + '</div></div><div><div class="lab">Placement</div><div class="val">' + (c.placed_by_hand ? "corrected by hand" : c.seen ? "from last seen" : c.placed ? "from city name" : "unplaced") + "</div></div></div>" +
        (socials.length ? '<div><div class="lab">Social</div><div class="chips">' + socials.map((s) => '<a class="chip" target="_blank" rel="noopener" href="' + esc(socialUrl(s[1], c[s[1]])) + '" style="border-bottom:1px solid var(--rule)">' + s[0] + "</a>").join("") + "</div></div>" : "") +
        (c.met_story ? '<div><div class="lab">How we met</div><p>' + esc(c.met_story) + "</p></div>" : "") +
        (c.notes ? '<div><div class="lab">Notes</div><p>' + esc(c.notes) + "</p></div>" : "") +
        (c.gift_ideas ? '<div><div class="lab">Gift ideas</div><p style="font-style:italic">' + esc(c.gift_ideas) + "</p></div>" : "") +
        (c.circle.length ? '<div><div class="lab">Circle</div><div class="chips">' + c.circle.map((id) => { const m = byId(id); return m ? '<button class="chip" data-go="' + id + '">' + esc(m.name) + "</button>" : ""; }).join("") + "</div></div>" : "") +
      "</div>") +
    (tl.length ? '<div class="sect" style="border-bottom:none"><div><div class="lab">History</div><div style="margin-top:12px">' +
      tl.map((h) => '<div class="tl"><div class="spine"><s style="background:' + (h.mint ? "var(--mint)" : "var(--brown)") + '"></s><u></u></div><div class="body"><div class="r"><span class="lab" style="color:' + (h.mint ? "var(--mintInk)" : "var(--brown)") + '">' + esc(h.kind) + '</span><span class="lab" style="margin-left:auto">' + esc(fmtDate(h.date)) + "</span></div>" + (h.text ? '<div class="t">' + esc(h.text) + "</div>" : "") + "</div></div>").join("") +
      "</div></div></div>" : "") +
    "</div>";
  card.classList.add("open");
  card.querySelector(".cardScroll").scrollTop = 0;
  if (isNew && S.editing) { const f = card.querySelector('[data-edit="name"]'); if (f) f.focus(); }
}

async function commitEdits() {
  const e = S.edits, patch = {}; S.edits = {}; S.editing = false;
  Object.keys(e).forEach((k) => { patch[k] = k === "languages" || k === "tags" ? e[k].split(",").map((s) => s.trim()).filter(Boolean) : e[k].trim() || null; });
  if (patch.birthday) { const p = splitBday(patch.birthday); if (!validBday(p.d, p.m)) { toast(patch.birthday + " isn’t a real date — birthday not changed."); delete patch.birthday; } }
  if (S.selected === NEW) {
    if (!patch.name) { S.selected = null; renderAll(); return; }
    S.busy = "Placing " + patch.name + "…"; renderStats();
    const row = Object.assign({ languages: [], tags: [], circle: [], source: "manual", placed_by_hand: false }, await applyGeo(patch));
    S.busy = "";
    const saved = await Store.insert("contacts", row);
    S.selected = saved.id; glideTo(byId(saved.id)); renderAll(); return;
  }
  if (!Object.keys(patch).length) { renderAll(); return; }
  if (patch.city !== undefined || patch.home_city !== undefined || patch.last_seen_city !== undefined) { S.busy = "Placing…"; renderStats(); await applyGeo(patch); S.busy = ""; }
  await Store.patch("contacts", S.selected, patch);
  if (patch.city !== undefined || patch.last_seen_city !== undefined) glideTo(byId(S.selected));
  renderAll();
}
async function acceptEvent(ev) {
  const patch = Object.assign({}, ev.proposed_patch || {});
  if (patch.city) await applyGeo(patch);
  if (Object.keys(patch).length) await Store.patch("contacts", ev.contact_id, patch);
  await Store.patch("contact_events", ev.id, { status: "accepted" });
  renderAll(); select(ev.contact_id);
}

/* ---------- import ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function pick(o, keys) { const norm = {}; Object.keys(o).forEach((h) => { norm[h.toLowerCase().replace(/[^a-z0-9]/g, "")] = o[h]; }); for (const k of keys) if (norm[k] && norm[k].trim()) return norm[k].trim(); return ""; }
function fromCSV(text) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const head = rows[0];
  return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i] || ""; });
    const name = pick(o, ["name", "fullname", "displayname"]) || [pick(o, ["firstname", "givenname"]), pick(o, ["lastname", "familyname", "surname"])].filter(Boolean).join(" ");
    return { name, email: pick(o, ["email", "emailaddress", "email1value", "email1", "primaryemail", "emailaddress1"]), city: pick(o, ["city", "location", "address1city", "homecity", "addresscity", "homeaddresscity"]), job: pick(o, ["title", "jobtitle", "organization1title", "position"]), company: pick(o, ["company", "organization", "organization1name", "organizationname", "employer"]), birthday: pick(o, ["birthday", "birthdate", "dob"]), notes: pick(o, ["notes", "note"]) };
  }).filter((p) => p.name);
}
function fromVCF(text) {
  const out = []; let cur = null;
  text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).forEach((line) => {
    if (/^BEGIN:VCARD/i.test(line)) cur = { name: "", email: "", city: "", job: "", company: "", birthday: "", notes: "" };
    else if (/^END:VCARD/i.test(line)) { if (cur && cur.name) out.push(cur); cur = null; }
    else if (cur) { const i = line.indexOf(":"); if (i < 0) return; const key = line.slice(0, i).split(";")[0].toUpperCase(), val = line.slice(i + 1).trim();
      if (key === "FN") cur.name = val; else if (key === "N" && !cur.name) cur.name = val.split(";").slice(0, 2).reverse().join(" ").trim();
      else if (key === "EMAIL" && !cur.email) cur.email = val; else if (key === "ORG") cur.company = val.split(";")[0]; else if (key === "TITLE") cur.job = val;
      else if (key === "ADR" && !cur.city) cur.city = val.split(";")[3] || ""; else if (key === "BDAY") cur.birthday = val; else if (key === "NOTE") cur.notes = val.replace(/\\n/g, "\n"); }
  });
  return out;
}
function fromICS(text) {
  // Birthday events from calendar exports (Google "Birthdays" calendar, Apple, Outlook). One contact per person, keyed by name.
  const by = {}, strip = (v) => v.replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
  let cur = null;
  text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).forEach((line) => {
    if (/^BEGIN:VEVENT/i.test(line)) cur = { summary: "", start: "", desc: "", cat: "" };
    else if (/^END:VEVENT/i.test(line)) { if (cur) { const name = bdayName(cur); if (name && cur.start) by[name.toLowerCase()] = by[name.toLowerCase()] || { name, email: "", city: "", job: "", company: "", birthday: cur.start, notes: "" }; } cur = null; }
    else if (cur) { const i = line.indexOf(":"); if (i < 0) return; const key = line.slice(0, i).split(";")[0].toUpperCase(), val = strip(line.slice(i + 1));
      if (key === "SUMMARY") cur.summary = val; else if (key === "DTSTART") cur.start = val.slice(0, 8); else if (key === "DESCRIPTION") cur.desc = val; else if (key === "CATEGORIES") cur.cat = val; }
  });
  return Object.values(by);
}
function bdayName(ev) {
  const s = ev.summary; if (!s) return "";
  if (!/birthday|bday|geburtstag|cumplea|anniversaire|compleanno|aniversário|verjaardag|🎂/i.test(s + " " + ev.cat + " " + ev.desc)) return "";
  let m;
  if ((m = s.match(/^(.+?)['’]s?\s+birthday/i))) return m[1].trim();
  if ((m = s.match(/^birthday\s*[:\-–]\s*(.+)$/i))) return m[1].trim();
  if ((m = s.match(/^(.+?)\s*[\-–:]\s*birthday$/i))) return m[1].trim();
  if ((m = s.match(/^(.+?)\s*\(birthday\)$/i))) return m[1].trim();
  if ((m = s.match(/^🎂\s*(.+)$/))) return m[1].trim();
  if ((m = s.match(/^(.+?)\s+(?:hat\s+)?geburtstag/i))) return m[1].trim();
  if ((m = s.match(/^cumplea[ñn]os\s+de\s+(.+)$/i))) return m[1].trim();
  if ((m = s.match(/^anniversaire\s+(?:de\s+|d['’])(.+)$/i))) return m[1].trim();
  return s.replace(/\b(birthday|bday)\b/ig, "").replace(/[\-–:()🎂]/g, " ").replace(/\s+/g, " ").trim();
}
function normBday(s) {
  if (!s) return ""; s = s.trim(); let m;
  if ((m = s.match(/^(?:\d{4}|-)?-?(\d{2})-?(\d{2})$/))) return +m[2] + " " + MONTHS[+m[1] - 1];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/))) return +m[2] + " " + MONTHS[+m[1] - 1];
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})/)) && MONTHS.map((x) => x.toLowerCase()).indexOf(m[2].toLowerCase()) >= 0) return +m[1] + " " + m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase();
  const d = new Date(s); return isNaN(d) ? s : d.getDate() + " " + MONTHS[d.getMonth()];
}
async function runImport(parsed, filename) {
  if (!parsed.length) { toast(/\.ics$/i.test(filename) ? "No birthday events found in " + filename + "." : "No contacts found in " + filename + "."); return; }
  let added = 0, review = 0, same = 0;
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]; S.busy = "Importing " + (i + 1) + "/" + parsed.length + " · " + p.name; renderStats(); renderRail();
    const ref = (p.email || "").toLowerCase();
    const ex = people().find((c) => (ref && (c.external_ref || "").toLowerCase() === ref) || c.name.toLowerCase() === p.name.toLowerCase());
    if (!ex) {
      let g = null; if (p.city) { const cached = geoCache[p.city.toLowerCase()] !== undefined; g = await geocode(p.city); if (!cached) await sleep(1100); }
      await Store.insert("contacts", { name: p.name, job: p.job || null, company: p.company || null, city: p.city || null, lat: g ? g.lat : null, lon: g ? g.lon : null, tz_offset: g ? Math.round(g.lon / 15) : null, birthday: normBday(p.birthday) || null, notes: p.notes || null, languages: [], tags: [], circle: [], source: "import", external_ref: ref || null, placed_by_hand: false });
      added++;
    } else {
      const patch = {}, lines = [], nb = normBday(p.birthday);
      if (p.city && p.city.toLowerCase() !== (ex.lives_city || "").toLowerCase()) { patch.city = p.city; lines.push("lives in " + p.city + (ex.lives_city ? ", card says " + ex.lives_city : "")); }
      if (p.job && p.job !== (ex.job || "")) { patch.job = p.job; lines.push("job: " + p.job); }
      if (p.company && p.company !== (ex.company || "")) { patch.company = p.company; lines.push("company: " + p.company); }
      if (nb && nb !== (ex.birthday || "")) { patch.birthday = nb; lines.push("birthday: " + nb); }
      if (ref && !ex.external_ref) await Store.patch("contacts", ex.id, { external_ref: ref });
      if (Object.keys(patch).length) {
        await Store.insert("contact_events", { contact_id: ex.id, kind: patch.city ? "location" : patch.job || patch.company ? "work" : "birthday", headline: ex.name.split(" ")[0] + " — " + lines.join("; "), detail: "From " + filename + ". Accept to update the card.", proposed_patch: patch, status: "pending", occurred_at: new Date().toISOString() });
        review++;
      } else same++;
    }
    drawGlobe();
  }
  S.busy = ""; S.lastImport = { added, review, same, file: filename }; S.tab = "sync"; renderAll();
  toast("Imported " + filename + ": " + added + " added, " + review + " to review.");
}

/* ---------- calendar feed (Contlas → calendar) ---------- */
function icsText(list, trips) {
  const now = new Date(), y = now.getFullYear(), pad = (n) => String(n).padStart(2, "0"), stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc2 = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
  const ev = list.map((c) => { const p = String(c.birthday || "").trim().split(/\s+/), d = parseInt(p[0], 10), mi = MONTHS.indexOf(p[1]); if (isNaN(d) || mi < 0) return "";
    const leap = mi === 1 && d === 29, sy = leap ? 2024 : y, d1 = sy + pad(mi + 1) + pad(d), nx = new Date(sy, mi, d + 1), d2 = nx.getFullYear() + pad(nx.getMonth() + 1) + pad(nx.getDate());
    return ["BEGIN:VEVENT", "UID:contlas-bday-" + c.id + "@contlas", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d1, "DTEND;VALUE=DATE:" + d2, leap ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "RRULE:FREQ=YEARLY", "SUMMARY:" + esc2(c.name + "’s birthday"), "DESCRIPTION:" + esc2("From Contlas. Edit the birthday in Contlas, not here."), "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n"); }).filter(Boolean);
  const dstr = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()), plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  (trips || []).forEach((t) => { const i = tripInfo(t), s = ymd(t.start_date), e = ymd(t.end_date), names = i.near.slice(0, 20).map((x) => x.c.name + (x.c.city ? " (" + x.c.city + ")" : "")).join(", "), bd = i.bdays.map((x) => x.c.name + " " + shortDay(x.on)).join(", ");
    const desc = (i.near.length ? i.near.length + " within " + TRIP_KM + " km: " + names : "Nobody you know within " + TRIP_KM + " km yet.") + (bd ? "\nBirthdays while there: " + bd : "") + "\nFrom Contlas.";
    ev.push(["BEGIN:VEVENT", "UID:contlas-trip-" + t.id + "@contlas", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + dstr(s), "DTEND;VALUE=DATE:" + dstr(plus(e, 1)), "SUMMARY:" + esc2("Trip: " + t.city + " · " + i.near.length + " nearby"), "DESCRIPTION:" + esc2(desc), "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n"));
    const h = plus(s, -TRIP_LEAD); if (h >= today0()) ev.push(["BEGIN:VEVENT", "UID:contlas-trip-" + t.id + "-headsup@contlas", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + dstr(h), "DTEND;VALUE=DATE:" + dstr(plus(h, 1)), "SUMMARY:" + esc2(t.city + " in 1 week — tell people you’re coming"), "DESCRIPTION:" + esc2(desc), "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n")); });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Contlas//Birthdays//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Contlas · birthdays & trips", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"].concat(ev, "END:VCALENDAR").join("\r\n").split("\r\n").map(icsFold).join("\r\n") + "\r\n";
}
function icsFold(l) { const ch = Array.from(l); if (ch.length <= 70) return l; const out = []; for (let i = 0; i < ch.length; i += 70) out.push((i ? " " : "") + ch.slice(i, i + 70).join("")); return out.join("\r\n"); }
function downloadICS() {
  const list = people().filter((c) => c.birthday), tr = upcomingTrips(); if (!list.length && !tr.length) return toast("No birthdays or trips yet.");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([icsText(list, tr)], { type: "text/calendar" })); a.download = "contlas-birthdays.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(list.length + " birthdays, " + tr.length + " trips exported. A file is a snapshot — use the live link to stay in sync.");
}
async function loadFeed(create) {
  if (Store.mode !== "supabase" || !session) return;
  let { data, error } = await sb.from("feed_tokens").select("token").eq("user_id", session.user.id).maybeSingle(); if (error) throw error;
  if (!data && create) { const r = await sb.from("feed_tokens").insert({ user_id: session.user.id }).select("token").single(); if (r.error) throw r.error; data = r.data; }
  S.feedUrl = data ? CFG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/birthdays-ics?t=" + data.token : "";
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch (e) { const i = $("feedUrl"); if (i) { i.select(); document.execCommand("copy"); } } }

/* ---------- city sheet ---------- */
function openCity(city) {
  const grp = cities(people()).find((g) => g.city === city); if (!grp) return;
  $("cityName").textContent = city;
  $("cityMeta").textContent = grp.lat.toFixed(2) + "° / " + grp.lon.toFixed(2) + "° · " + grp.people.length + (grp.people.length === 1 ? " person" : " people") + " here · " + timeLabel(grp.people[0]) + " local";
  $("modal").classList.add("open");
  const mapSvg = d3.select("#cityMap"), w = $("cityMap").getBoundingClientRect().width || 740;
  mapSvg.attr("viewBox", "0 0 " + w + " 210").selectAll("*").remove();
  const proj = d3.geoMercator().center([grp.lon, grp.lat]).scale(2600).translate([w / 2, 105]);
  if (S.land) mapSvg.append("path").datum(S.land).attr("d", d3.geoPath(proj)).attr("fill", "#DCD2BB").attr("stroke", "#C0B49B");
  mapSvg.append("g").selectAll("g").data(grp.people).join("g")
    .attr("transform", (c, i) => { const b = proj([c.lon, c.lat]), ang = (i / Math.max(1, grp.people.length)) * Math.PI * 2 - Math.PI / 2, rr = grp.people.length > 1 && !c.placed_by_hand ? 44 : 0; return "translate(" + (b[0] + Math.cos(ang) * rr) + "," + (b[1] + Math.sin(ang) * rr * 0.6) + ")"; })
    .style("cursor", "pointer").on("click", (e, c) => { $("modal").classList.remove("open"); select(c.id); })
    .call((g) => { g.append("circle").attr("r", 5.5).attr("fill", "#8A5A32").attr("stroke", "#F4EEE2").attr("stroke-width", 2); g.append("text").attr("y", 20).attr("text-anchor", "middle").attr("font-family", "'IBM Plex Mono', monospace").attr("font-size", 10).attr("fill", "#574E3F").text((c) => c.name.split(" ")[0]); });
  $("cityList").innerHTML = grp.people.map((c) => '<div class="crow" data-id="' + c.id + '"><div style="flex:1"><div class="nm">' + esc(c.name) + '</div><div class="sub">' + esc([c.job, c.company].filter(Boolean).join(", ")) + (c.home_city ? " · from " + esc(c.home_city) : "") + '</div></div><div class="stats">' + esc(lastSpoke(c)) + "</div></div>").join("");
}

/* ---------- events ---------- */
$("tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { S.tab = b.dataset.tab; renderRail(); } });
$("search").addEventListener("input", (e) => { S.query = e.target.value; renderRail(); drawGlobe(); });
$("addBtn").addEventListener("click", () => { if (S.editing) return; S.selected = NEW; S.editing = true; S.logOpen = false; S.edits = {}; renderCard(); });
$("heatBtn").addEventListener("click", () => { S.heat = !S.heat; $("heatBtn").textContent = "Density " + (S.heat ? "on" : "off"); $("heatBtn").classList.toggle("on", S.heat); drawGlobe(); });
$("stats").addEventListener("click", (e) => {
  if (e.target.id === "signOut") run(async () => { await sb.auth.signOut(); });
  if (e.target.id === "connectLink") { localStorage.removeItem(LS_DEMO); if (LOCKED) location.reload(); else showGate("setup"); }
  if (e.target.id === "unplacedLink") { S.tab = "city"; S.query = ""; $("search").value = ""; renderRail(); $("railBody").scrollTop = 0; }
});
$("reconnect").addEventListener("click", (e) => {
  const reach = e.target.closest("[data-reach]"), snooze = e.target.closest("[data-snooze]");
  if (reach) select(reach.dataset.reach);
  const to = e.target.closest("[data-tripopen]"); if (to) { S.tab = "trip"; S.openTrip = to.dataset.tripopen; const t = D.trips.find((x) => x.id === to.dataset.tripopen); if (t) glideTo({ placed: true, lat: t.lat, lon: t.lon }); renderRail(); $("railBody").scrollTop = 0; }
  if (snooze) run(async () => { await Store.snooze(snooze.dataset.snooze, new Date(Date.now() + 30 * DAY).toISOString()); renderRail(); });
});
$("railBody").addEventListener("click", (e) => {
  const acc = e.target.closest("[data-acc]"), dis = e.target.closest("[data-dis]"), op = e.target.closest("[data-open]");
  if (acc) return run(() => acceptEvent(D.events.find((x) => x.id === acc.dataset.acc)));
  if (dis) return run(async () => { await Store.patch("contact_events", dis.dataset.dis, { status: "dismissed" }); renderAll(); });
  if (op) { const ev = D.events.find((x) => x.id === op.dataset.open); if (ev) select(ev.contact_id); return; }
  if (e.target.closest("#importBtn")) return $("fileIn").click();
  if (e.target.closest("#icsDl")) return downloadICS();
  if (e.target.closest("#feedCopy")) return run(async () => { if (!S.feedUrl) await loadFeed(true); await copyText(S.feedUrl); renderRail(); toast("Link copied. Paste it into your calendar’s “subscribe from URL”."); });
  if (e.target.closest("#feedRotate")) return run(async () => { if (!confirm("Reset the link? Calendars using the old one stop updating.")) return; await sb.from("feed_tokens").delete().eq("user_id", session.user.id); S.feedUrl = ""; await loadFeed(true); renderRail(); toast("New link created."); });
  if (e.target.closest("#bdNewAdd")) return addBdayPerson();
  if (e.target.closest("#tripSave")) return run(saveTrip);
  const th = e.target.closest("[data-trip]"); if (th) { S.openTrip = S.openTrip === th.dataset.trip ? "" : th.dataset.trip; const t = D.trips.find((x) => x.id === th.dataset.trip); if (t && S.openTrip) glideTo({ placed: true, lat: t.lat, lon: t.lon }); return renderRail(); }
  const tg = e.target.closest("[data-tripgo]"); if (tg) { const t = D.trips.find((x) => x.id === tg.dataset.tripgo); if (t) glideTo({ placed: true, lat: t.lat, lon: t.lon }); return; }
  const tdl = e.target.closest("[data-tripdel]"); if (tdl) { const t = D.trips.find((x) => x.id === tdl.dataset.tripdel); if (t && confirm("Delete the " + t.city + " trip?")) run(async () => { await Store.remove("trips", t.id); renderAll(); }); return; }
  const row = e.target.closest(".prow"); if (row) select(row.dataset.id);
});
$("railBody").addEventListener("change", (e) => {
  const r = e.target.closest("[data-bdid]"); if (!r) return;
  const d = r.querySelector("[data-bdd]").value, m = r.querySelector("[data-bdm]").value; if (!d || !m) return;
  if (!validBday(d, m)) { r.classList.remove("saved"); return toast(d + " " + m + " isn’t a real date."); }
  run(async () => { await Store.patch("contacts", r.dataset.bdid, { birthday: d + " " + m }); r.classList.add("saved"); renderTabs(); drawGlobe(); });
});
$("railBody").addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "tripCity") S.tripDraft.city = e.target.value; else if (id === "tripFrom") S.tripDraft.from = e.target.value; else if (id === "tripTo") S.tripDraft.to = e.target.value; else if (id === "bdNewName") S.bdDraft = e.target.value;
});
$("railBody").addEventListener("keydown", (e) => { if (e.key !== "Enter") return; if (e.target.id === "bdNewName") addBdayPerson(); if (e.target.id === "tripCity") run(saveTrip); });
function addBdayPerson() {
  const name = ($("bdNewName").value || "").trim(), d = $("bdNewD").value, m = $("bdNewM").value;
  if (!name) return $("bdNewName").focus();
  if (!d || !m) return toast("Pick a day and month.");
  if (!validBday(d, m)) return toast(d + " " + m + " isn’t a real date.");
  if (people().some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast(name + " is already in Contlas — set the birthday on their row below.");
  run(async () => { await Store.insert("contacts", { name, birthday: d + " " + m, languages: [], tags: [], circle: [], source: "manual", placed_by_hand: false }); S.bdDraft = ""; renderAll(); toast(name + " added · " + d + " " + m + "."); const f = $("bdNewName"); if (f) f.focus(); });
}
async function saveTrip() {
  const dr = S.tripDraft, city = dr.city.trim();
  if (!city || !dr.from || !dr.to) return toast("Add a city and both dates.");
  let from = dr.from, to = dr.to; if (to < from) { const x = from; from = to; to = x; }
  S.busy = "Finding " + city + "…"; renderStats();
  const g = await geocode(city); S.busy = ""; renderStats();
  if (!g) return toast("Couldn’t find “" + city + "”. Try “City, Country”.");
  const t = await Store.insert("trips", { city, lat: g.lat, lon: g.lon, start_date: from, end_date: to });
  S.tripDraft = { city: "", from: "", to: "" }; S.openTrip = t.id; glideTo({ placed: true, lat: g.lat, lon: g.lon }); renderAll();
}
$("railBody").addEventListener("mouseover", (e) => { const row = e.target.closest(".prow"), id = row ? row.dataset.id : null; if (id !== S.hover) { S.hover = id; drawGlobe(); syncHover(); } });
$("railBody").addEventListener("mouseleave", () => { S.hover = null; drawGlobe(); syncHover(); });
$("fileIn").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => run(() => { const t = rd.result, head = t.slice(0, 200); return runImport(/\.ics$/i.test(f.name) || /BEGIN:VCALENDAR/i.test(head) ? fromICS(t) : /\.vcf$/i.test(f.name) || /BEGIN:VCARD/i.test(head) ? fromVCF(t) : fromCSV(t), f.name); });
  rd.readAsText(f);
});
$("card").addEventListener("click", (e) => {
  if (e.target.closest("#cardBack")) return S.editing ? run(() => commitEdits().then(deselect)) : deselect();
  if (e.target.closest("#cardCancel")) { S.edits = {}; S.editing = false; if (S.selected === NEW) S.selected = null; return renderAll(); }
  if (e.target.closest("#cardEdit")) { if (S.editing) return run(commitEdits); S.editing = true; S.logOpen = false; return renderCard(); }
  if (e.target.closest("#logBtn")) { S.logOpen = true; S.editing = false; return renderCard(); }
  if (e.target.closest("#logCancel")) { S.logOpen = false; return renderCard(); }
  const ch = e.target.closest("[data-ch]"); if (ch) { S.logChannel = ch.dataset.ch; return renderCard(); }
  if (e.target.closest("#logSave")) { const line = ($("logLine") && $("logLine").value.trim()) || ""; S.logOpen = false; return run(async () => { await Store.insert("conversations", { contact_id: S.selected, channel: S.logChannel.toLowerCase(), note: line || null, happened_at: new Date().toISOString() }); renderAll(); }); }
  if (e.target.closest("#zoomBtn")) return openCity(byId(S.selected).city || "Unnamed place");
  if (e.target.closest("#placeBtn")) return run(async () => { const c = byId(S.selected); S.busy = "Placing…"; renderStats(); const patch = await applyGeo({ city: c.city }); S.busy = ""; if (patch.lat == null) toast("Couldn’t find “" + c.city + "”. Try “City, Country”."); await Store.patch("contacts", c.id, patch); glideTo(byId(c.id)); renderAll(); });
  if (e.target.closest("#deleteBtn")) { const c = byId(S.selected); if (c && confirm("Delete " + c.name + " and their history?")) run(async () => { await Store.remove("contacts", c.id); S.edits = {}; deselect(); }); return; }
  const go = e.target.closest("[data-go]"); if (go) return select(go.dataset.go);
});
function cardInput(e) { const f = e.target.closest("[data-edit]"); if (f) S.edits[f.dataset.edit] = f.value;
  if (e.target.closest("[data-bdpart]")) { const d = $("card").querySelector('[data-bdpart="d"]').value, m = $("card").querySelector('[data-bdpart="m"]').value; S.edits.birthday = d && m ? d + " " + m : ""; } }
$("card").addEventListener("input", cardInput); $("card").addEventListener("change", cardInput);
$("cityClose").addEventListener("click", () => $("modal").classList.remove("open"));
$("modal").addEventListener("click", (e) => { if (e.target === $("modal")) return $("modal").classList.remove("open"); const row = e.target.closest(".crow"); if (row) { $("modal").classList.remove("open"); select(row.dataset.id); } });
window.addEventListener("resize", sizeGlobe);

/* ---------- gate: setup & sign-in ---------- */
function showGate(kind) {
  const g = $("gate"), b = $("gateBox"); g.classList.add("open");
  if (kind === "setup") {
    b.innerHTML = '<div class="eyebrow">Contlas</div><h2>Connect your database</h2>' +
      '<p>Create a free project at supabase.com, run <span class="mono">supabase/schema.sql</span> in its SQL Editor, then paste the two values from Project Settings → API.</p>' +
      '<label class="field"><span class="lab">Project URL</span><input id="gUrl" placeholder="https://xxxx.supabase.co" value="' + esc(CFG.supabaseUrl) + '" /></label>' +
      '<label class="field"><span class="lab">Anon public key</span><input id="gKey" placeholder="eyJ…" value="' + esc(CFG.supabaseAnonKey) + '" /></label>' +
      '<div class="err" id="gErr"></div>' +
      '<div class="row"><button class="btn solid" id="gConnect">Connect</button><button class="btn" id="gDemo">Try the demo first</button></div>' +
      '<p style="font-size:12px;color:var(--ink3)">Tip: put these two values in <span class="mono">js/config.js</span> and this screen is skipped for good. Demo keeps everything in this browser only. The anon key is safe to use here — row-level security keeps each account’s contacts private.</p>';
    $("gConnect").onclick = () => {
      const url = $("gUrl").value.trim().replace(/\/$/, ""), key = $("gKey").value.trim();
      if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) { $("gErr").textContent = "That doesn’t look like a Supabase URL + anon key."; return; }
      localStorage.setItem("contlas.config", JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key })); localStorage.removeItem(LS_DEMO); location.reload();
    };
    $("gDemo").onclick = () => { localStorage.setItem(LS_DEMO, "1"); Store.mode = "local"; start(); };
  } else {
    b.innerHTML = '<div class="eyebrow">Contlas</div><h2 id="gTitle">Sign in</h2>' +
      '<label class="field"><span class="lab">Email</span><input id="gEmail" type="email" autocomplete="email" /></label>' +
      '<label class="field"><span class="lab">Password</span><input id="gPass" type="password" autocomplete="current-password" /></label>' +
      '<div class="err" id="gErr"></div>' +
      '<div class="row"><button class="btn solid" id="gIn">Sign in</button><button class="btn" id="gUp">Create account</button>' + (LOCKED ? (CFG.allowDemo ? '<button class="btn ghost" id="gDemo">Try the demo</button>' : "") : '<button class="btn ghost" id="gReset">Change project</button>') + '</div>' +
      '<div class="orRule"><span>or</span></div>' +
      '<button class="btn google" id="gGoogle"><svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.9 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.2z"/><path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>';
    const creds = () => ({ email: $("gEmail").value.trim(), password: $("gPass").value });
    $("gIn").onclick = async () => { $("gErr").textContent = ""; const { error } = await sb.auth.signInWithPassword(creds()); if (error) $("gErr").textContent = error.message; };
    $("gUp").onclick = async () => { $("gErr").textContent = ""; const { data, error } = await sb.auth.signUp(creds()); if (error) $("gErr").textContent = error.message; else if (!data.session) $("gErr").textContent = "Check your email to confirm the account, then sign in."; };
    $("gPass").onkeydown = (e) => { if (e.key === "Enter") $("gIn").click(); };
    $("gGoogle").onclick = async () => { $("gErr").textContent = ""; const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }); if (error) $("gErr").textContent = error.message; };
    if ($("gReset")) $("gReset").onclick = () => { localStorage.removeItem("contlas.config"); showGate("setup"); };
    if ($("gDemo")) $("gDemo").onclick = () => { localStorage.setItem(LS_DEMO, "1"); location.reload(); };
  }
}
async function start() {
  $("gate").classList.remove("open"); started = true;
  try { await Store.load(); } catch (e) { console.error(e); toast("Couldn’t load: " + e.message + ". Did you run schema.sql?"); }
  try { await loadFeed(false); } catch (e) { console.warn("feed_tokens missing — re-run schema.sql", e); }
  S.selected = null; S.editing = false; S.edits = {}; renderAll(); sizeGlobe();
}
async function boot() {
  const demo = localStorage.getItem(LS_DEMO) === "1";
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && !demo && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey); Store.mode = "supabase";
    const { data } = await sb.auth.getSession(); session = data.session;
    sb.auth.onAuthStateChange((ev, s) => { const had = !!session; session = s; if (s && !had) start(); if (!s && had) { D = { contacts: [], conversations: [], events: [], snoozes: [], trips: [] }; started = false; renderAll(); showGate("signin"); } });
    return session ? start() : showGate("signin");
  }
  if (!demo) return showGate("setup");
  Store.mode = "local"; start();
}
sizeGlobe(); renderStats(); boot();
fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()).then((topo) => { S.land = topojson.feature(topo, topo.objects.countries); drawGlobe(); }).catch(() => {});
