import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AnswerDto } from 'src/modules/answer/dto/create_answer.dto';

@ValidatorConstraint({ async: false })
export class UniqueQuestionInAnswer implements ValidatorConstraintInterface {
  validate(value: AnswerDto[]) {
    if (!Array.isArray(value)) return false;
    if (value.some((answer) => !answer || typeof answer !== 'object'))
      return false;
    const questionIds = value.map((answer) => answer.questionId);
    const uniqueQuestionIds = new Set(questionIds);
    return questionIds.length === uniqueQuestionIds.size;
  }
  defaultMessage(args: ValidationArguments) {
    return `Property "${args.property}" of "${args.targetName}" has duplicate questionId`;
  }
}
