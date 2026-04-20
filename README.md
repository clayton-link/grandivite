# Grandivite

A public, self-service multi-tenant SaaS platform for family event coordination. Anyone can sign up, create their own organization, and use the same features built for the Clayton family in Clayton Link. Grandivite is a fully multi-tenant fork of [Clayton Link](https://github.com/clayton-link/claytonlink).

**Status:** In development. Domain not yet purchased. Running locally at `localhost:5173`.

## Purpose

Grandivite lets any family or group set up their own private family coordination space — collecting events from family branches and sharing a monthly digest with grandparents or other recipients. It's a white-label, self-service version of Clayton Link with full organization isolation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite (SPA, no React Router — path-based root switching) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Google OAuth via Supabase Auth |
| Email | Resend (digest + nudge emails) — pending domain purchase |
| AI | Anthropic Claude API (digest drafts, nudge drafts, note polish) |
| Maps | Google Maps Places API (location autocomplete + Apple Maps deep links) |
| Hosting | Vercel (planned — not yet deployed) |
| Cron | Vercel Cron → `/api/send-nudge` (monthly nudge emails, multi-tenant) |

## Brand

- **Name:** Grandivite
- **Primary color:** `#2C5F5A` (teal)
- **Accent color:** `#E07A5F` (coral)
- **Domain:** grandivite.com (not yet purchased)
- **Supabase project:** `scwzgrijnnmimlzvwnee.supabase.co`
- **Repo:** `github.com/clayton-link/grandivite` — `main` branch

## Architecture

### Multi-Tenant Design
Every piece of data is scoped to an `org_id`. There are no hardcoded family constants. Key differences from Clayton Link:

- `adminDb.js` — all functions accept explicit `orgId` param (no hardcoded `ORG_ID`)
- `resolveUserOrg(email)` — looks up org membership from `org_members` table at sign-in
- `AdminApp.jsx` — resolves org dynamically on every sign-in
- `App.jsx` — `loadOrgAndResolveAuth()` fetches all org data from DB; redirects to `/onboarding` if user has no org
- All 9 admin sections accept `orgId` as a prop
- `writeAudit(orgId, ...)` — org-scoped audit logging
- `send-nudge.js` — iterates all orgs with `auto_nudge_enabled = true`

### Routing
`src/main.jsx` switches root component based on `window.location.pathname`:
- `/` or `/signup` → `LandingPage` (public marketing + sign-in)
- `/onboarding` → `OnboardingPage` (self-service org creation wizard)
- `/app` → `GrandiviteApp` (main family app)
- `/admin` → `AdminApp` (org admin dashboard)

### Self-Service Onboarding
`OnboardingPage.jsx` is a 3-step wizard:
1. **Name** — org name + optional app title
2. **Branding** — emoji picker + color picker + live preview
3. **First Group** — optional first family branch (name, email, phone, children)

On completion, `createOrg()` sequentially inserts: `organizations` (with generated slug), `org_settings` (with sensible defaults), `org_members` (owner role), `cycles` (first cycle), and optionally `groups`/`group_members`/`group_children`.

Users who sign in but have no org are automatically redirected to `/onboarding`. There is no dead end.

### Auth Flow
1. User signs in with Google OAuth on the landing page
2. `routeSignedInUser(email)` checks `org_members` table
3. If member found → redirect to `/app`
4. If not found → redirect to `/onboarding`
5. In the app, `loadOrgAndResolveAuth(email)` fetches full org config from DB and resolves role

### Tab / Step Navigation
Same as Clayton Link — `step` state persisted to `localStorage` (key: `gv_step`). Cleared on sign-out. Restored on page load after auth resolves.

### Database Schema
Full schema in `grandivite_schema.sql`. Key additions vs Clayton Link:
- `cycles` table has `org_id` column (org-scoped cycles)
- `organizations` has `slug` column (URL-friendly identifier)
- All tables have `org_id` foreign keys where applicable
- RLS enabled on all tables with permissive policies (tighten before public launch)

Run `grandivite_schema.sql` in Supabase SQL Editor to initialize a fresh project.

### AI Features
Same as Clayton Link — serverless functions proxy to Anthropic API:
- `/api/draft-digest` — Claude drafts the monthly email (Opus model)
- `/api/draft-nudge` — Claude drafts per-family nudge emails (Haiku model)
- `/api/polish-note` — Claude polishes the event note field inline (Haiku model)

### Email
Blocked until grandivite.com domain is purchased and verified in Resend. Once available:
- Add and verify grandivite.com in Resend dashboard
- Set `RESEND_API_KEY` in `.env` and Vercel environment variables
- `/api/send-nudge` is already written for multi-tenant delivery

## File Structure

```
src/
  main.jsx           — routing (/, /onboarding, /app, /admin)
  LandingPage.jsx    — public marketing page + Google sign-in
  OnboardingPage.jsx — 3-step org creation wizard
  App.jsx            — main family app (GrandiviteApp component)
  admin/
    AdminApp.jsx     — admin dashboard shell + dynamic org resolution
    adminDb.js       — all Supabase queries, fully multi-tenant (orgId params)
    adminUtils.js    — shared utilities (writeAudit, COLOR_PRESETS)
    sections/
      Overview.jsx
      OrgSettings.jsx
      GroupsManager.jsx
      GroupDetail.jsx
      RecipientsManager.jsx
      MembersManager.jsx
      CycleManager.jsx
      NotificationSettings.jsx
      AuditLog.jsx
api/
  draft-digest.js
  draft-nudge.js
  polish-note.js
  send-nudge.js      — multi-tenant: iterates all orgs with nudge enabled
grandivite_schema.sql — full DB schema, run once per fresh Supabase project
.env.example          — all required environment variables documented
```

## Environment Variables

```
VITE_SUPABASE_URL        — Supabase project URL
VITE_SUPABASE_ANON_KEY   — Supabase anon/publishable key
VITE_GOOGLE_MAPS_KEY     — Google Maps API key (Places API + Maps JS API enabled)
ANTHROPIC_API_KEY        — Anthropic API key (for AI features)
RESEND_API_KEY           — Resend API key (pending grandivite.com domain purchase)
CRON_SECRET              — Random secret to protect /api/send-nudge
```

## Local Development Setup

1. Create a Supabase project and run `grandivite_schema.sql`
2. In Supabase → Authentication → URL Configuration: set Site URL to `http://localhost:5173`, add `http://localhost:5173/**` to redirect URLs
3. In Supabase → Authentication → Providers → Google: enable with your OAuth client ID and secret
4. In Google Cloud Console: add `https://<your-supabase-project>.supabase.co/auth/v1/callback` to authorized redirect URIs
5. Copy `.env.example` to `.env` and fill in values
6. `npm install && npm run dev`

## Deployment (When Ready)

1. Purchase grandivite.com
2. Create Vercel project pointing at `clayton-link/grandivite`, `main` branch
3. Add all `.env` values in Vercel → Settings → Environment Variables
4. Update Supabase Site URL to `https://grandivite.com`
5. Add `https://grandivite.com/**` to Supabase redirect URLs
6. Verify grandivite.com in Resend and set `RESEND_API_KEY`
7. Set up Vercel Cron for `/api/send-nudge`

## Key Design Decisions

- **No hardcoded org data** — everything resolved dynamically from DB at sign-in
- **Self-service first** — any Google account can create an org; no admin approval needed
- **Org isolation** — all queries scoped by `orgId`; RLS as a second layer of defense
- **Slug generation** — orgs get a URL-friendly slug (e.g. `henderson-family-x4k2`) generated on creation
- **Permissive RLS policies** — current policies allow all authenticated operations; tighten before public launch by scoping to `org_members`
- **Shared AI keys** — Anthropic key can be shared with Clayton Link since it's billed per token

## Related Project

**Clayton Link** (`github.com/clayton-link/claytonlink`) is the private single-tenant origin of this project, deployed at claytonlink.com for the Clayton family. The two codebases are intentionally kept separate — do not merge changes between them without careful review.
