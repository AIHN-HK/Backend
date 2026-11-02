# AIHN Career v2 architecture and evaluation

## Boundaries

React uses the existing authenticated NestJS API and Socket.IO. NestJS owns identity,
assessment/ownership, deterministic ranking, snapshots, progress state and persistence.
Python owns provider streaming; it cannot write profiles, scores or tasks. Secrets stay
server-side. CareerModule exposes services through its public index. Ranking and
roadmap planning are pure domain functions, independent of Nest/Prisma/Redis/provider.

The original boolean assessment contract and scoring are unchanged. Career recommendation
is a separate algorithm; it does not replace the stored Holland result or historic API.

## Data and reproducibility

`data/career-manifest.json` records the exact O*NET 31.0 source file hashes, derived
dataset hash, attribution, license and transformations. 923 career profiles and 35
skill definitions are included. Some occupations have no usable skills; unknown stays
unknown. At most eight nonsuppressed skills per occupation are selected by importance.
LV is converted 0..7 to 0..5; importance stays 1..5. A self-rating on this scale is an
approximation, not a validated assessment of professional proficiency.

Rebuild: download the four CSVs named in the manifest from the pinned
`https://www.onetcenter.org/dl_files/database/db_31_0_csv/` directory, then
`python3 scripts/build-career-dataset.py /path/to/csv`. Mismatched hashes require
explicit source review. Import into the selected dev database with `pnpm run career:import`.
It uses one transaction and an advisory lock, preserves publish state, and never
creates user data. Run migrations first. Docker includes the dataset for this CLI.

O*NET is occupational data from the United States. No Vietnam salary, admissions,
university matching, psychological validity or national market demand is inferred.
Original English labels/descriptions are retained rather than inventing translations.
Sources: [database](https://www.onetcenter.org/database.html),
[license](https://www.onetcenter.org/license_db.html),
[Interest Profiler manual](https://www.onetcenter.org/dl_files/IP_Manual.pdf).

## Scoring v1

1. Normalize six scores from each attempt's immutable binary question snapshot.
   Reject missing/legacy/inconsistent snapshots; never use today's question counts.
2. RIASEC similarity = `(Pearson(user, occupation) + 1) * 50`. Constant vectors
   yield unknown. A flat profile cannot be made informative by a tie-break.
3. Skill component = importance-weighted mean of `min(selfLevel / requiredLevel, 1)`
   for rated requirements with positive required level. Unrated requirements are
   excluded and weighted coverage is published separately. Sparse self-ratings can
   inflate this component: inspect coverage and do not interpret it as readiness.
4. Additional interests use nonnegative six-dimensional cosine similarity.
5. Weights are 0.65/0.25/0.10, renormalized over available signals. Output includes
   raw component, effective weight, contribution, missing signals and skill coverage.
   Sort descending score then stable career ID. No signal means null, not fabricated
   suitability. Weights are a design hypothesis, not learned or empirically calibrated.

`RecommendationRun` stores owner/attempt, algorithm version, normalized inputs,
profile revision, catalog versions/revisions and top-20 evidence. Reads never regenerate
or change a run. Changing profile or publishing data does not rewrite historic output.
Use archived run + pinned dataset + versioned algorithm to reproduce an explanation.

## Goals and concurrency

One goal per owner/career prevents duplicate creation after uncertain network outcomes.
Planning sorts known skill gaps by importance × gap; unknown ratings create assessment
tasks rather than assume deficiency. Four phases: exploration, assessment/practice,
project evidence and review. Completion needs nonempty evidence and earlier phases
completed. Reopening earlier tasks requires reopening later phases first.

Every edit claims the goal revision and updates a task in the same transaction. Stale
edits conflict rather than overwrite. Regeneration is explicit and retains completed
or annotated tasks, including their IDs/evidence. Progress is completed tasks / all
tasks, not a prediction of professional competence. At most 50 goals and 50 recent
assessment points are read per personal analytics request.

## Advisor

Context is read from DB each turn: current basic profile, the session's owned result,
confirmed skill/interests/target, current gap, latest recommendation evidence (top 3),
and up to 3 roadmaps. History includes completed exchanges, capped at 200 messages /
100k characters; exceeding the cap asks the user to start a new session. No provider
retry, mutation replay or fake answer. Prompt values are treated as user data rather
than privileged instructions. Context doesn't prove the model obeys it; live-provider
quality requires separate grounded evaluation.

## Evaluation protocol

`pnpm run career:evaluate` runs six explicitly synthetic user probes over all 923 real
career vectors. It records top-10 overlap against a RIASEC-only baseline, ablates
additional interests and perturbs a neighboring RIASEC score by 10 points. Results are
reproducible in `data/ranking-evaluation.json`. Unit tests cover scale invariance,
opposite/flat vectors, deterministic ties, missing-vs-zero, capped surplus skills,
snapshot consistency, decomposition and phased planning.

Next empirical step: recruit consenting students plus independent career counselors,
freeze algorithm/data, obtain ordinal relevance labels for a balanced candidate pool,
report Precision@K/nDCG, coverage, stability and per-group errors on held-out cases.
Compare RIASEC-only / skills-only / full model, bootstrap uncertainty and analyze
disagreement. Do not publish accuracy or effectiveness without these labels.

## Operational limits / next work

- Current Socket.IO token events and Bull consumers are colocated in one Nest process.
  Use one app replica. Multi-instance deployment needs Redis event routing/Socket.IO
  adapter and correlated stream delivery before scaling consumers separately.
- OTP request HTTP throttling uses Nest process storage; the DB challenge attempt cap
  and consumption work across processes. Distributed send/IP throttling is a next gate
  before a public multi-instance deployment.
- Catalog scan is bounded by the 2000-row importer; code filtering/ranking is in-memory.
  Larger datasets need precomputed vectors/indexes and pagination consistency policy.
- Admin can publish/archive sourced careers and inspect skill/recommendation analytics.
  Numeric source data is managed through checksum-verified ETL, not arbitrary UI edits.
  Localized editorial overlays and approved VN/RAG sources are P2.
- P2: sourced VN retrieval/citations with validation, human evaluation labels, feedback
  collection, workflow consent, and learned ranking only after an adequate dataset.
