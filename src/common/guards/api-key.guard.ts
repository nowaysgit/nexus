import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeyService } from '../../infrastructure/api-key.service';
import { LogService } from '../../logging/log.service';

/**
 * Гвард для проверки API-ключа
 * Используется для защиты API эндпоинтов от несанкционированного доступа
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
    private readonly logService: LogService,
  ) {}

  /**
   * Проверяет валидность API ключа в запросе
   */
  canActivate(context: ExecutionContext): boolean {
    // Проверка отключения гварда для публичных маршрутов
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Проверяем клиентский API-ключ через сервис
    if (this.apiKeyService.validateClientApiKey(request)) {
      return true;
    }

    // Если ключ не предоставлен
    const apiKey = this.apiKeyService.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException('API ключ не предоставлен');
    }

    // Если ключ предоставлен, но не прошел валидацию
    this.logService.warn(`Отказано в доступе: неверный API-ключ от ${request.ip}`);
    throw new UnauthorizedException('Недействительный API ключ');
  }
}
