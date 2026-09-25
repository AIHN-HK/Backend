import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AnswerDto } from 'src/modules/answer/dto/create_answer.dto';

@ValidatorConstraint({ async: false })
export class UniqueQuestionInAnswer implements ValidatorConstraintInterface {
  validate(value: AnswerDto[], validationArguments?: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    const questionIds = value.map((answer) => answer.questionId);
    const uniqueQuestionIds = new Set(questionIds);
    return questionIds.length === uniqueQuestionIds.size;
  }
  defaultMessage(args: ValidationArguments) {
    return `Property "${args.property}" of "${args.targetName}" has duplicate questionId`;
  }
}
