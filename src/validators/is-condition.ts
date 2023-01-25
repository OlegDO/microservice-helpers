import { ClassConstructor } from 'class-transformer';
import type {
  ValidationOptions,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { registerDecorator, ValidatorConstraint } from 'class-validator';

/**
 * Validate field by provided condition
 * @constructor
 */
const IsCondition =
  <T>(
    type: ClassConstructor<T>,
    property: (o: T) => boolean,
    validationOptions?: ValidationOptions,
  ) =>
  (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };

@ValidatorConstraint({ name: 'IsCondition' })
class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [fn] = args.constraints;

    return fn(args.object);
  }

  defaultMessage(args: ValidationArguments) {
    return `Validation condition for ${args.property} is failed`;
  }
}

export default IsCondition;
