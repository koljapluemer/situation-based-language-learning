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

## Backend Notes

- **Stack:** Fastify 5, Prisma ORM, PostgreSQL, Zod validation, Dockerized for production.
- **Recursive DTO rules:** `contains` glosses resolve infinitely; `nearSynonyms`, `nearHomophones`, and `translations` resolve depth-1.
- **Challenges:** `ChallengeOfExpression` / `ChallengeOfUnderstandingText` stored as first-class tables and returned with resolved gloss payloads.

### REST Surface (`http://localhost:3333`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | readiness probe |
| GET | `/glosses` | optional `language`, `content` filters |
| POST | `/glosses` | create gloss + relationships via IDs |
| GET | `/glosses/:id` | returns fully resolved `GlossDTO` |
| PATCH | `/glosses/:id` | partial updates, arrays replace previous values |
| DELETE | `/glosses/:id` | remove gloss |
| GET | `/situations?language=deu` | language param required for DTO projection |
| GET | `/situations/:id?language=deu` | fetch resolved situation |
| POST | `/situations` | create situation + challenges |
| PATCH | `/situations/:id?language=deu` | replace any provided challenge arrays |
| DELETE | `/situations/:id` | cascades to its challenges |

### Production

- Build the API image: `docker build -f src/backend/Dockerfile -t sbll-backend .`
- Run migrations before deploy: `npm run prisma:migrate:deploy`
- Provide `DATABASE_URL` via environment (managed Postgres recommended)
- Start compiled server inside the container with `npm run backend:start`

## Frontend Notes

- Both `frontend-cms` and `frontend-cram` are Vue 3 + Vite shells with the correct dependencies, TypeScript config, and aliasing back to `src/shared`.
- Each app can evolve independently (separate `package.json`, scripts, and future env files) while still sharing DTOs/interfaces from the workspace.
- When running against a remote backend, set `VITE_API_URL` in the corresponding frontend `.env` files (defaults to `http://localhost:3333` during development).

## Shared DTOs

- `src/shared/index.ts` re-exports the DTOs/types so every workspace consumes the same contract.
- Interfaces remain the single source of truth for REST payloads; backend services already import them directly, and the Vue apps can point at the same definitions.

## Next Steps

1. Re-run `npm install` at the root to regenerate a workspace-aware `package-lock.json`.
2. Flesh out the Vue apps (pages, components, env configs) now that their scaffolding is in place.
3. Consider adding automated tests per workspace (e.g., Vitest for frontends, Jest/Tap for backend).
4. Extend CI/CD to call the workspace scripts (`npm run backend:build`, `npm run cms:build`, etc.) before deployments.
