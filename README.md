# ScholarPath AI

AI-powered scholarship discovery, matching and application management for students in India and abroad.

## Run

Requires Node.js 22.13+ (uses the built-in `node:sqlite`). The only dependency is the Anthropic SDK.

```bash
npm install
npm start            # http://localhost:3000
npm test             # matching engine + query parser checks
npm run reset-db     # wipe and re-seed on next start
```

Demo accounts (also one-click buttons on the login page):

| Role | Email | Password |
|---|---|---|
| Student (Pro, full demo data) | demo@scholarpath.ai | demo1234 |
| Admin | admin@scholarpath.ai | admin1234 |

### AI

Set `ANTHROPIC_API_KEY` to have Claude (`claude-opus-5-5`) write Scholar AI answers, application drafts/feedback and admin data extraction.
Without a key everything still works: retrieval, matching, template drafts, heuristic feedback and rule-based extraction run locally.
Scholar AI always searches the local database first and Claude only sees the retrieved records, so it can't recommend scholarships that aren't in the database.

## Deploy to Vercel

1. Import this repo in Vercel (framework preset: **Other**, no build command). Vercel detects `server.js` and runs its default-exported handler.
2. Add the environment variable `SESSION_SECRET` (any long random string) so logins stay valid across serverless instances. Optionally add `ANTHROPIC_API_KEY`.

**On Vercel, data resets.** The database lives in `/tmp`, which is per-instance and wiped on cold starts, so it re-seeds with the demo data. The demo accounts always work, but new signups, saved items and tracker changes are temporary. For persistent data, move `db.js` to a hosted database (e.g. Supabase/Neon Postgres or Turso).

## Architecture

| File | Purpose |
|---|---|
| `server.js` | HTTP server, JSON API, auth (scrypt + signed HttpOnly session cookie), notifications, admin |
| `db.js` | SQLite schema (Users, StudentProfiles, Scholarships, EligibilityCriteria, SavedScholarships, Applications, ApplicationDocuments, Notifications, AIConversations, analytics, password resets) and seed |
| `data.js` | 39 **sample** scholarship records + demo student profile |
| `match.js` | Explainable matching engine — score, label, reasons, concerns |
| `ai.js` | Scholar AI retrieval/chat, application writing assistant, scholarship data extraction |
| `public/` | Vanilla-JS SPA (no build step): `app.js` shell/router/public pages, `pages.js` student app, `onboarding.js`, `admin.js`, `ui.js` helpers |

## Trust & data notes

- All seeded scholarships are **prototype sample records** (`is_sample=1`, `verified=0`) and say so in the UI. Names and providers are real programmes, but amounts, criteria and dates are illustrative. Deadlines are set relative to the seed date so the demo always has upcoming deadlines.
- Admins verify records (which stamps "Last verified"), mark them expired, update deadlines and feature them. AI-extracted records need an explicit review checkbox before saving.
- Match scores are capped at 97% and always shown with a verification disclaimer.

## Known prototype shortcuts

- Password reset links are shown on screen in development (no email provider). Set `NODE_ENV=production` to hide them and wire up an email service.
- "Upgrade to Pro" switches the plan without payment. Add a checkout + webhook before charging anyone.
- The login rate limiter is in-memory (single instance).
- Document checklist tracks status only; files are uploaded on the provider's own portal.
