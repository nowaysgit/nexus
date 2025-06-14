/**
 * Общие типы для использования во всем приложении
 * Способствуют улучшению типизации и уменьшению использования any
 */

/**
 * Тип для объекта с произвольными строковыми ключами и значениями любого типа
 * Заменяет Record<string, any>
 */
export type Dictionary<T = unknown> = Record<string, T>;

/**
 * Контекст для метаданных операций
 * Используется для передачи дополнительной информации между методами
 */
export type OperationContext = Dictionary<unknown>;

/**
 * Тип для произвольного объекта, который не null и не undefined
 * Более строгий, чем any, но позволяет работать с произвольными структурами
 */
export type JsonObject = {
  [key: string]: JsonValue;
};

/**
 * Тип для произвольного значения JSON
 * Полезен для работы с API ответами и внешними данными
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

/**
 * Тип для массива JSON значений
 */
export type JsonArray = JsonValue[];

/**
 * Тип для функции обратного вызова
 * Заменяет (...args: any[]) => any
 */
export type Callback<T = void, Args extends unknown[] = unknown[]> = (...args: Args) => T;

/**
 * Тип для функции обработки ошибок
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ErrorHandler = (error: Error | unknown, context?: OperationContext) => void;

/**
 * Тип для функции трансформации данных
 */
export type Transformer<T, R = T> = (input: T) => R;

/**
 * Параметры пагинации для запросов
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Опции сортировки для запросов
 */
export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Опции фильтрации для запросов
 */
export interface FilterOptions {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';
  value: unknown;
}

/**
 * Результат операции API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Dictionary;
}

/**
 * Функция безопасного приведения типов
 * Позволяет безопасно преобразовать неизвестный тип в указанный
 */
export function safeCast<T>(value: unknown): T {
  return value as T;
}
