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
  'apiKey',
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
 * @returns Очищенные данные
 */
export function sanitizeData(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data !== 'object' || data === null) return { value: data };

  const sanitized: Record<string, unknown> = {};

  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.includes(lowerKey)) {
      sanitized[key] = '[РЕДАКТИРОВАНО]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}
