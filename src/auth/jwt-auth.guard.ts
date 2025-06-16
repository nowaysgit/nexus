import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { LogService } from '../logging/log.service';

/**
 * Guard для защиты маршрутов, требующих JWT аутентификации
 * Расширяет стандартный AuthGuard('jwt') с добавлением логирования и обработки исключений
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private logService: LogService,
  ) {
    super();
    this.logService.setContext('JwtAuthGuard');
  }

  /**
   * Метод активации guard, определяет, имеет ли пользователь доступ к маршруту
   */
  canActivate(context: ExecutionContext) {
    // Проверяем, есть ли метаданные isPublic, которые позволяют пропустить аутентификацию
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Если маршрут публичный, пропускаем проверку
    if (isPublic) {
      return true;
    }

    // Вызываем родительский метод для проверки JWT
    return super.canActivate(context);
  }

  /**
   * Обработка ошибок аутентификации с логированием
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const path = request.url;
      const method = request.method;

      this.logService.warn(`Неудачная попытка аутентификации: ${method} ${path}`, {
        error: err?.message || 'Нет пользователя',
        info: info?.message,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      throw new UnauthorizedException('Требуется аутентификация');
    }

    return user;
  }
}
