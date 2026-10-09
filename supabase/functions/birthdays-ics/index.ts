// Contlas · private calendar feed: birthdays + trips (with a heads-up a week before).
// Deploy:  supabase functions deploy birthdays-ics --no-verify-jwt
// URL:     https://PROJECT.supabase.co/functions/v1/birthdays-ics?t=TOKEN   (the app builds and copies this for you)
import { createClient } from "npm:@supabase/supabase-js@2";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TRIP_KM = 200, TRIP_LEAD = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
const dstr = (d: Date) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ymd = (s: string) => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const shortDay = (d: Date) => d.getDate() + " " + MONTHS[d.getMonth()];
function fold(l: string) { const ch = Array.from(l); if (ch.length <= 70) return l; const out: string[] = []; for (let i = 0; i < ch.length; i += 70) out.push((i ? " " : "") + ch.slice(i, i + 70).join("")); return out.join("\r\n"); }
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r, s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(s)); }
function bdayIn(b: string | null, s: Date, e: Date) { const p = (b || "").trim().split(/\s+/), d = parseInt(p[0], 10), mi = MONTHS.indexOf(p[1]); if (isNaN(d) || mi < 0) return null; for (let y = s.getFullYear(); y <= e.getFullYear(); y++) { const t = new Date(y, mi, Math.min(d, new Date(y, mi + 1, 0).getDate())); if (t >= s && t <= e) return t; } return null; }

type C = { id: string; name: string; birthday: string | null; city: string | null; lat: number | null; lon: number | null; last_seen_city: string | null; last_seen_lat: number | null; last_seen_lon: number | null };
type T = { id: string; city: string; lat: number; lon: number; start_date: string; end_date: string };

function ics(rows: C[], trips: T[]) {
  const now = new Date(), y = now.getFullYear(), stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ev: string[] = rows.filter((c) => c.birthday).map((c) => {
    const p = (c.birthday || "").trim().split(/\s+/), d = parseInt(p[0], 10), mi = MONTHS.indexOf(p[1]);
    if (isNaN(d) || mi < 0) return "";
    const leap = mi === 1 && d === 29, sy = leap ? 2024 : y, nx = new Date(sy, mi, d + 1);
    return ["BEGIN:VEVENT", "UID:contlas-bday-" + c.id + "@contlas", "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + sy + pad(mi + 1) + pad(d), "DTEND;VALUE=DATE:" + dstr(nx),
      leap ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "RRULE:FREQ=YEARLY", "SUMMARY:" + esc(c.name + "’s birthday"), "DESCRIPTION:" + esc("From Contlas. Edit the birthday in Contlas, not here."),
      "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n");
  }).filter(Boolean);

  // "Last seen wins": a contact's position is where you last saw them, else where they live.
  const placed = rows.map((c) => {
    const seen = c.last_seen_lat != null && c.last_seen_lon != null;
    return { c, city: seen ? c.last_seen_city : c.city, lat: seen ? c.last_seen_lat : c.lat, lon: seen ? c.last_seen_lon : c.lon };
  }).filter((x) => x.lat != null && x.lon != null) as { c: C; city: string | null; lat: number; lon: number }[];

  trips.filter((t) => ymd(t.end_date) >= today).forEach((t) => {
    const s = ymd(t.start_date), e = ymd(t.end_date);
    const near = placed.map((x) => ({ ...x, km: km(t, x) })).filter((x) => x.km <= TRIP_KM).sort((a, b) => a.km - b.km);
    const bd = near.map((x) => ({ n: x.c.name, on: bdayIn(x.c.birthday, s, e) })).filter((x) => x.on).sort((a, b) => +a.on! - +b.on!);
    const desc = (near.length ? near.length + " within " + TRIP_KM + " km: " + near.slice(0, 20).map((x) => x.c.name + (x.city ? " (" + x.city + ")" : "")).join(", ") : "Nobody you know within " + TRIP_KM + " km yet.") +
      (bd.length ? "\nBirthdays while there: " + bd.map((x) => x.n + " " + shortDay(x.on!)).join(", ") : "") + "\nFrom Contlas.";
    ev.push(["BEGIN:VEVENT", "UID:contlas-trip-" + t.id + "@contlas", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + dstr(s), "DTEND;VALUE=DATE:" + dstr(plus(e, 1)),
      "SUMMARY:" + esc("Trip: " + t.city + " · " + near.length + " nearby"), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n"));
    const h = plus(s, -TRIP_LEAD);
    if (h >= today) ev.push(["BEGIN:VEVENT", "UID:contlas-trip-" + t.id + "-headsup@contlas", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + dstr(h), "DTEND;VALUE=DATE:" + dstr(plus(h, 1)),
      "SUMMARY:" + esc(t.city + " in 1 week — tell people you’re coming"), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n"));
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Contlas//Birthdays//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Contlas · birthdays & trips",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H", ...ev, "END:VCALENDAR"].join("\r\n").split("\r\n").map(fold).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t");
  if (!t || !/^[a-f0-9]{48}$/.test(t)) return new Response("Missing or malformed token", { status: 400 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await sb.from("feed_tokens").select("user_id").eq("token", t).maybeSingle();
  if (!tok) return new Response("Unknown token", { status: 404 });
  const [c, tr] = await Promise.all([
    sb.from("contacts").select("id,name,birthday,city,lat,lon,last_seen_city,last_seen_lat,last_seen_lon").eq("user_id", tok.user_id),
    sb.from("trips").select("id,city,lat,lon,start_date,end_date").eq("user_id", tok.user_id),
  ]);
  if (c.error) return new Response(c.error.message, { status: 500 });
  return new Response(ics((c.data ?? []) as C[], tr.error ? [] : (tr.data ?? []) as T[]), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="contlas.ics"', "Cache-Control": "no-store" } });
});
