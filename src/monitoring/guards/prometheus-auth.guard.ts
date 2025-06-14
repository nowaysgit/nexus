import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * Защитник для проверки API-ключа при доступе к метрикам Prometheus
 */
@Injectable()
export class PrometheusAuthGuard implements CanActivate {
  private readonly enabled: boolean;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(PrometheusAuthGuard.name);
    this.enabled = this.configService.get<boolean>(
      'monitoring.metrics.prometheus.auth.enabled',
      false,
    );
    this.apiKey = this.configService.get<string>('monitoring.metrics.prometheus.auth.apiKey', '');
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Если аутентификация отключена, разрешаем доступ
    if (!this.enabled) {
      return true;
    }

    // Если API-ключ не настроен, логируем предупреждение и разрешаем доступ
    if (!this.apiKey) {
      this.logService.warn('Аутентификация для Prometheus включена, но API-ключ не настроен');
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Проверяем API-ключ в заголовке X-API-Key
    const apiKey = request.headers['x-api-key'];

    if (typeof apiKey === 'string' && apiKey === this.apiKey) {
      return true;
    }

    // Альтернативно проверяем ключ в параметре запроса
    const queryApiKey = request.query.apiKey;

    if (typeof queryApiKey === 'string' && queryApiKey === this.apiKey) {
      return true;
    }

    this.logService.warn(
      `Отказано в доступе к метрикам Prometheus: неверный API-ключ от ${request.ip || 'неизвестного IP'}`,
    );

    return false;
  }
}
