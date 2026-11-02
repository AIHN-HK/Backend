# Phase 1 verification (2026-10-19)

Baseline current code: Backend 30 suites / 219 tests; Frontend 18 files / 153 tests.
After hardening: Backend 31 suites / 227 tests; typecheck, strict subset, architecture,
lint and build passed. Prisma validate passed. Built app isolated HTTP e2e 4/4 passed.
`test:backend:live` passed: PostgreSQL migrations/rollback, completion ownership,
authenticated Redis/Bull, local fake-AI stream lifecycle/cancellation, worker crash
no replay, audit rollback, readiness recovery. `test:docker:local` passed using a
fresh image, isolated migrated DB/Redis and graceful SIGTERM cleanup.

AI-service: 19 tests, Ruff lint/format passed. Removed unsourced static knowledge
injection and kept caller context/history contract. This does not verify 9router
availability or production/provider delivery. AI-service initial snapshot and fixes
are tracked on its own fix branch; existing evidence/scripts remain untouched.

Frontend browser gate and final counts are recorded after all UI regressions resolve.
Previous UI sync introduced fabricated exam/career figures and missing accessible
controls. Source-driven preview pages were restored; active account/test/chat UI
retains the new layout, with honest labels, current contracts and touch targets.

## Reproduce locally

Node 24, pnpm 10.33.2. In Backend: `pnpm install --frozen-lockfile`, copy env example
only if no .env exists; use distinct strong JWT secrets. Start local PostgreSQL16 and
Redis7; `pnpm exec prisma generate`, `pnpm exec prisma migrate deploy`, explicitly
seed only a disposable/dev database. Migration invalidates active legacy OTPs; users
request a new one. New constraints fail loudly on invalid legacy role/question/priority
rows rather than silently rewriting historic results. Inspect and correct actual
invalid data before migration; no reset/db push is required.

Compose: `docker compose up --build` starts DB/Redis/app and migrates. Set CORS_ORIGINS,
mail configuration and secrets. Production mail uses SENDGRID_API_KEY + verified
MAIL_FROM; nonproduction uses MAIL_HOST/PORT/USER/PASS. Storage volume retains avatars.
Compose AI_WS_URL must be reachable **from the app container**, not loopback to the
host. The Python service is separately run using its own `uv sync --frozen` and env;
provider keys remain there. Blank AI_WS_URL disables generation with an explicit error.
No synthetic answer is returned. Default compose DB password is local development only.

Frontend: `pnpm install --frozen-lockfile`, set public VITE_API_ORIGIN/VITE_SOCKET_ORIGIN
as in its env example; `pnpm run dev`. Never put server/provider keys in VITE variables.

Tests isolate their own databases/Redis/processes. Existing user data/environment files
were not migrated, seeded or overwritten by verification. Nothing pushed/deployed.
