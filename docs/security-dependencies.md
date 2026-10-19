# Production dependency hardening

Audit on 2026-10-20: the original Backend production tree reported 95 vulnerable
instances (7 low, 44 moderate, 43 high, 1 critical). This counts advisories/resolution
instances, not 95 independently exploitable application defects.

Updated compatible production ranges/lockfile while retaining NestJS 11 and Prisma 5.
Nodemailer moves to 10.1.7 and Sharp to 0.35.5 for upstream security fixes. Sharp's
separate CJS/ESM declarations need a small typed CJS adapter under the avatar boundary;
Node continues to load its supported callable CJS export. No global module-system
migration was introduced. Pin uuid 11.1.1 for Bull's v4 UUID calls; pin js-yaml 5.4.1
for Swagger's 5.x dependency. These pins require review on future parent updates.

`pnpm audit --prod --json` after resolution reports zero low/moderate/high/critical
advisories. This is advisory coverage at audit time, not a proof of absence of bugs.
Typecheck/strict/architecture/lint/unit/build passed with the refreshed dependencies.
Avatar decoding/validation/persistence tests and a real owned local SMTP capture test
passed. Runtime/Docker and the v2 integration gates are recorded in the final report.

References:
- https://github.com/advisories/GHSA-jqcg-44mw-7w3h (proxy-addr)
- https://github.com/advisories/GHSA-wc9g-mqfw-jrwm (multer)
- https://github.com/advisories/GHSA-wq5f-xc86-pv6w (Sharp native dependency)
- https://github.com/nodemailer/nodemailer/releases
- https://sharp.pixelplumbing.com/changelog/v0.35.0/

Frontend production audit reported zero advisories and required no dependency changes.
