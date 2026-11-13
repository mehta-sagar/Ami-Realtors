# Ami Realtors app

Installable web app (PWA) for iPhone. Gujarati by default with an English switch.

## 1. Database (Supabase, 3 minutes)
1. Open your project > SQL Editor > New query. Paste all of `supabase/schema.sql` and press Run.
2. Project Settings > API: copy the **anon / publishable** key (not the service_role key).

## 2. Hosting (Cloudflare Pages, free)
1. dash.cloudflare.com > Workers & Pages > Create > Pages > **Upload assets**.
2. Name it (e.g. `ami-realtors`), upload this folder (or the zip), Deploy.
3. You get a link like `https://ami-realtors.pages.dev`.

## 3. On Dad's iPhone
1. Open the link in **Safari** > Share > **Add to Home Screen**.
2. Open the app > gear icon > Settings:
   - Cloud sync: paste the anon key, enter email + password, tap **Create account** (first time only).
   - App lock: set a 4 digit PIN, then turn on Face ID.
   - Phone number printed on cards, and the local vigha size.

Until cloud sync is signed in, everything is saved on the phone itself. After signing in, tap
"Upload phone data to cloud" once to move it.

## Files
- `index.html`, `css/`, `js/` : the app (no build step)
- `js/areas.js` : area list with English + Gujarati names and map pins
- `js/parse.js` : Gujarati + English speech / WhatsApp message reader
- `supabase/schema.sql` : tables, security rules, 200 km search function, area list
