import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleGuard, Admin } from '../guards/role.guard';
import { PublicEndpoint } from '../guards/public.decorator';

/**
 * Основной контроллер API
 * Предоставляет общие эндпоинты для API
 */
@Controller('api')
export class ApiController {
  /**
   * Проверка работоспособности API
   * Публичный эндпоинт, не требующий авторизации
   */
  @Get('health')
  @PublicEndpoint()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Проверка административного доступа
   * Требует наличия административного API ключа
   */
  @Get('admin/check')
  @Admin()
  @UseGuards(RoleGuard)
  adminCheck() {
    return {
      status: 'ok',
      message: 'Административный доступ подтвержден',
      timestamp: new Date().toISOString(),
    };
  }
}
