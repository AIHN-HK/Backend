import {
  codes,
  normalizeSnapshot,
  rankCareers,
  scoreCareer,
  shapeSimilarity,
  skillGaps,
  ScoringCareer,
  Vector,
} from './scoring';

const riasec: Vector = { R: 20, I: 100, A: 30, S: 40, E: 10, C: 50 };
const career: ScoringCareer = {
  id: 'a',
  title: 'fixture',
  description: 'fixture',
  riasec,
  sourceVersion: 'test',
  sourceUrl: 'https://example.test',
  skills: [{ skillId: 'code', importance: 4, level: 4 }],
};
it('uses complete profile shape; equivalent scale yields 100 and opposite shape 0', () => {
  expect(
    shapeSimilarity(riasec, { R: 2, I: 10, A: 3, S: 4, E: 1, C: 5 }),
  ).toBeCloseTo(100);
  expect(
    shapeSimilarity(riasec, { R: 80, I: 0, A: 70, S: 60, E: 90, C: 50 }),
  ).toBeCloseTo(0);
  expect(
    shapeSimilarity({ R: 1, I: 1, A: 1, S: 1, E: 1, C: 1 }, riasec),
  ).toBeNull();
});
it('keeps unknown skill ratings distinct from zero and caps surplus skills', () => {
  expect(
    skillGaps(career.skills, { skills: [], interests: null })[0].gap,
  ).toBeNull();
  expect(
    skillGaps(career.skills, {
      skills: [{ skillId: 'code', level: 0 }],
      interests: null,
    })[0].gap,
  ).toBe(4);
  expect(
    scoreCareer(
      riasec,
      { skills: [{ skillId: 'code', level: 5 }], interests: null },
      career,
    ).components.skills,
  ).toBe(100);
});
it('renormalizes missing signals and decomposes every ranking score exactly', () => {
  const result = scoreCareer(riasec, { skills: [], interests: null }, career);
  expect(result.score).toBeCloseTo(100);
  expect(result.missing).toEqual(['skills', 'interests']);
  expect(result.skillCoverage).toBe(0);
  expect(result.contributions[0].weight).toBe(1);
  for (let i = 0; i <= 5; i++) {
    const r = scoreCareer(
      riasec,
      { skills: [{ skillId: 'code', level: i }], interests: riasec },
      career,
    );
    expect(r.score).toBeCloseTo(
      r.contributions.reduce((s, c) => s + c.contribution, 0),
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  }
});
it('has deterministic ties and an ablation can remove skill contributions', () => {
  const profile = { skills: [{ skillId: 'code', level: 0 }], interests: null };
  expect(
    rankCareers(riasec, profile, [{ ...career, id: 'z' }, career]).map(
      (c) => c.careerId,
    ),
  ).toEqual(['a', 'z']);
  expect(
    scoreCareer(riasec, profile, career, { riasec: 1, skills: 0, interests: 0 })
      .score,
  ).toBeCloseTo(100);
});
it('normalizes only verified historical binary snapshots', () => {
  const scores = { R: 1, I: 1, A: 1, S: 1, E: 1, C: 1 };
  const snapshot = {
    questions: codes.map((type, id) => ({ id: id + 1, type, answerValue: 1 })),
  };
  expect(normalizeSnapshot(snapshot, scores)).toEqual({
    R: 100,
    I: 100,
    A: 100,
    S: 100,
    E: 100,
    C: 100,
  });
  expect(normalizeSnapshot(snapshot, riasec)).toBeNull();
  expect(
    normalizeSnapshot(
      { questions: [{ id: 1, type: 'R', answerValue: 5 }] },
      scores,
    ),
  ).toBeNull();
  expect(
    normalizeSnapshot(
      { questions: [...snapshot.questions, snapshot.questions[0]] },
      scores,
    ),
  ).toBeNull();
});
