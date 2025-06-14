import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { LogService } from '../../logging/log.service';
import { Request } from 'express';
import { User } from '../../user/entities/user.entity';

/**
 * Декоратор для указания требуемых ролей
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Декоратор для ограничения доступа только администраторам
 */
export const Admin = () => Roles('admin');

/**
 * Гвард для проверки ролей пользователя
 * Используется для ограничения доступа к определенным маршрутам на основе ролей пользователя
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logService: LogService,
  ) {}

  /**
   * Проверяет, имеет ли пользователь необходимые роли для доступа
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

    // Получаем требуемые роли из метаданных
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Если роли не указаны, пропускаем запрос
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User;

    // Если пользователь не авторизован, отклоняем запрос
    if (!user) {
      this.logService.warn('Запрос отклонен: отсутствует пользователь в запросе');
      return false;
    }

    // Проверяем, имеет ли пользователь необходимые роли
    const hasRole = () => {
      if (requiredRoles.includes('admin') && user.isAdmin) {
        return true;
      }

      if (user.roles && Array.isArray(user.roles)) {
        return requiredRoles.some(role => user.roles.includes(role));
      }

      return false;
    };

    const result = hasRole();
    if (!result) {
      this.logService.warn(
        `Пользователь ${user.id} не имеет необходимых ролей для доступа: ${requiredRoles.join(', ')}`,
      );
    }

    return result;
  }
}
