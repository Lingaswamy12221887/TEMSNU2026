# ICICSE 2027 Conference Website

A complete conference website with a built-in editor. No npm packages to install, only Node.js **v18 or newer** (https://nodejs.org). All content, the admin password and uploaded images are stored in **your Supabase project**.

## 1. Set up Supabase (once)
1. Create a project at https://supabase.com (or use an existing one).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql` and click **Run**.
   This creates 3 tables (`site_content`, `site_backups`, `admin_credentials`) with Row Level Security on, and a private Storage bucket named `uploads`.
3. Open **Project Settings → API** and copy:
   - the **Project URL**
   - the **service_role** key (or the new **secret** key, `sb_secret_...`). Keep it private; it stays on the server and is never sent to browsers.
4. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (and optionally `ADMIN_PASSWORD`, used only the first time).

## 2. Run
- Windows: double-click `start.bat`
- Mac/Linux: `./start.sh` (or `node server.js`)

Open http://localhost:3000 (change the port with `PORT=8080`). On first start the default content is written to Supabase automatically.

### Moving existing content from the old file-based version
If you already edited the site using the old version, copy its `data` folder into this folder and run `node migrate.js` once. It imports the site content, the admin password and the uploaded images into Supabase.

## Editing
1. Scroll to the footer and click **Admin login**. Default password: `admin123` (change it in *Site settings*).
2. With **Editing: ON**, click any text on any page and type. Rich-text blocks show a formatting toolbar.
3. Hover a section to move, duplicate or delete it. Use the **+ Add** buttons for rows, cards, people, slides and sessions.
4. Bottom bar: **Menu**, **Colours & fonts**, **Site settings**, **Pages**, **Backup**.
5. Click **Save changes** to publish. Content lives in the `site_content` table, the last 20 versions in `site_backups`, and images in the `uploads` Storage bucket (you can browse all of it in the Supabase dashboard).

## Deploying
Run it on any host that keeps a Node.js process running (Render, Railway, Fly.io, a VPS...). Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `ADMIN_PASSWORD` as environment variables there instead of using `.env`. Login sessions are held in server memory, so a restart logs admins out (content is unaffected).
