# Situation-Based Language Learning Monorepo

This repository now uses **plain npm workspaces** to keep the backend, multiple Vue/Vite frontends, and the shared DTO library in sync while preserving one set of type definitions in `src/shared`.

```
.
├── package.json                # workspace orchestrator
└── src
    ├── backend                 # Fastify + Prisma API
    ├── frontend-cms            # Vue 3 + Vite app (content tooling)
    ├── frontend-cram           # Vue 3 + Vite app (learner UX)
    └── shared                  # DTOs, types, and cross-app utilities
```

## Getting Started

1. **Install dependencies once at the repo root** (regenerates the workspace-aware `package-lock.json`):
   ```bash
   npm install
   ```
2. **Copy backend environment variables**:
   ```bash
   cp src/backend/.env.example src/backend/.env
   ```
   Then add your Supabase credentials (see [Authentication Setup](#authentication) below).

3. **Start Postgres locally (optional but easiest)**:
   ```bash
   docker compose -f src/backend/docker-compose.yml up -d
   ```

> The root `package.json` only proxies scripts into each workspace. For example `npm run backend:dev` simply forwards to `@sbl/backend`’s `npm run dev`.

### Useful Scripts

Shared DTO package:

- `npm run shared:build` – compile `@sbl/shared` into `src/shared/dist`
- `npm run shared:dev` – watch mode for editing shared types/constants

Backend:

- `npm run backend:dev` – Fastify + Prisma server with ts-node-dev (rebuilds shared DTOs automatically)
- `npm run backend:build` – emit JS to `src/backend/dist`
- `npm run backend:start` – run the compiled server
- `npm run prisma:migrate:dev` / `npm run prisma:migrate:deploy` – apply DB migrations
- `npm run prisma:seed` – optional demo data

Frontends (Vue 3 + Vite):

- `npm run cms:dev` / `npm run cram:dev` – Vite dev servers (ports 4173 & 4174)
- `npm run cms:build` / `npm run cram:build` – type-check + bundle
- `npm run cms:preview` / `npm run cram:preview` – preview production bundles
- Install dependencies in one workspace without affecting others via npm’s `--workspace` flag. Examples:
  - `npm install some-lib --workspace @sbl/frontend-cms`
  - `npm install -D @types/some-lib --workspace @sbl/backend`

> All backend/frontend scripts automatically run `npm run shared:build` first so the shared package outputs stay in sync.

Shared DTO Library:

- `src/shared` now has its own package manifest (`@sbl/shared`), build pipeline, and index barrel so that all apps import the same compiled TypeScript definitions (emitted into `src/shared/dist`). Use `npm run shared:dev` if you want the shared types to rebuild on save while developing.

## Authentication

This project uses **Supabase Auth** (authentication only, not their database) to protect write operations.

- **Frontend-CMS**: Requires login for all access (POST/PATCH/DELETE operations)
- **Frontend-CRAM**: Public access (GET requests only)
- **Backend**: Validates Supabase JWT tokens via `Authorization: Bearer <token>` header

**Setup:**
1. See `SUPABASE_AUTH_SETUP.md` for complete instructions
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `src/backend/.env`
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `src/frontend-cms/.env`
4. Create admin user in Supabase dashboard

**Quick test:** After setup, go to `http://localhost:4173` (CMS) - you'll be redirected to login.

## Backend Notes

- **Stack:** Fastify 5, Prisma ORM, PostgreSQL, Zod validation, Supabase Auth, Dockerized for production.
- **Authentication:** Supabase JWT verification on write operations (POST/PATCH/DELETE). GET requests remain public.
- **Recursive DTO rules:** `contains` glosses resolve infinitely; `nearSynonyms`, `nearHomophones`, and `translations` resolve depth-1.
- **Challenges:** `ChallengeOfExpression` / `ChallengeOfUnderstandingText` stored as first-class tables and returned with resolved gloss payloads.

### REST Surface (`http://localhost:3333`)

See `src/backend/API.md` for complete documentation.

| Method | Path | Auth Required | Notes |
| --- | --- | --- | --- |
| GET | `/health` | No | readiness probe |
| GET | `/glosses` | No | optional `language`, `content` filters |
| POST | `/glosses` | **Yes** | create gloss + relationships via IDs |
| GET | `/glosses/:id` | No | returns fully resolved `GlossDTO` |
| PATCH | `/glosses/:id` | **Yes** | partial updates, arrays replace previous values |
| DELETE | `/glosses/:id` | **Yes** | remove gloss |
| GET | `/situations?language=deu` | No | language param optional for filtering |
| GET | `/situations/:id?language=deu` | No | fetch resolved situation |
| POST | `/situations` | **Yes** | create situation + challenges |
| PATCH | `/situations/:id?language=deu` | **Yes** | replace any provided challenge arrays |
| DELETE | `/situations/:id` | **Yes** | cascades to its challenges |

**Auth:** Protected routes require `Authorization: Bearer <supabase-jwt-token>` header.

### Production Deployment

See `DEPLOYMENT.md` for complete Railway deployment instructions.

**Quick overview:**
- Deploy to Railway.app (no Docker needed)
- 3 services: backend, frontend-cms, frontend-cram
- PostgreSQL database managed by Railway
- Auto-deploy from GitHub on push to `main`

## Frontend Notes

- Both `frontend-cms` and `frontend-cram` are Vue 3 + Vite shells with the correct dependencies, TypeScript config, and aliasing back to `src/shared`.
- Each app can evolve independently (separate `package.json`, scripts, and future env files) while still sharing DTOs/interfaces from the workspace.
- Frontends require a single env var for backend calls: set `VITE_API_URL` in each frontend’s `.env` file (e.g., `http://localhost:3333` for local dev, your deployed backend in production). There is no fallback.

### Frontend-CMS (Content Management)
- **Authentication:** Required - uses Supabase Auth with email/password login
- **Access:** Admin users only (create users in Supabase dashboard)
- **API Client:** Uses `apiFetch()` helper that automatically adds auth tokens
- **Port:** `http://localhost:4173`

### Frontend-CRAM (Learner App)
- **Authentication:** None - completely public
- **Access:** Anyone can use the learning interface
- **API:** Read-only access to situations and glosses
- **Port:** `http://localhost:4174`

## Shared DTOs

- `src/shared/index.ts` re-exports the DTOs/types so every workspace consumes the same contract.
- Interfaces remain the single source of truth for REST payloads; backend services already import them directly, and the Vue apps can point at the same definitions.
