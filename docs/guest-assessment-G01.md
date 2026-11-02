# Guest assessment backend

Signed 24-hour catalogs freeze actual question content, dimensions and tie priorities. Anonymous previews use the existing Boolean score calculator and existing analysis repository, returning a signed receipt plus the matching answer snapshot without database writes. JWT proofs use a derived, purpose-specific key and audience; they cannot authenticate as access tokens.

Authenticated claim creates Attempt, all Answer rows including No values, Result, SnapShot and one durable unique GuestAssessmentClaim in a Serializable transaction. Exact same-owner retries resolve to the same attempt. Different owners or answers conflict. Question-bank drift conflicts before writes. Authenticated lookup reconciles a missing/unknown claim acknowledgement without exposing another owner's result.

Validation: `pnpm run check` passed (both typechecks, architecture, lint, 253 tests, build). New coverage includes all-No/incomplete/duplicate/unknown/non-Boolean answers, proof tampering/expiry/purpose isolation, public endpoint boundaries, matching snapshot, repeat claim, ownership and bank drift. Applied only the additive pending migration `20261024000000_guest_assessment_claim` to local `aihn_dev`; no production migration or push. Integrated browser/database acceptance follows in G04.
