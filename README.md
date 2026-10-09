# Contlas · launch package

Static app — no build step. Upload this folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages) or open index.html locally.

## Run locally (Windows)
Double-click run-contlas.bat. It serves the folder on http://localhost:8143 using Node (contlas-serve.js) or Python, and opens the browser.

## Files
- run-contlas.bat / contlas-serve.js — local launcher
- index.html — page shell (markup only)
- css/contlas.css — all styles
- js/config.js — Supabase URL + anon key. Fill in to skip the setup screen.
- js/app.js — app logic (globe, rail, cards, import, sync, auth)
- js/atlas-data.js — demo seed data (Demo mode only)
- supabase/schema.sql — database tables, RLS policies, triggers
- supabase/functions/birthdays-ics/index.ts — live calendar feed (edge function)

## Launch in 10 minutes
1. supabase.com → New project.
2. SQL Editor → paste supabase/schema.sql → Run.
3. Authentication → Providers → Email enabled. Turn off "Confirm email" for testing.
3b. Google sign-in (optional): Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: https://YOURPROJECT.supabase.co/auth/v1/callback. Then Supabase → Authentication → Providers → Google → paste Client ID + Secret, enable. Add your app URLs (http://localhost:8143 and your live domain) under Authentication → URL Configuration → Redirect URLs.
4. Project Settings → API → copy Project URL + anon public key into js/config.js.
5. Deploy the folder. In Supabase → Authentication → URL Configuration, set Site URL to your domain.
6. Open the site, create an account, sign in. Import a CSV/vCard or click + Add.
7. Birthdays: Contlas owns them, the calendar only shows them.
   - One-time seed: Google's built-in "Birthdays" calendar comes from Google Contacts and is NOT in Calendar exports — export Google Contacts (CSV or vCard) instead; birthdays come along. Birthdays you created as your own calendar events: Google Calendar → Settings → Import & export → Export, or Apple Calendar → File → Export. Import either file in Sync.
   - After seeding, delete or hide the old birthday events/calendar so you don't see each one twice.
   - Live feed to your calendar (needs the Supabase CLI once):
       supabase login && supabase link --project-ref YOURPROJECT
       supabase functions deploy birthdays-ics --no-verify-jwt
     Re-run supabase/schema.sql (adds feed_tokens). In the app: Sync → Calendar → Create link → Copy link, then
     Google Calendar → Other calendars → + → From URL · Apple Calendar → File → New Calendar Subscription · Outlook → Add calendar → Subscribe from web.
     Edits in Contlas appear in the calendar on its next refresh (Google: a few hours; Apple: per subscription setting). "Reset link" revokes the old URL.
   - No CLI? "Download .ics" gives a snapshot file to import by hand.
   - Fast entry: BDAY tab → "Missing a birthday" lists everyone without one; pick day + month and it saves instantly (Tab moves to the next row). "Add someone new" creates a person with just a name + birthday.
8. Trips: TRIPS tab → city + dates → Save. Shows everyone within 200 km and birthdays during the trip. A week before, a banner appears at the top of the rail and the calendar feed gets a "City in 1 week" event (re-deploy birthdays-ics after updating).
9. Social tracking: on a card → Edit → Instagram / LinkedIn / Facebook and "Last seen in" + date. Last seen wins: the pin moves there and trips use it; Lives is kept on the card.

## Modes
- Demo: no config → "Try the demo first" keeps data in the browser only.
- Supabase: with config → email/password accounts, data private per user via row-level security.

## External services used at runtime (all free, CDN)
d3, topojson-client, @supabase/supabase-js, world-atlas (land shapes), Google Fonts, OpenStreetMap Nominatim (geocoding, 1 req/s).

## Known limits
Desktop only. Nominatim is for personal-scale use. tz_name set by hand only. No email digests yet. See design_handoff_contacts_atlas/LAUNCH_PLAN.md for the roadmap.
