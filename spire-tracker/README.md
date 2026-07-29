# Spire Pipeline Tracker

Internal broker workload + pipeline tracker for Spire Mortgage Team. Standalone app,
deployed separately from your main marketing site.

- Brokers log daily activity and manage their own deals
- Ops manager sees everyone's data, weekly rollups, and bottlenecks — automatically, no manual tallying
- Gated behind a single shared team password (nothing here is public)

## What you need before you start

1. A **Vercel account** (free tier is fine for this).
2. A **GitHub account** (to hold the code — Vercel deploys from a repo).
3. Two passwords you choose yourself:
   - `TEAM_PASSWORD` — what your brokers type to get in.
   - `SESSION_SECRET` — a long random string, never typed by anyone, just used internally to mark someone as logged in. Any long random text works (e.g. generate one at https://1password.com/password-generator or just mash the keyboard for 40 characters).

You do **not** need to touch Redis/Upstash directly — Vercel sets it up for you in step 3.

## Step 1 — Put the code on GitHub

1. Create a new **empty** repository on GitHub, e.g. `spire-pipeline-tracker`. Keep it **private**.
2. From your computer, in this folder, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/spire-pipeline-tracker.git
   git push -u origin main
   ```
   (If you're not comfortable with git commands, GitHub Desktop app does the same thing with buttons — create the repo there, drag this folder in, and click "Publish".)

## Step 2 — Import into Vercel

1. Go to https://vercel.com/new
2. Choose "Import Git Repository" and select the repo you just pushed.
3. Vercel will detect it's a Next.js app automatically. Don't deploy yet — first add the environment variables below.

## Step 3 — Add the database (Upstash Redis via Vercel Marketplace)

1. In your new Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **Upstash** → **Redis**.
3. Follow the prompts (pick the free/hobby tier, any region close to Calgary e.g. US West).
4. Once created, **connect it to this project** — Vercel will automatically add `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) to your project's environment variables. You don't need to copy/paste these yourself.

## Step 4 — Add your own environment variables

Still in the Vercel project, go to **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `TEAM_PASSWORD` | the password your team will type to log in |
| `SESSION_SECRET` | a long random string (see above) — never shared with the team |

Apply both to **Production** (and Preview if you want branch previews to work too).

## Step 5 — Deploy

Click **Deploy**. Vercel gives you a live URL like `spire-pipeline-tracker.vercel.app`.

Optional: in **Settings → Domains**, add a custom subdomain like `tracker.spiremortgage.ca` if you want something easier to share with your team (requires adding a DNS record with whoever manages your domain).

## Step 6 — First login

1. Open the URL, enter the `TEAM_PASSWORD` you set.
2. You'll land on "Who's checking in?" with no brokers yet.
3. Click **Ops Manager** → **Manage Brokers** → add your team's names.
4. Done — brokers can now pick their name and start logging.

## Updating the bottleneck threshold

Deals are flagged as "stuck" after 7 days at one stage. To change this, edit
`lib/constants.ts`:
```ts
export const BOTTLENECK_DAYS = 7; // change this number
```
Commit and push — Vercel redeploys automatically.

## A note on the login model

Everyone shares one password to get into the app, then picks their own name from a
list — there's no individual password per broker. That means anyone with the team
password could technically select someone else's name. For a small trusted team this
is a reasonable tradeoff for simplicity. If you ever want per-person accountability
(can't misattribute entries, can't see who skipped their capacity check-in), that
needs real per-user authentication — a bigger change, worth a separate conversation
if it becomes important.

## Local development (optional, for testing changes before pushing)

```
npm install
npm run dev
```
You'll need a `.env.local` file with `TEAM_PASSWORD`, `SESSION_SECRET`, and either
real or Vercel-pulled Upstash credentials (`vercel env pull .env.local` after linking
the project with `vercel link`).
