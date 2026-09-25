import { Question } from '@prisma/client';
import { GroupedQuestionResponse, QuestionResponse } from './dto/Question.dto';

export function mapQuestionToResponse(question: Question): QuestionResponse {
  return {
    id: question.id,
    content: question.content,
    type: question.type,
    dimension: question.dimension,
  };
}

export function mapQuestionsToResponse(
  questions: Question[],
): QuestionResponse[] {
  return questions.map(mapQuestionToResponse);
}
export function mapGroupedQuestionsToResponse(
  grouped: Record<string, Record<string, Question[]>>,
): GroupedQuestionResponse {
  const result: GroupedQuestionResponse = {};

  for (const dimensionKey of Object.keys(grouped)) {
    result[dimensionKey] = {};

    for (const typeKey of Object.keys(grouped[dimensionKey])) {
      result[dimensionKey][typeKey] = grouped[dimensionKey][typeKey].map(
        mapQuestionToResponse,
      );
    }
  }

  return result;
}
