import { RiasecCode, RiasecScore } from './riasec.types';

interface ScoreInput {
  type: RiasecCode;
}
export class ScoreCalculatorService {
  calculateScores(answers: ScoreInput[]) {
    const score: RiasecScore = {
      R: 0,
      I: 0,
      A: 0,
      S: 0,
      E: 0,
      C: 0,
    };
    for (const answer of answers) {
      score[answer.type] += 1;
    }

    return { score };
  }
}
