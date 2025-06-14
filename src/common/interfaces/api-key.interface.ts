import { Request } from 'express';

/**
 * Интерфейс для сервисов проверки API ключей
 */
export interface IApiKeyValidator {
  /**
   * Проверяет валидность API ключа в запросе
   * @param request HTTP запрос
   * @returns true если ключ валиден, false в противном случае
   */
  validateApiKey(request: Request): boolean;

  /**
   * Извлекает API ключ из запроса
   * @param request HTTP запрос
   * @returns API ключ или undefined если ключ не найден
   */
  extractApiKey(request: Request): string | undefined;
}

/**
 * Интерфейс для конфигурации API ключей
 */
export interface IApiKeyConfig {
  /** API ключ для административных маршрутов */
  adminApiKey: string;

  /** API ключ для клиентских маршрутов */
  clientApiKey: string;

  /** Разрешать ли локальные запросы без API ключа */
  allowLocalWithoutKey: boolean;
}
