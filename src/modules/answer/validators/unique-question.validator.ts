import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class UniqueQuestionInAnswer implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!Array.isArray(value)) return false;
    if (value.some((answer) => !answer || typeof answer !== 'object'))
      return false;
    const questionIds = value.map(
      (answer) => (answer as { questionId?: unknown }).questionId,
    );
    const uniqueQuestionIds = new Set(questionIds);
    return questionIds.length === uniqueQuestionIds.size;
  }
  defaultMessage(args: ValidationArguments) {
    return `Property "${args.property}" of "${args.targetName}" has duplicate questionId`;
  }
}
