import { ScoreCalculatorService } from './score-calculator.service';
import { rankScores, ScoreItem } from './rank-scores';
import { analyzeRiasec } from './analyze-riasec';
import { RiasecCode, RiasecScore } from './riasec.types';

describe('assessment domain invariants', () => {
  it('counts only selected inputs passed by submission', () => {
    expect(
      new ScoreCalculatorService().calculateScores([
        { type: 'R' },
        { type: 'R' },
        { type: 'C' },
      ]).score,
    ).toEqual({ R: 2, I: 0, A: 0, S: 0, E: 0, C: 1 });
  });
  it('keeps stable ties and competition ranks without mutating input', () => {
    const input: ScoreItem[] = [
      { type: 'I', score: 3 },
      { type: 'R', score: 3 },
      { type: 'A', score: 1 },
    ];
    expect(rankScores(input)).toEqual([
      { type: 'I', score: 3, rank: 1 },
      { type: 'R', score: 3, rank: 1 },
      { type: 'A', score: 1, rank: 3 },
    ]);
    expect(input.every((item) => item.rank === undefined)).toBe(true);
  });
  it.each([12, 18])('classifies inclusive high boundary %i', (score) => {
    expect(
      analyzeRiasec('RIA', {
        R: score,
        I: score,
        A: score,
        S: score,
        E: score,
        C: score,
      }),
    ).toEqual({ type: 'ALL_HIGH', condition: 'ALL_HIGH' });
  });
  it.each([3, 6])('classifies inclusive low boundary %i', (score) => {
    expect(
      analyzeRiasec('RIA', {
        R: score,
        I: score,
        A: score,
        S: score,
        E: score,
        C: score,
      }),
    ).toEqual({ type: 'ALL_LOW', condition: 'ALL_LOW' });
  });
  it.each<[RiasecCode, RiasecCode, string]>([
    ['R', 'S', 'R_S'],
    ['I', 'E', 'I_E'],
    ['A', 'C', 'A_C'],
  ])('uses opposite pair %s/%s', (first, second, condition) => {
    const scores: RiasecScore = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    scores[first] = 10;
    scores[second] = 9;
    expect(analyzeRiasec(first + second, scores)).toEqual({
      type: 'OPPOSITE',
      condition,
    });
  });
  it('preserves normal top-code order outside uniform thresholds', () => {
    expect(
      analyzeRiasec('RIA', { R: 19, I: 11, A: 2, S: 0, E: 0, C: 0 }),
    ).toEqual({ type: 'NORMAL', codes: ['R', 'I', 'A'] });
  });
});
