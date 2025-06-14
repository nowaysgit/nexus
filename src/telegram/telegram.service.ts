import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { LogService } from '../logging/log.service';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { InjectBot } from './decorators/inject-bot.decorator';
import { Context } from './interfaces/context.interface';

// Интерфейс конфигурации Telegram
interface TelegramConfig {
  token: string;
  launchMode: 'webhook' | 'polling';
  webhookUrl?: string;
  webhookPath?: string;
  maxMessageLength: number;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private readonly config: TelegramConfig;

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(TelegramService.name);
    const config = this.configService.get<TelegramConfig>('telegram');
    if (!config) {
      throw new Error('Отсутствует конфигурация Telegram');
    }
    this.config = config;
  }

  // Инициализация бота при запуске модуля
  async onModuleInit() {
    try {
      // Проверяем валидность конфигурации
      if (!this.config.token) {
        throw new Error('Не настроен токен бота в конфигурации Telegram');
      }

      // Запускаем бота в зависимости от режима
      if (this.config.launchMode === 'webhook' && this.config.webhookUrl) {
        this.logService.log(
          `Запуск в режиме webhook: ${this.config.webhookUrl}${this.config.webhookPath}`,
        );

        // Настраиваем webhook
        await this.bot.telegram.setWebhook(`${this.config.webhookUrl}${this.config.webhookPath}`);

        // Проверяем информацию о webhook
        const webhookInfo = await this.bot.telegram.getWebhookInfo();
        this.logService.log(`Webhook info: ${JSON.stringify(webhookInfo)}`);

        // Проверяем что webhook настроен правильно
        if (!webhookInfo.url) {
          throw new Error('Не удалось настроить webhook');
        }
      } else {
        this.logService.log('Запуск в режиме long polling');

        // Удаляем предыдущий webhook если он был
        if (this.bot && this.bot.telegram) {
          await this.bot.telegram.deleteWebhook();
        } else {
          this.logService.warn('Не удалось удалить webhook: объект bot.telegram не инициализирован');
        }

        // Запускаем в режиме polling
        await this.bot.launch();
      }

      this.logService.log('Telegram бот успешно запущен');
    } catch (error) {
      this.logService.error(
        `Ошибка при запуске бота: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  // Отправка сообщения пользователю
  async sendMessage(
    chatId: number | string,
    message: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Проверяем длину сообщения и при необходимости обрезаем
      const maxLength = this.config.maxMessageLength;
      const truncatedMessage =
        message.length > maxLength ? `${message.substring(0, maxLength - 3)}...` : message;

      if (this.bot && this.bot.telegram) {
        await this.bot.telegram.sendMessage(chatId, truncatedMessage, extra);
      } else {
        throw new Error('Объект bot.telegram не инициализирован');
      }
    } catch (error) {
      this.logService.error(
        `Ошибка при отправке сообщения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  // Получение информации о боте
  async getMe() {
    if (this.bot && this.bot.telegram) {
      return await this.bot.telegram.getMe();
    } else {
      this.logService.warn('Не удалось получить информацию о боте: объект bot.telegram не инициализирован');
      return null;
    }
  }

  // Корректное завершение работы бота при остановке приложения
  onApplicationShutdown() {
    this.logService.log('Останавливаем Telegram бота...');
    if (this.bot) {
      this.bot.stop('Остановка приложения');
    } else {
      this.logService.warn('Не удалось остановить бота: объект bot не инициализирован');
    }
  }
}
