# K7 ESPORTS — website + admin CMS

A responsive Counter-Strike 2 team website with an admin panel, player roster, editable stats, news, matches, highlights, theme/language settings, and uploads. The project is designed for Node.js + Render, with Supabase used for persistent shared content and media.

## Important: what works and what must be configured

- The site and admin UI are included in this archive.
- The server checks the admin password; it is **not hard-coded into the browser code**.
- To make edits show for every visitor and survive Render restarts/deploys, configure Supabase as below. Without Supabase, local testing stores JSON on disk, which is **not durable storage on Render**.
- Player photos/news cover uploads require Supabase Storage.
- This archive cannot automatically change your existing Render deployment; you must deploy it to your Render service (or a new service).
- Example player names and statistics are placeholders. Replace them with real team data in the admin panel.

## 1. Create the Supabase database and media bucket

1. Create a project at https://supabase.com/.
2. Open **SQL Editor** in your Supabase project.
3. Copy all of `supabase/schema.sql` into a new query and run it.
4. In **Project Settings → API**, copy the project URL and the **service-role/secret key**. The service key is a server-only secret: never put it in `public/`, frontend JS, screenshots, or a public GitHub file.

## 2. Put the project on GitHub

1. Download and extract this ZIP.
2. Create/open your GitHub repository and upload the project files, keeping folders such as `public/` and `supabase/`.
3. Do not upload a real `.env` file. `.gitignore` excludes it.

## 3. Deploy on Render

1. In Render choose **New → Web Service** and connect your GitHub repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. In the service's **Environment** settings add:
   - `NODE_ENV` = `production`
   - `ADMIN_PASSWORD` = the admin password you want (if keeping the password previously chosen in chat, enter it here manually; do not commit it into source code)
   - `SESSION_SECRET` = a long random secret (Render can generate one)
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your server-only Supabase service-role/secret key
   - `SUPABASE_BUCKET` = `k7-media`
5. Deploy. Visit `/api/health`; for a live shared deployment it should report `persistence: "supabase"` and `configured: true`.

## 4. Open the admin panel

On the website, click/tap the small gear icon in the footer three times quickly, or right-click it on desktop. Enter the password you set as `ADMIN_PASSWORD`. The panel supports editing:

- Players: nickname, role, region, rating, visibility and photo URL/upload.
- Statistics: add/edit/remove metrics, including Rating 3.0, Winrate, Entrying and Utility.
- News: headline, date, article text and cover image URL/upload.
- Matches: opponent, event, date, score and result.
- Highlights: title, public video link and cover image URL/upload.
- Design: region label, tagline, four accent palettes, light/dark appearance, default language and social links.

The public site reads content from the server; successful admin saves are stored in Supabase and are shared across visitors. The public page refreshes content periodically while open.

## 5. Local preview (optional)

Install Node.js 18 or newer, then in the project directory run:

```bash
npm install
cp .env.example .env
# Fill in ADMIN_PASSWORD, SESSION_SECRET, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
npm start
```

Open `http://localhost:3000`. For local work without Supabase, the public page still renders, but admin uploads and durable shared storage are unavailable. Never use the example session secret for a public deployment.

## Troubleshooting

- **Admin says not configured:** add `ADMIN_PASSWORD` and a long `SESSION_SECRET` in Render Environment, then redeploy.
- **Edits fail to save:** check `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and that `supabase/schema.sql` ran successfully. Review Render logs.
- **Uploads fail:** confirm the `k7-media` public bucket exists and the service-role key is configured. The server accepts JPG, PNG, WEBP, GIF, MP4 and WEBM up to 20 MB.
- **Changes don't survive a Render restart:** ensure `/api/health` says `persistence: "supabase"`; local-file fallback is not durable on typical hosted instances.
- **Admin panel security:** the password is checked server-side and rate-limited. Keep the Render environment private and never expose the Supabase service key.

## Design notes

The layout uses a dark minimalist esports look, subtle gradient lighting, no busy weapon illustrations, right-to-left viewport entrance motion, a compact five-player row on mobile, and a roomier desktop roster. Reduced-motion preferences are respected. Demo content is intentionally generic and should be replaced before launch.
