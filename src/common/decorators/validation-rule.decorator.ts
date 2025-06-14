import 'reflect-metadata';

const VALIDATION_RULES_KEY = 'validation:rules';

/**
 * Интерфейс для метаданных правил валидации
 */
export interface ValidationRuleMetadata {
  messageType: string;
  ruleFactory: () => any;
  priority?: number;
}

/**
 * Декоратор для регистрации правила валидации для определенного типа сообщения.
 * Используется внутри классов валидации для автоматической регистрации правил.
 *
 * @param messageType Тип сообщения
 * @param priority Приоритет правила (опционально)
 */
export function ValidationRule(messageType: string, priority?: number) {
  return function (target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const ruleFactory = function () {
      return originalMethod.call(this) as unknown;
    };

    const existingRules: ValidationRuleMetadata[] =
      (Reflect.getMetadata(VALIDATION_RULES_KEY, target.constructor) as ValidationRuleMetadata[]) ||
      [];

    existingRules.push({
      messageType,
      ruleFactory,
      priority,
    });

    Reflect.defineMetadata(VALIDATION_RULES_KEY, existingRules, target.constructor);

    return descriptor;
  };
}

/**
 * Получает все правила валидации, зарегистрированные для класса
 *
 * @param target Целевой класс
 */
export function getValidationRules(target: unknown): ValidationRuleMetadata[] {
  return (Reflect.getMetadata(VALIDATION_RULES_KEY, target) as ValidationRuleMetadata[]) || [];
}

/**
 * Декоратор для регистрации шаблона сообщения
 */
export function MessageTemplateDefinition() {
  return function (target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    Reflect.defineMetadata(
      'validation:template',
      {
        getTemplate: function () {
          return originalMethod.call(this) as unknown;
        },
      },
      target.constructor,
    );

    return descriptor;
  };
}
