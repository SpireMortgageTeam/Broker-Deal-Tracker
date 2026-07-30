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

## Escalation email notifications (Resend)

When a broker flags a deal and clicks **Notify Ops**, everyone on the escalation
recipient list gets an email. When Ops sends a response or marks it resolved, the
broker who raised it gets an email back. Because login is a shared team password
(no per-user accounts), notifications are routed by the **broker name** → email
mapping you set in the app.

Setup is two parts — configure the app, and add the email credentials.

**A. In the app (Ops Manager → Manage Brokers):**

1. Under **Escalation alert recipients**, add the address(es) that should hear about new escalations (e.g. the ops manager's email).
2. For each broker, fill in their **Email** — that's where their "Ops responded / resolved" notices go. A broker with no email simply gets skipped.

**B. Add the email service (Resend):**

1. Create a free account at https://resend.com.
2. **Verify your domain** (Resend → Domains → Add) so mail can send from `@spiremortgage.ca`. This means adding a few DNS records (SPF/DKIM) wherever your domain is managed — Resend shows the exact records. Verification improves deliverability.
3. Create an **API key** (Resend → API Keys).
4. Add these environment variables — locally in `.env.local`, and in Vercel under **Settings → Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the API key from Resend |
   | `EMAIL_FROM` | e.g. `Spire Pipeline Tracker <alerts@spiremortgage.ca>` (must be on the verified domain) |
   | `APP_URL` | `https://broker-deal-tracker.vercel.app` (used for links in the emails) |

5. Redeploy. Until `RESEND_API_KEY` and `EMAIL_FROM` are set, the app runs normally but silently skips sending — nothing breaks.

> Testing tip: before verifying a domain, Resend lets you send from `onboarding@resend.dev`, but only to the email you signed up with. Fine for a first test; verify the domain before rolling out to the team.

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
