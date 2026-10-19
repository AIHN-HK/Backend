export const codes = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
export type Code = (typeof codes)[number];
export type Vector = Record<Code, number>;
export const algorithmVersion = 'aihn-hybrid-1.0.0';
export const defaultWeights = { riasec: 0.65, skills: 0.25, interests: 0.1 };
export interface Requirement {
  skillId: string;
  importance: number;
  level: number;
}
export interface ScoringCareer {
  id: string;
  title: string;
  description: string;
  riasec: Vector;
  sourceVersion: string;
  sourceUrl: string;
  skills: Requirement[];
}
export interface ScoringProfile {
  skills: { skillId: string; level: number }[];
  interests: Vector | null;
}
export function vector(value: unknown, maximum = 100): Vector | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== 6) return null;
  if (
    !codes.every(
      (code) =>
        typeof data[code] === 'number' &&
        Number.isFinite(data[code]) &&
        (data[code] as number) >= 0 &&
        (data[code] as number) <= maximum,
    )
  )
    return null;
  return Object.fromEntries(codes.map((code) => [code, data[code]])) as Vector;
}

/** Pearson compares shape, making magnitude alone unable to dominate ranking. */
export function shapeSimilarity(a: Vector, b: Vector): number | null {
  const mean = (v: Vector) => codes.reduce((s, c) => s + v[c], 0) / 6;
  const ma = mean(a),
    mb = mean(b);
  let product = 0,
    aa = 0,
    bb = 0;
  for (const c of codes) {
    const x = a[c] - ma,
      y = b[c] - mb;
    product += x * y;
    aa += x * x;
    bb += y * y;
  }
  if (aa < 1e-10 || bb < 1e-10) return null;
  return (Math.max(-1, Math.min(1, product / Math.sqrt(aa * bb))) + 1) * 50;
}
function cosine(a: Vector, b: Vector): number | null {
  const dot = codes.reduce((s, c) => s + a[c] * b[c], 0);
  const norm = Math.sqrt(
    codes.reduce((s, c) => s + a[c] ** 2, 0) *
      codes.reduce((s, c) => s + b[c] ** 2, 0),
  );
  return norm > 0 ? Math.min(100, (dot / norm) * 100) : null;
}
export function skillGaps(
  requirements: Requirement[],
  profile: ScoringProfile,
) {
  const levels = new Map(profile.skills.map((s) => [s.skillId, s.level]));
  return requirements
    .map((r) => {
      const current = levels.get(r.skillId) ?? null;
      const gap = current === null ? null : Math.max(0, r.level - current);
      return {
        ...r,
        current,
        gap,
        priority: gap === null ? null : gap * r.importance,
      };
    })
    .sort(
      (a, b) =>
        (b.priority ?? -1) - (a.priority ?? -1) ||
        a.skillId.localeCompare(b.skillId),
    );
}
export function scoreCareer(
  riasec: Vector,
  profile: ScoringProfile,
  career: ScoringCareer,
  weights = defaultWeights,
) {
  const gaps = skillGaps(career.skills, profile);
  const known = gaps.filter((g) => g.current !== null && g.level > 0);
  const knownWeight = known.reduce((sum, g) => sum + g.importance, 0);
  const totalWeight = gaps
    .filter((g) => g.level > 0)
    .reduce((sum, g) => sum + g.importance, 0);
  // Missing self-ratings are unknown, not zero. Coverage prevents hiding partial evidence.
  const components = {
    riasec: shapeSimilarity(riasec, career.riasec),
    skills: knownWeight
      ? (known.reduce(
          (s, g) => s + Math.min(1, g.current! / g.level) * g.importance,
          0,
        ) /
          knownWeight) *
        100
      : null,
    interests: profile.interests
      ? cosine(profile.interests, career.riasec)
      : null,
  };
  const available = (Object.keys(weights) as (keyof typeof weights)[]).filter(
    (k) => components[k] !== null && weights[k] > 0,
  );
  const sum = available.reduce((s, k) => s + weights[k], 0);
  const contributions = available.map((key) => ({
    key,
    value: components[key]!,
    weight: weights[key] / sum,
    contribution: (components[key]! * weights[key]) / sum,
  }));
  return {
    careerId: career.id,
    title: career.title,
    sourceVersion: career.sourceVersion,
    sourceUrl: career.sourceUrl,
    components,
    contributions,
    score: sum ? contributions.reduce((s, c) => s + c.contribution, 0) : null,
    skillCoverage: totalWeight ? knownWeight / totalWeight : 0,
    missing: (Object.keys(components) as (keyof typeof components)[]).filter(
      (k) => components[k] === null,
    ),
    gaps,
  };
}
export function rankCareers(
  riasec: Vector,
  profile: ScoringProfile,
  careers: ScoringCareer[],
  weights = defaultWeights,
) {
  return careers
    .map((c) => scoreCareer(riasec, profile, c, weights))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        a.careerId.localeCompare(b.careerId),
    );
}

/** Never normalize historical scores using today's question bank. */
export function normalizeSnapshot(
  snapshot: unknown,
  scores: Vector,
): Vector | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const rows = (snapshot as { questions?: unknown }).questions;
  if (!Array.isArray(rows) || !rows.length) return null;
  const counts = Object.fromEntries(codes.map((c) => [c, 0])) as Vector;
  const sums = { ...counts },
    ids = new Set<number>();
  for (const row of rows) {
    if (
      !row ||
      !codes.includes(row.type) ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      ids.has(row.id) ||
      ![0, 1].includes(row.answerValue)
    )
      return null;
    ids.add(row.id);
    counts[row.type as Code]++;
    sums[row.type as Code] += row.answerValue;
  }
  if (!codes.every((c) => counts[c] > 0 && sums[c] === scores[c])) return null;
  return Object.fromEntries(
    codes.map((c) => [c, (sums[c] / counts[c]) * 100]),
  ) as Vector;
}
