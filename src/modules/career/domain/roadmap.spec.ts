import { planRoadmap } from './roadmap';
import { ScoringCareer } from './scoring';
const career: ScoringCareer = {
  id: 'fixture',
  title: 'Fixture job',
  description: 'Fixture',
  sourceVersion: 'test',
  sourceUrl: 'https://example.test',
  riasec: { R: 1, I: 7, A: 2, S: 1, E: 3, C: 4 },
  skills: [
    { skillId: 'known', importance: 4, level: 4 },
    { skillId: 'unknown', importance: 5, level: 3 },
  ],
};
it('prioritizes real gaps and evaluates unknown skills rather than inventing a deficiency', () => {
  const plan = planRoadmap(
    career,
    { skills: [{ skillId: 'known', level: 2 }], interests: null },
    new Map([
      ['known', 'Coding'],
      ['unknown', 'Communication'],
    ]),
  );
  expect(plan.map((t) => t.phase)).toEqual([0, 1, 1, 2, 3]);
  expect(plan.find((t) => t.skillId === 'known')?.kind).toBe('practice');
  expect(plan.find((t) => t.skillId === 'unknown')?.kind).toBe('assess');
  expect(plan.find((t) => t.skillId === 'known')?.title).toContain(
    '2.0 → mức tham khảo 4.0',
  );
});
it('does not assign remedial practice when self-reported level exceeds requirement', () => {
  const plan = planRoadmap(
    career,
    {
      skills: [
        { skillId: 'known', level: 5 },
        { skillId: 'unknown', level: 5 },
      ],
      interests: null,
    },
    new Map(),
  );
  expect(plan.map((t) => t.kind)).toEqual(['explore', 'project', 'review']);
});
