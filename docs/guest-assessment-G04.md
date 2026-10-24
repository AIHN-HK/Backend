# G04 — Guest assessment real runtime acceptance

Run `pnpm run test:guest:browser` from Backend. It builds the application and launches an owned UUID PostgreSQL database, private Redis, API, frontend preview and SMTP capture. All migrations run against that fixture database. Its database and processes are removed on exit. Existing developer API/frontend and personal database records are not used for the browser signup/import assertions.

Passed local integrated acceptance:
- A browser answers 108 questions, previews the actual RIASEC result and analysis, and sees responsive results at 390/768/1440. Anonymous attempts/claim records remain zero.
- Signup sends an OTP to the local SMTP sink; OTP verification/login preserve the roadmap return intent; authenticated handoff imports the result and opens /roadmap.
- SQL confirms 108 answers (36 No), exact TopCode and answer snapshot, completion timestamp and owning user. Confirmed save clears the tab draft.
- Same-owner replay returns the original attempt. Two simultaneous claims of a second result create exactly one additional attempt.
- Another account cannot claim or look up the first receipt; edited proofs fail; a changed question bank prevents a third attempt. The saved result remains available through its existing authenticated result route.
- The browser records no JavaScript page errors. Screenshots are in Frontend `.superpowers/guest-assessment/G04/`.

Validation: `pnpm run check` passed (253 tests, normal/strict typechecks, architecture, lint, build). The built application's existing runtime suites passed 11/11 with isolated PostgreSQL/Redis/local AI protocol. The guest live browser acceptance passed twice; the first screenshot attempt exposed a resize timing issue in the harness, resolved by awaiting fonts and two animation frames before measuring/capturing. This is local SMTP capture, not production inbox or live AI delivery.

Only the additive migration `20261024000000_guest_assessment_claim` was applied to developer `aihn_dev` for local runtime readiness. No dependency update, remote push, production migration or deployment. Logs: `/tmp/guest-final-backend.log`, `/tmp/guest-backend-runtime-e2e.log`, `/tmp/guest-live-final.log`.
