# Web runtime, registration OTP and readability fixes

## Reproduced cause

The running local API used the current generated Prisma client against `aihn_dev`
without four migration records. Public `/api/v1/careers?limit=1` returned HTTP 500;
OTP issuance also depended on the missing `Otp.failedAttempts` column. Database
connectivity alone passed readiness and hid this schema mismatch.

`AdminAuditLog` already existed with the migration's exact columns, primary key and
indexes, but its migration had not been recorded. The first deployment failed on
that existing table. Its schema was inspected before marking that one migration
applied; the remaining three migrations were then deployed normally. No migration
SQL or Git history was rewritten.

## Local repair

- Created and validated a private `pg_dump` backup before migration:
  `/tmp/aihn-runtime-backup-wtEtvf/aihn_dev.before-web-fix.dump` (directory 0700,
  archive 0600). Keep this archive private: it contains application data.
- Preserved 5 accounts, 8 assessment attempts and 108 questions. The hardening
  migration invalidated one old transient OTP; request a new code after upgrading.
- Imported the sourced catalog transactionally: 923 careers and 35 skills.
- Rechecked migration status and public catalog/readiness on the running local API.
- Verified the configured SMTP connection/authentication without sending email.
  Registration and recovery delivery tests use an owned local SMTP capture.

## Code changes

- Readiness compares required Prisma scalar columns/tables with the connected DB;
  missing schema now returns 503, with the existing public response shape.
- `pnpm run setup:dev` generates Prisma, deploys migrations and imports career data.
  README and the sample DB URL now agree with this local setup.
- Frontend body/forms use 16px text and small captions use 14px through shared rem
  tokens. Hardcoded 10–15px declarations were replaced across web screens. Public
  navigation spacing and mobile bottom-navigation height accommodate larger text.
- Initial route loading is a status, not a temporary page H1. Keyboard navigation
  waits for the actual page heading and the skip link remains reachable.
- Choosing a target career replaces an unchanged cached profile. Genuine edits or
  stale revisions remain protected and require explicit review.
- The result entry URL without an attempt ID opens the latest owned result, or
  shows a start-assessment action when history is empty. It no longer misreports
  a normal navigation link as an invalid attempt ID; lookup failures are retryable.
- Admin Holland content reads allow empty sections in existing records so an
  administrator can complete them. Write validation still requires a title and
  nonempty sections. One unfinished record no longer blocks the whole editor.

## Reproducible verification

- Backend: `pnpm run check` and `pnpm run test:e2e`. A real DB test temporarily
  renames the OTP column in its isolated fixture and checks 503/recovery.
- Frontend: typecheck, lint, unit tests, build and the full Playwright suite.
- `pnpm run test:web:browser`: actual React/API/PostgreSQL/Redis, registration OTP,
  recovery/reset/login, 108 boolean questions, saved recommendations/goals and
  user/admin screens at 320/390/768/1440px. It checks overflow, form/body sizes,
  visible error states, browser errors and HTTP 5xx; screenshots/JSON are retained
  under the runner's UUID directory. It never sends external email or calls an
  external provider, and removes only its own DB/Redis/app resources.

Verified locally: Backend check (35 suites / 240 tests plus typecheck, architecture,
lint and build), 11 real API e2e tests, and the strict 124-viewport browser audit.
The final browser audit is `/tmp/aihn-e2e-11LfRH/web-screen-audit.json` with screenshots
in the same directory; it records 2 captured OTP messages, 108 answered questions,
16px body/form text and zero horizontal overflows. These are local test artifacts.

All changes are on `fix/web-runtime-and-readability`, based on the current v2
feature branches. Main and the original hardening/feature branches are preserved.
