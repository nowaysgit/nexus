import { Injectable, OnModuleInit, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { InjectBot } from './decorators/inject-bot.decorator';
import { Context } from './interfaces/context.interface';

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {}

  // Инициализация бота при запуске модуля
  async onModuleInit() {
    try {
      // Получаем режим запуска (webhook или polling)
      const launchMode = this.configService.get<string>('TELEGRAM_LAUNCH_MODE', 'polling');

      // Получаем webhook URL если он указан
      const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL', '');
      const webhookPath = this.configService.get<string>(
        'TELEGRAM_WEBHOOK_PATH',
        '/telegram/webhook',
      );

      // Запускаем бота в зависимости от режима
      if (launchMode === 'webhook' && webhookUrl) {
        this.logger.log(`Запуск в режиме webhook: ${webhookUrl}${webhookPath}`);

        // Настраиваем webhook
        await this.bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`);

        // Проверяем информацию о webhook
        const webhookInfo = await this.bot.telegram.getWebhookInfo();
        this.logger.log(`Webhook info: ${JSON.stringify(webhookInfo)}`);
      } else {
        this.logger.log('Запуск в режиме long polling');

        // Удаляем предыдущий webhook если он был
        await this.bot.telegram.deleteWebhook();

        // Запускаем в режиме polling
        await this.bot.launch();
      }

      this.logger.log('Telegram бот успешно запущен');
    } catch (error) {
      this.logger.error(`Ошибка при запуске бота: ${error.message}`);
      throw error;
    }
  }

  // Отправка сообщения пользователю
  async sendMessage(chatId: number | string, message: string, extra?: any): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, message, extra);
    } catch (error) {
      this.logger.error(`Ошибка при отправке сообщения: ${error.message}`);
      throw error;
    }
  }

  // Получение информации о боте
  async getMe() {
    return await this.bot.telegram.getMe();
  }

  // Корректное завершение работы бота при остановке приложения
  async onApplicationShutdown() {
    this.logger.log('Останавливаем Telegram бота...');
    this.bot.stop();
  }
}
