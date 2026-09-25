import { Injectable } from '@nestjs/common';
import { RiasecCode, RiasecScore } from '../constants/riasec.type';

interface ScoreInput {
  type: RiasecCode;
}
@Injectable()
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
