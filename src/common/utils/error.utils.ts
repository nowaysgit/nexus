/**
 * Утилиты для обработки ошибок и валидации
 */

/**
 * Безопасно извлекает сообщение ошибки
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Неизвестная ошибка';
}

/**
 * Создает стандартную ошибку "не найден"
 */
export function createNotFoundError(entityName: string, id: string | number): Error {
  return new Error(`${entityName} с ID ${id} не найден`);
}

/**
 * Проверяет, является ли строка пустой или состоит только из пробелов
 */
export function isEmptyString(value: unknown): boolean {
  if (typeof value !== 'string') {
    return true; // Не-строковые значения считаются "пустыми" в контексте проверки строк
  }
  return value.trim() === '';
}

/**
 * Проверяет, является ли значение null или undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Валидирует обязательный параметр
 */
export function validateRequired<T>(value: T | null | undefined, paramName: string): T {
  if (isNullOrUndefined(value)) {
    throw new Error(`${paramName} обязателен`);
  }
  return value;
}

/**
 * Валидирует строковый параметр
 */
export function validateString(
  value: unknown,
  paramName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
  } = {},
): string | undefined {
  const { required = true, allowEmpty = false, minLength, maxLength } = options;

  if (required && isNullOrUndefined(value)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      throw new Error(`${paramName} должен быть строкой`);
    }

    if (!allowEmpty && isEmptyString(value)) {
      throw new Error(`${paramName} не может быть пустым`);
    }

    if (minLength && value.length < minLength) {
      throw new Error(`${paramName} должен содержать не менее ${minLength} символов`);
    }

    if (maxLength && value.length > maxLength) {
      throw new Error(`${paramName} должен содержать не более ${maxLength} символов`);
    }

    return value;
  }

  return undefined;
}

/**
 * Валидирует числовой параметр
 */
export function validateNumber(
  value: unknown,
  paramName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {},
): number | undefined {
  const { required = true, integer = false, min, max } = options;

  if (required && isNullOrUndefined(value)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} должен быть числом`);
    }

    if (integer && !Number.isInteger(value)) {
      throw new Error(`${paramName} должен быть целым числом`);
    }

    if (min !== undefined && value < min) {
      throw new Error(`${paramName} должен быть не менее ${min}`);
    }

    if (max !== undefined && value > max) {
      throw new Error(`${paramName} должен быть не более ${max}`);
    }

    return value;
  }

  return undefined;
}

/**
 * Валидирует массив
 */
export function validateArray<T>(
  value: unknown,
  paramName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  } = {},
): T[] | undefined {
  const { required = true, minLength, maxLength } = options;

  if (required && isNullOrUndefined(value)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    if (!Array.isArray(value)) {
      throw new Error(`${paramName} должен быть массивом`);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw new Error(`${paramName} должен содержать не менее ${minLength} элементов`);
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new Error(`${paramName} должен содержать не более ${maxLength} элементов`);
    }

    return value as T[];
  }

  return undefined;
}

/**
 * Валидирует enum значение
 */
export function validateEnum<T>(
  value: unknown,
  enumObject: Record<string, T>,
  paramName: string,
  required = true,
): T | undefined {
  if (required && isNullOrUndefined(value)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    const validValues = Object.values(enumObject);
    // Для числовых enum'ов Object.values возвращает и ключи, и значения
    // Фильтруем только числовые значения для числовых enum'ов
    const numericValues = validValues.filter(v => typeof v === 'number');
    const stringValues = validValues.filter(v => typeof v === 'string');

    // Используем только числовые значения если они есть, иначе строковые
    const targetValues = numericValues.length > 0 ? numericValues : stringValues;

    if (!targetValues.includes(value as T)) {
      throw new Error(`${paramName} должен быть одним из: ${targetValues.join(', ')}`);
    }
    return value as T;
  }

  return undefined;
}

/**
 * Результат валидации
 */
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

/**
 * Создает результат валидации
 */
export function createValidationResult<T>(
  isValid: boolean,
  data?: T,
  errors?: string[],
  warnings?: string[],
): ValidationResult<T> {
  return {
    isValid,
    ...(data !== undefined && { data }),
    ...(errors && errors.length > 0 && { errors }),
    ...(warnings && warnings.length > 0 && { warnings }),
  };
}

/**
 * Выполняет валидацию с обработкой ошибок
 */
export async function validateWithErrorHandling<T>(
  validator: () => Promise<T> | T,
  errorContext: string,
): Promise<ValidationResult<T>> {
  try {
    const result = await validator();
    return createValidationResult(true, result);
  } catch (error) {
    return createValidationResult(false, undefined, [
      `Ошибка валидации ${errorContext}: ${getErrorMessage(error)}`,
    ]);
  }
}
