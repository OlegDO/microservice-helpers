import { ClassConstructor } from 'class-transformer';
import { registerDecorator, ValidationTypes } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

/**
 * Disable validation and cleanup field if provided condition return false
 * @constructor
 */
const IsValidate =
  <T>(
    type: ClassConstructor<T>,
    property: (o: T) => boolean,
    validationOptions?: ValidationOptions,
  ) =>
  (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: ValidationTypes.CONDITIONAL_VALIDATION,
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [
        (obj: T): boolean => {
          const isTrue = property(obj);

          if (!isTrue && obj[propertyName]) {
            obj[propertyName] = undefined;
          }

          return isTrue;
        },
      ],
      validator: () => null,
    });
  };

export default IsValidate;
