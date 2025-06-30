/**
 * Утилиты для устранения повторяющихся паттернов
 */

/**
 * Создает стандартную ошибку "не найден"
 */
export function createNotFoundError(entityName: string, id: string | number): Error {
  return new Error(`${entityName} с ID ${id} не найден`);
}

/**
 * Проверяет, является ли строка пустой
 */
export function isEmptyString(value: unknown): boolean {
  return !value || (typeof value === 'string' && value.trim() === '');
}

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
 * Валидирует обязательный параметр
 */
export function validateRequired(value: unknown, paramName: string): void {
  if (value === null || value === undefined) {
    throw new Error(`${paramName} обязателен`);
  }
}

/**
 * Валидирует строковый параметр
 */
export function validateString(value: unknown, paramName: string, required = true): void {
  if (required && (value === null || value === undefined)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    if (typeof value !== 'string') {
      throw new Error(`${paramName} должен быть строкой`);
    }

    if (required && isEmptyString(value)) {
      throw new Error(`${paramName} не может быть пустым`);
    }
  }
}

/**
 * Валидирует числовой параметр
 */
export function validateNumber(value: unknown, paramName: string, required = true): void {
  if (required && (value === null || value === undefined)) {
    throw new Error(`${paramName} обязателен`);
  }

  if (value !== null && value !== undefined) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} должен быть числом`);
    }
  }
}

/**
 * Стандартные проверки входных параметров
 */
export class InputValidator {
  /**
   * Проверяет ID сущности
   */
  static validateId(id: unknown, _entityName = 'Сущность'): string | number {
    validateRequired(id, 'ID');

    if (typeof id === 'string') {
      if (isEmptyString(id)) {
        throw new Error('ID не может быть пустым');
      }
      return id;
    }

    if (typeof id === 'number') {
      if (id <= 0) {
        throw new Error('ID должен быть положительным числом');
      }
      return id;
    }

    throw new Error('ID должен быть строкой или числом');
  }

  /**
   * Проверяет пользовательский ввод
   */
  static validateUserInput(input: unknown, fieldName: string): string {
    validateRequired(input, fieldName);
    validateString(input, fieldName);

    const str = input as string;
    if (str.length > 1000) {
      throw new Error(`${fieldName} слишком длинный (максимум 1000 символов)`);
    }

    return str.trim();
  }

  /**
   * Проверяет массив
   */
  static validateArray(arr: unknown, fieldName: string, required = true): unknown[] {
    if (required) {
      validateRequired(arr, fieldName);
    }

    if (arr !== null && arr !== undefined) {
      if (!Array.isArray(arr)) {
        throw new Error(`${fieldName} должен быть массивом`);
      }
    }

    return (arr as unknown[]) || [];
  }
}

/**
 * Обработчик повторяющихся паттернов ошибок
 */
export class ErrorPatternHandler {
  /**
   * Обрабатывает ошибку "сущность не найдена"
   */
  static handleNotFound(entityName: string, id: string | number): never {
    throw createNotFoundError(entityName, id);
  }

  /**
   * Обрабатывает ошибки валидации
   */
  static handleValidationError(error: unknown, context: string): never {
    const message = `Ошибка валидации ${context}: ${getErrorMessage(error)}`;
    throw new Error(message);
  }

  /**
   * Обрабатывает общие ошибки операций
   */
  static handleOperationError(error: unknown, operation: string): never {
    const message = `Ошибка при ${operation}: ${getErrorMessage(error)}`;
    throw new Error(message);
  }
}
