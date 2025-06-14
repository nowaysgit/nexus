import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IApiKeyValidator, IApiKeyConfig } from '../common/interfaces/api-key.interface';
import { LogService } from '../logging/log.service';

/**
 * Единый сервис для проверки API-ключей
 * Консолидирует логику для всех мест, где требуется проверка API-ключа
 */
@Injectable()
export class ApiKeyService implements IApiKeyValidator {
  private readonly config: IApiKeyConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.config = {
      adminApiKey: this.configService.get<string>('admin.apiKey', ''),
      clientApiKey: this.configService.get<string>('api.key', ''),
      allowLocalWithoutKey: true,
    };

    // Логирование статуса ключей
    this.logKeyStatus('Админ API', this.config.adminApiKey);
    this.logKeyStatus('Клиент API', this.config.clientApiKey);
  }

  /**
   * Проверяет валидность API ключа в запросе
   */
  validateApiKey(request: Request): boolean {
    const keyType = this.determineKeyType(request);
    const validApiKey = keyType === 'admin' ? this.config.adminApiKey : this.config.clientApiKey;
    return this.validateApiKeyInternal(request, validApiKey, keyType);
  }

  /**
   * Проверяет админ API-ключ
   */
  validateAdminApiKey(request: Request): boolean {
    return this.validateApiKeyInternal(request, this.config.adminApiKey, 'admin');
  }

  /**
   * Проверяет клиентский API-ключ
   */
  validateClientApiKey(request: Request): boolean {
    return this.validateApiKeyInternal(request, this.config.clientApiKey, 'client');
  }

  /**
   * Извлекает API-ключ из запроса (заголовок или query-параметр)
   */
  extractApiKey(request: Request): string | undefined {
    // Проверка в заголовке X-API-KEY
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
      return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Проверка в query-параметре apiKey
    const queryApiKey = request.query.apiKey;
    if (queryApiKey && typeof queryApiKey === 'string') {
      return queryApiKey;
    }

    // Ключ не найден
    return undefined;
  }

  /**
   * Определяет тип API ключа на основе пути запроса
   */
  private determineKeyType(request: Request): 'admin' | 'client' {
    const path = request.path.toLowerCase();
    return path.includes('/admin/') || path.includes('/api/admin/') ? 'admin' : 'client';
  }

  /**
   * Базовая проверка API-ключа с логикой для локальных запросов
   */
  private validateApiKeyInternal(request: Request, validApiKey: string, keyType: string): boolean {
    const requestApiKey = this.extractApiKey(request);
    const ip = request.ip || request.connection.remoteAddress;
    const isLocalRequest = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';

    // Если ключ не настроен, разрешаем только локальные запросы
    if (!validApiKey) {
      if (isLocalRequest && this.config.allowLocalWithoutKey) {
        this.logService.debug(`Локальный запрос разрешен без ${keyType} API-ключа`);
        return true;
      }
      this.logService.warn(`${keyType} API-ключ не настроен, отклоняем внешний запрос`);
      return false;
    }

    // Если ключ не предоставлен
    if (!requestApiKey) {
      this.logService.warn(`${keyType} API-ключ не предоставлен в запросе`);
      return false;
    }

    // Проверка ключа
    const isValid = requestApiKey === validApiKey;
    if (!isValid) {
      this.logService.warn(`Недействительный ${keyType} API-ключ от ${ip}`);
    }

    return isValid;
  }

  /**
   * Логирует статус API-ключа с безопасными метриками
   */
  private logKeyStatus(keyName: string, key: string): void {
    if (!key) {
      this.logService.warn(`${keyName}-ключ не настроен`);
      return;
    }

    const keyLength = key.length;
    const keyPrefix = key.substring(0, 3) + '...';

    this.logService.debug(`${keyName}-ключ настроен: ${keyPrefix} (${keyLength} символов)`);

    // В режиме разработки показываем полный ключ
    if (process.env.NODE_ENV === 'development') {
      this.logService.debug(`${keyName}-ключ в режиме разработки: ${key}`);
    }
  }
}
