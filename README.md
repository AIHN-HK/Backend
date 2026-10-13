# AIHN Backend API

NestJS backend with TypeScript, PostgreSQL, Prisma, and JWT authentication.

## Quick Start

```bash
pnpm install --frozen-lockfile
createdb aihn_dev
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run start:dev
```

## URLs

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Scalar: http://localhost:3000/api/reference

## Features

- JWT auth (access + refresh tokens)
- Swagger + Scalar API docs
- Global error handling & validation
- Request logging
- Docker support

## Commands

```bash
pnpm run start:dev       # Development
pnpm run build           # Build
pnpm exec prisma studio       # Database GUI
pnpm exec prisma migrate dev  # Migrations
pnpm run test            # Tests
pnpm run check           # Typecheck, read-only lint, all unit/HTTP contract tests, build
pnpm run test:backend:live # Isolated local PostgreSQL/Redis/Bull/Socket.IO smoke
```

## Environment

Copy `.env.example` to `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aihn_dev?schema=public"
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

Use pnpm and `pnpm-lock.yaml` as the dependency source of truth. `lint` checks;
`lint:fix` edits. `start:prod` starts the built `dist/src/main` entrypoint.

Additional connection settings belong in your ignored `.env` or deployment environment:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# Base URL; the client appends /ws/chat/:sessionId. Unset disables AI turns explicitly.
AI_WS_URL=wss://your-ai-host.example
AI_CONNECT_TIMEOUT_MS=10000
AI_IDLE_TIMEOUT_MS=30000
AI_MAX_DURATION_MS=120000
CHAT_TURN_LEASE_MS=600000
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY_HOPS=0
```

Redis locks and Bull require Redis; optional read caches fall back to PostgreSQL.
HTTP and Socket.IO use the configured origin list; production without a list
does not enable cross-origin access. Set trusted proxy hops for your deployment.
`GET /api/v1/health` is liveness; `/health/ready` checks PostgreSQL and Redis with a timeout.

Apply migrations before running this version: `AdminAuditLog` is required by
authenticated admin mutations. Audit and the associated mutation commit together.
The migration was verified against an isolated local test database; the live smoke
creates and drops its own database and starts/stops its own password-protected Redis
and local fake AI. It requires local PostgreSQL credentials with CREATE DATABASE
permission and `redis-server`. It does not call the external AI service.

Both submit routes use binary scoring. `submit-v2` requires actual JSON booleans;
legacy `submit` accepts only answerValue 0/1. Answers/result/snapshot/completion are
atomic. History reads current DB data with limit 1–50 (default 10) and paired cursors.

Chat queue jobs are tied to the authenticated owner and a turn ID. One turn may be
queued/active per session; additional asks return `CHAT_BUSY`. Tokens and end events
include turnId; `answer_end.status` is completed/failed/cancelled. Failures also emit
`answer_error`. Failed jobs are retained for inspection and have no automatic retry;
inspect history before resending. Stalled-job recovery is also disabled: a worker
crash marks the uncertain job failed rather than contacting AI again. Cancelling discards an unfinished assistant reply
and preserves pending history. Queue/gateway run in the same Nest process; this change
does not configure a Socket.IO adapter for a separate multi-process worker topology.

The legacy `test/app.e2e-spec.ts` still expects Hello World at `/`; it is preserved
and is not part of `check`. The live smoke exercises the actual AppModule and built
entrypoint. Browser profile smoke remains optional and requires its frontend tooling.

## Project Structure

```
src/
├── core/       # Config, guards, filters, interceptors
├── modules/    # Auth, users, health
├── app.module.ts
└── main.ts
```

## API Examples

### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get Profile

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Endpoints

**Public:**

- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/health` - Health check

**Protected (JWT required):**

- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/users/me` - Get profile
- `PATCH /api/v1/users/me` - Update profile
- `GET /api/v1/users/:id` - Get user

## Docker

```bash
docker-compose up -d    # Start
docker-compose logs -f  # Logs
docker-compose down     # Stop
```

## Troubleshooting

**Database error:** `brew services start postgresql@14`

**Port in use:** `lsof -ti:3000 | xargs kill -9`

**Prisma error:** `pnpm exec prisma generate`

## Tech Stack

- NestJS 11
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT + Passport
- Swagger + Scalar
