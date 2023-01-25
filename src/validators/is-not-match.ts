import { ClassConstructor } from 'class-transformer';
import type {
  ValidationOptions,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { registerDecorator, ValidatorConstraint } from 'class-validator';

/**
 * Compares two fields to see if they are NOT equal
 * @constructor
 */
const IsNotMatch =
  <T>(
    type: ClassConstructor<T>,
    property: ((o: T) => any) | keyof T,
    validationOptions?: ValidationOptions,
  ) =>
  (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: NotMatchConstraint,
    });
  };

@ValidatorConstraint({ name: 'IsNotMatch' })
class NotMatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [fn] = args.constraints;
    const targetVal = typeof fn === 'function' ? fn(args.object) : args.object[fn];

    return targetVal !== value;
  }

  defaultMessage(args: ValidationArguments) {
    const [fn]: (() => any)[] = args.constraints;
    let targetField: string = fn as unknown as string;

    if (typeof targetField === 'function') {
      const [part1, part2] = String(targetField).split('.');

      targetField = part2 ?? part1;
    }

    return `${targetField} and ${args.property} should not be equal`;
  }
}

export default IsNotMatch;
