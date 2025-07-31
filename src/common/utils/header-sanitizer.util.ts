import { IncomingHttpHeaders } from 'http';

/**
 * Список чувствительных заголовков, которые должны быть скрыты
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'api-key',
  'x-api-key',
  'proxy-authorization',
  'www-authenticate',
  'token',
];

/**
 * Список чувствительных полей в данных запроса
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'credit_card',
  'card',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
];

/**
 * Утилита для очистки заголовков от чувствительной информации
 * @param headers Заголовки запроса
 * @returns Очищенные заголовки
 */
export function sanitizeHeaders(
  headers: IncomingHttpHeaders | Record<string, unknown>,
): Record<string, string> {
  if (!headers) return {};

  const sanitized: Record<string, string> = {};

  Object.keys(headers).forEach(key => {
    const value = headers[key];
    if (value !== undefined) {
      const lowerKey = key.toLowerCase();
      sanitized[key] = SENSITIVE_HEADERS.includes(lowerKey)
        ? '[РЕДАКТИРОВАНО]'
        : Array.isArray(value)
          ? value.join(', ')
          : JSON.stringify(value);
    }
  });

  return sanitized;
}

/**
 * Утилита для очистки данных запроса от чувствительной информации
 * @param data Данные запроса
 * @param visited Множество для отслеживания уже обработанных объектов (защита от циклических ссылок)
 * @returns Очищенные данные
 */
export function sanitizeData(
  data: unknown,
  visited: WeakSet<object> = new WeakSet(),
): Record<string, unknown> | unknown[] | { value: unknown } | { '[ЦИКЛИЧЕСКАЯ_ССЫЛКА]': boolean } {
  if (!data) return {};
  if (typeof data !== 'object' || data === null) return { value: data };

  // Защита от циклических ссылок
  if (visited.has(data)) {
    return { '[ЦИКЛИЧЕСКАЯ_ССЫЛКА]': true };
  }
  visited.add(data);

  // Обработка массивов
  if (Array.isArray(data)) {
    return data.map(item => {
      // Если элемент массива - примитивное значение, возвращаем его с правильной типизацией
      if (typeof item !== 'object' || item === null) {
        return item as string | number | boolean | null;
      }
      // Если элемент массива - объект, рекурсивно обрабатываем его
      return sanitizeData(item, visited);
    });
  }

  const sanitized: Record<string, unknown> = {};

  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.includes(lowerKey)) {
      sanitized[key] = '[РЕДАКТИРОВАНО]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        // Если элемент массива - примитивное значение, возвращаем его с правильной типизацией
        if (typeof item !== 'object' || item === null) {
          return item as string | number | boolean | null;
        }
        // Если элемент массива - объект, рекурсивно обрабатываем его
        return sanitizeData(item, visited);
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, visited);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}
