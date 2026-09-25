// src/core/pipes/validation.pipe.ts
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
type ClassConstructor = new (...args: any[]) => any;
@Injectable()
export class ValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: this.formatErrors(errors),
      });
    }

    return object;
  }

  private toValidate(metatype: ClassConstructor): boolean {
    const types: Type<any>[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]) {
    const result = {};

    errors.forEach((error) => {
      const field = error.property;
      result[field] = Object.values(error.constraints || {});

      if (error.children?.length) {
        result[field] = this.formatErrors(error.children);
      }
    });

    return result;
  }
}
