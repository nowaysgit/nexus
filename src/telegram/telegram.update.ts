import { Injectable } from '@nestjs/common';
import { LogService } from '../logging/log.service';
import { ConfigService } from '@nestjs/config';
import { Update } from 'telegraf/typings/core/types/typegram';
import { Telegraf } from 'telegraf';
import { CommandHandler } from './handlers/command.handler';
import { MessageHandler } from './handlers/message.handler';
import { Context, ExtendedCallbackQuery } from './interfaces/context.interface';
import { ActionService } from '../character/services/action.service';
import { CallbackHandler } from './handlers/callback.handler';
import { withErrorHandling } from '../common/utils/error-handling/error-handling.utils';

type TelegrafUpdate = Update;

@Injectable()
export class TelegramUpdate {
  constructor(
    private readonly configService: ConfigService,
    private readonly commandHandler: CommandHandler,
    private readonly messageHandler: MessageHandler,
    private readonly callbackHandler: CallbackHandler,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(TelegramUpdate.name);
  }

  // Обрабатываем команды
  async handleCommand(ctx: Context, command: string): Promise<void> {
    await withErrorHandling(
      async () => {
        if (!ctx.from?.id) {
          return;
        }

        // Логируем команду, удаляя обращение к боту и аргументы
        const baseCommand = command.split(' ')[0].split('@')[0];
        this.logService.log(`Получена команда: ${baseCommand} от пользователя ${ctx.from.id}`);

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
      },
      'обработке команды',
      this.logService,
      { command },
    );
  }

  // Обработка сообщений
  async handleMessage(ctx: Context): Promise<void> {
    await withErrorHandling(
      async () => {
        if (!ctx.from) {
          return;
        }

        const userId = ctx.from.id;
        // Логируем входящее сообщение
        this.logService.log(`Получено сообщение от пользователя ${userId}`);

        // Передаем управление обработчику сообщений
        await this.messageHandler.handleMessage(ctx);
      },
      'обработке сообщения',
      this.logService,
    );
  }

  // Обрабатываем колбэки от кнопок
  async handleCallback(ctx: Context): Promise<void> {
    await withErrorHandling(
      async () => {
        // Приводим callbackQuery к расширенному типу
        const callbackQuery = ctx.callbackQuery as ExtendedCallbackQuery | undefined;
        if (!callbackQuery || !callbackQuery.data) {
          return;
        }

        this.logService.log(
          `Получен колбэк: ${callbackQuery.data} от пользователя ${ctx.from?.id}`,
        );

        // Используем сервис обработки callback-запросов
        await this.callbackHandler.handleCallback(ctx);
      },
      'обработке колбэка',
      this.logService,
      { callbackData: (ctx.callbackQuery as ExtendedCallbackQuery | undefined)?.data },
    );
  }

  // Обработка обновлений от Telegram
  async handleUpdate(update: TelegrafUpdate, bot: Telegraf<Context>): Promise<void> {
    await withErrorHandling(
      async () => {
        if (!update) {
          return;
        }

        // Безопасное создание контекста
        if (!('message' in update) && !('callback_query' in update)) {
          this.logService.debug(`Неподдерживаемый тип обновления: ${this.getUpdateType(update)}`);
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
      },
      'обработке обновления',
      this.logService,
      { updateType: this.getUpdateType(update) },
    );
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
