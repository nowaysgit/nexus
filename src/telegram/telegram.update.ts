import { Injectable } from '@nestjs/common';
import { LogService } from '../logging/log.service';
import { ConfigService } from '@nestjs/config';
import { Update } from 'telegraf/typings/core/types/typegram';
import { Telegraf } from 'telegraf';
import { CommandHandler } from './handlers/command.handler';
import { MessageHandler } from './handlers/message.handler';
import { Context, ExtendedCallbackQuery } from './interfaces/context.interface';
import { CallbackHandler } from './handlers/callback.handler';
import { BaseService } from '../common/base/base.service';

type TelegrafUpdate = Update;

@Injectable()
export class TelegramUpdate extends BaseService {
  constructor(
    private readonly configService: ConfigService,
    private readonly commandHandler: CommandHandler,
    private readonly messageHandler: MessageHandler,
    private readonly callbackHandler: CallbackHandler,
    logService: LogService,
  ) {
    super(logService);
  }

  // Обрабатываем команды
  async handleCommand(ctx: Context, command: string): Promise<void> {
    return this.withErrorHandling('обработке команды', async () => {
      if (!ctx.from?.id) {
        return;
      }

      // Логируем команду, удаляя обращение к боту и аргументы
      const baseCommand = command.split(' ')[0].split('@')[0];
      this.logInfo(`Получена команда: ${baseCommand} от пользователя ${ctx.from.id}`);

      // Проверяем, является ли команда админской
      if (baseCommand.startsWith('/admin_')) {
        await this.commandHandler.handleAdminCommand(ctx, command);
        return;
      }

      // Стандартные команды
      switch (baseCommand) {
        case '/start':
          await this.commandHandler.handleStart(ctx);
          break;
        case '/help':
          await this.commandHandler.handleHelp(ctx);
          break;
        case '/characters':
          await this.commandHandler.handleCharacters(ctx);
          break;
        case '/create':
          await this.commandHandler.handleCreate(ctx);
          break;
        case '/actions':
          await this.commandHandler.handleActionsCommand(ctx);
          break;
        default:
          await ctx.reply(
            'Неизвестная команда. Используйте /help для получения списка доступных команд.',
          );
      }
    });
  }

  // Обработка сообщений
  async handleMessage(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке сообщения', async () => {
      if (!ctx.from) {
        return;
      }

      const userId = ctx.from.id;
      // Логируем входящее сообщение
      this.logInfo(`Получено сообщение от пользователя ${userId}`);

      // Передаем управление обработчику сообщений
      await this.messageHandler.handleMessage(ctx);
    });
  }

  // Обрабатываем колбэки от кнопок
  async handleCallback(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке колбэка', async () => {
      // Приводим callbackQuery к расширенному типу
      const callbackQuery = ctx.callbackQuery as ExtendedCallbackQuery | undefined;
      if (!callbackQuery || !callbackQuery.data) {
        return;
      }

      this.logInfo(`Получен колбэк: ${callbackQuery.data} от пользователя ${ctx.from?.id}`);

      // Используем сервис обработки callback-запросов
      await this.callbackHandler.handleCallback(ctx);
    });
  }

  // Обработка обновлений от Telegram
  async handleUpdate(update: TelegrafUpdate, bot: Telegraf<Context>): Promise<void> {
    return this.withErrorHandling('обработке обновления', async () => {
      if (!update) {
        return;
      }

      // Безопасное создание контекста
      if (!('message' in update) && !('callback_query' in update)) {
        this.logDebug(`Неподдерживаемый тип обновления: ${this.getUpdateType(update)}`);
        return;
      }

      // Напрямую обрабатываем обновление ботом и получаем контекст
      await bot.handleUpdate(update);

      // Получаем текст сообщения или данные колбэка
      if ('message' in update && update.message && 'text' in update.message) {
        const messageText = update.message.text;
        const ctx = {
          message: update.message,
          from: update.message.from,
        } as Context;

        // Обрабатываем команды
        if (messageText.startsWith('/')) {
          await this.handleCommand(ctx, messageText);
        } else {
          await this.handleMessage(ctx);
        }
      } else if ('callback_query' in update && update.callback_query) {
        const ctx = {
          callbackQuery: update.callback_query,
          from: update.callback_query.from,
        } as Context;

        await this.handleCallback(ctx);
      }
    });
  }

  // Вспомогательный метод для определения типа обновления
  private getUpdateType(update: TelegrafUpdate): string {
    if ('message' in update) return 'message';
    if ('callback_query' in update) return 'callback_query';
    if ('inline_query' in update) return 'inline_query';
    if ('channel_post' in update) return 'channel_post';
    return 'unknown';
  }
}
