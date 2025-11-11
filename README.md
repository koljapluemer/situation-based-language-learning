# Situation-Based Language Learning Backend

This repository now contains a Fastify + Prisma backend that persists situations, glosses, and their expression/understanding challenges. It exposes a REST API that always returns fully resolved gloss data according to the resolution rules you specified (recursive `contains`, depth-1 for `nearSynonyms`, `nearHomophones`, and `translations`).

## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify 5 with Zod-powered validation
- **ORM:** Prisma with PostgreSQL (see `src/backend/prisma/schema.prisma`)
- **Documentation & Tooling:** Dockerfile, docker-compose, Prisma seed script

## Local Development

1. **Install dependencies** (only needed when modules change):
   ```bash
   npm install
   ```
2. **Bootstrap environment variables:**
   ```bash
   cp src/backend/.env.example src/backend/.env
   ```
3. **Start Postgres locally (optional but easiest):**
   ```bash
   docker compose -f src/backend/docker-compose.yml up -d
   ```
4. **Create the database schema & generate the Prisma client:**
   ```bash
   npm run prisma:migrate:dev
   npm run prisma:seed   # optional demo data
   npm run prisma:generate
   ```
5. **Run the backend in watch mode:**
   ```bash
   npm run backend:dev
   ```

Additional scripts:

- `npm run backend:build` – compile TypeScript to `src/backend/dist`
- `npm run backend:start` – run the compiled server
- `npm run prisma:migrate:deploy` – apply migrations in production

## REST API Overview

The API lives under `http://localhost:3333` by default.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Simple readiness probe |
| GET | `/glosses` | Optional `language` & `content` filters |
| POST | `/glosses` | Body validated by `glossWriteSchema`; relation fields expect gloss IDs |
| GET | `/glosses/:id` | Returns a fully resolved `GlossDTO` |
| PATCH | `/glosses/:id` | Partial updates, relation arrays replace previous values |
| DELETE | `/glosses/:id` | Removes a gloss |
| GET | `/situations?language=deu` | `language` query param is required (used only for DTO projection) |
| GET | `/situations/:id?language=deu` | Same language requirement |
| POST | `/situations` | `language` field is required in the payload but **not** persisted; it selects the projection language |
| PATCH | `/situations/:id?language=deu` | Replaces any challenge array that is provided |
| DELETE | `/situations/:id` | Cascades to its challenges |

### Gloss Resolution Rules

- `contains` – recursively resolved to unlimited depth. Each nested gloss includes its own `contains` tree.
- `nearSynonyms`, `nearHomophones`, `translations` – resolved exactly one level deep. The related gloss is included with its metadata, but its own relation arrays are empty.
- Every `GlossDTO` now includes an `id`, `language`, `content`, and metadata arrays so the frontend can re-use them directly.

### Challenge Persistence

`ChallengeOfExpression` and `ChallengeOfUnderstandingText` are first-class tables linked to `Situation`. Their payloads reference glosses by ID (`glossIds`). Responses include the resolved `GlossDTO[]` objects used in each challenge.

## Production Deployment Notes

- Build a container image with the provided Dockerfile:
  ```bash
  docker build -f src/backend/Dockerfile -t sbll-backend .
  ```
- Run migrations before each deploy: `npm run prisma:migrate:deploy`
- Provide a managed PostgreSQL URL via `DATABASE_URL`.
- Start the app with `npm run backend:start` (or `node src/backend/dist/server.js`).

## Folder Structure Highlights

```
src/backend/
  ├── docker-compose.yml         # local Postgres + pgAdmin
  ├── Dockerfile                 # production-ready multi-stage build
  ├── prisma/
  │   ├── schema.prisma          # domain models
  │   └── seed.ts                # optional seed data
  └── src/
      ├── app.ts / server.ts     # Fastify bootstrap
      ├── env.ts                 # dotenv + Zod config
      ├── routes/                # health, glosses, situations
      ├── services/              # Prisma-backed business logic
      ├── schemas/               # Zod validators for REST payloads
      └── utils/                 # shared helpers (e.g., HttpError)
```

## Working With Situations & Glosses

- Use the `/glosses` endpoints to create glosses first. Reference relationships by gloss ID.
- Create situations with descriptive metadata plus expression/understanding challenges that reference existing gloss IDs.
- When fetching situations, always pass `language` as a query parameter; it is only used for DTO serialization and is not stored in the database.
- The API always returns DTOs defined under `src/shared`, so the frontend and backend share a single contract.

## Next Steps

- Add automated tests around the resolver logic and route handlers.
- Extend filtering/pagination on listing endpoints before loading large datasets.
- Consider caching resolved gloss graphs if situations become very large.
