import { writeFileSync } from 'node:fs';
import { readCareerDataset } from './import-career-data';
import {
  codes,
  defaultWeights,
  rankCareers,
  ScoringCareer,
  Vector,
  algorithmVersion,
} from '../src/modules/career/domain/scoring';

// Synthetic input probes using real sourced occupation vectors. These are not expert labels.
const dataset = readCareerDataset();
const careers = dataset.careers as ScoringCareer[];
const rows = codes.map((code, index) => {
  const riasec = Object.fromEntries(
    codes.map((c) => [c, c === code ? 100 : 20]),
  ) as Vector;
  const profile = {
    skills: dataset.skills.map((s, i) => ({ skillId: s.id, level: i % 6 })),
    interests: { ...riasec },
  };
  const hybrid = rankCareers(riasec, profile, careers);
  const baseline = rankCareers(riasec, profile, careers, {
    riasec: 1,
    skills: 0,
    interests: 0,
  });
  const noInterests = rankCareers(riasec, profile, careers, {
    riasec: 0.65,
    skills: 0.25,
    interests: 0,
  });
  const neighbor = codes[(index + 1) % codes.length];
  const changed = { ...riasec, [neighbor]: riasec[neighbor] + 10 };
  const sensitivity = rankCareers(changed, profile, careers);
  const overlap = (a: typeof hybrid, b: typeof hybrid) =>
    a
      .slice(0, 10)
      .filter((x) => b.slice(0, 10).some((y) => y.careerId === x.careerId))
      .length / 10;
  return {
    probe: `synthetic-${code}`,
    hybridTop10: hybrid.slice(0, 10).map((r) => r.careerId),
    riasecOnlyTop10: baseline.slice(0, 10).map((r) => r.careerId),
    overlapWithRiasecOnly: overlap(hybrid, baseline),
    overlapWithoutAdditionalInterests: overlap(hybrid, noInterests),
    overlapAfterTenPointPerturbation: overlap(hybrid, sensitivity),
  };
});
const report = {
  algorithmVersion,
  weights: defaultWeights,
  dataset: dataset.version,
  careers: careers.length,
  method:
    'Synthetic sensitivity/ablation only; no accuracy, Precision@K or nDCG without expert relevance labels.',
  rows,
};
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write'))
  writeFileSync('data/ranking-evaluation.json', output);
console.log(output);
