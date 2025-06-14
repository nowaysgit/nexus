import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../logging/log.service';

/**
 * Сервис контроля доступа для Telegram бота
 */
@Injectable()
export class AccessControlService {
  private readonly allowedUsers: Set<string>;
  private readonly adminUsers: Set<string>;
  private readonly accessMode: 'open' | 'restricted' | 'admin_only';

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(AccessControlService.name);

    // Получаем настройки доступа из конфигурации
    this.accessMode = this.configService.get<string>('telegram.accessMode', 'open') as
      | 'open'
      | 'restricted'
      | 'admin_only';

    const allowedUsersList = this.configService
      .get<string>('telegram.allowedUsers', '')
      .split(',')
      .filter(Boolean);
    this.allowedUsers = new Set(allowedUsersList);

    const adminUsersList = this.configService
      .get<string>('telegram.adminUsers', '')
      .split(',')
      .filter(Boolean);
    this.adminUsers = new Set(adminUsersList);

    this.logService.log(
      `Инициализирован контроль доступа: режим=${this.accessMode}, разрешенных пользователей=${this.allowedUsers.size}, админов=${this.adminUsers.size}`,
    );
  }

  /**
   * Проверяет, имеет ли пользователь доступ к боту
   */
  hasAccess(telegramId: string | number): boolean {
    const userId = telegramId.toString();

    switch (this.accessMode) {
      case 'open':
        return true;

      case 'admin_only':
        return this.adminUsers.has(userId);

      case 'restricted':
        return this.allowedUsers.has(userId) || this.adminUsers.has(userId);

      default:
        this.logService.warn(`Неизвестный режим доступа: ${String(this.accessMode)}`);
        return false;
    }
  }

  /**
   * Проверяет, является ли пользователь администратором
   */
  isAdmin(telegramId: string | number): boolean {
    const userId = telegramId.toString();
    return this.adminUsers.has(userId);
  }

  /**
   * Добавляет пользователя в список разрешенных
   */
  addAllowedUser(telegramId: string | number): void {
    const userId = telegramId.toString();
    this.allowedUsers.add(userId);
    this.logService.log(`Пользователь ${userId} добавлен в список разрешенных`);
  }

  /**
   * Удаляет пользователя из списка разрешенных
   */
  removeAllowedUser(telegramId: string | number): void {
    const userId = telegramId.toString();
    this.allowedUsers.delete(userId);
    this.logService.log(`Пользователь ${userId} удален из списка разрешенных`);
  }

  /**
   * Получает информацию о настройках доступа
   */
  getAccessInfo(): {
    mode: string;
    allowedUsersCount: number;
    adminUsersCount: number;
  } {
    return {
      mode: this.accessMode,
      allowedUsersCount: this.allowedUsers.size,
      adminUsersCount: this.adminUsers.size,
    };
  }
}
