import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Rollbar from 'rollbar';

/**
 * Интерфейс для конфигурации Rollbar
 */
interface RollbarConfig {
  enabled: boolean;
  accessToken: string;
  environment: string;
  captureUncaught: boolean;
  captureUnhandledRejections: boolean;
}

/**
 * Сервис для отправки логов и ошибок в Rollbar
 */
@Injectable()
export class RollbarService implements OnModuleInit {
  private rollbar: Rollbar;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const rollbarConfig = this.configService.get<RollbarConfig>('logging.rollbar') || {
      enabled: false,
      accessToken: '',
      environment: 'development',
      captureUncaught: true,
      captureUnhandledRejections: true,
    };

    this.enabled = rollbarConfig.enabled;

    // Не инициализируем Rollbar, если он отключен
    if (!this.enabled) {
      return;
    }

    // Инициализация Rollbar
    this.rollbar = new Rollbar({
      accessToken: rollbarConfig.accessToken,
      environment: rollbarConfig.environment,
      captureUncaught: rollbarConfig.captureUncaught,
      captureUnhandledRejections: rollbarConfig.captureUnhandledRejections,
    });
  }

  onModuleInit() {
    if (this.enabled) {
      this.info('Rollbar initialized successfully');
    }
  }

  /**
   * Логирует информационное сообщение
   */
  info(message: string, extra?: Record<string, any>): void {
    if (this.enabled) {
      this.rollbar.info(message, extra);
    }
  }

  /**
   * Логирует сообщение с уровнем debug
   */
  debug(message: string, extra?: Record<string, any>): void {
    if (this.enabled) {
      this.rollbar.debug(message, extra);
    }
  }

  /**
   * Логирует предупреждающее сообщение
   */
  warn(message: string, extra?: Record<string, any>): void {
    if (this.enabled) {
      this.rollbar.warning(message, extra);
    }
  }

  /**
   * Логирует ошибку
   */
  error(error: Error, extra?: Record<string, any>): void {
    if (this.enabled) {
      this.rollbar.error(error, extra);
    }
  }

  /**
   * Логирует критическую ошибку
   */
  critical(error: Error, extra?: Record<string, any>): void {
    if (this.enabled) {
      this.rollbar.critical(error, extra);
    }
  }
}
