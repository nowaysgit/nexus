import { Logger } from '@nestjs/common';
import { Update, Start, Help, On, Ctx, Hears, Command } from 'nestjs-telegraf';
import { Context } from './interfaces/context.interface';
import { CommandHandler } from './handlers/command.handler';
import { MessageHandler } from './handlers/message.handler';
import { SessionService } from './services/session.service';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private commandHandler: CommandHandler,
    private messageHandler: MessageHandler,
    private sessionService: SessionService,
  ) {}

  // Обработка команды /start
  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleStart(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /start: ${error.message}`);
      await ctx.reply('Произошла ошибка при запуске бота. Попробуйте позже.');
    }
  }

  // Обработка команды /help
  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleHelp(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /help: ${error.message}`);
      await ctx.reply('Произошла ошибка при отображении справки. Попробуйте позже.');
    }
  }

  // Обработка команды /characters
  @Command('characters')
  async onCharacters(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleCharacters(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /characters: ${error.message}`);
      await ctx.reply('Произошла ошибка при загрузке персонажей. Попробуйте позже.');
    }
  }

  // Обработка команды /create
  @Command('create')
  async onCreate(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleCreate(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /create: ${error.message}`);
      await ctx.reply('Произошла ошибка при создании персонажа. Попробуйте позже.');
    }
  }

  // Обработка команд администратора
  @Hears([/^\/generate_key/, /^\/list_keys/, /^\/deactivate_key/])
  async onAdminCommand(@Ctx() ctx: Context): Promise<void> {
    try {
      const messageText = ctx.message.text;
      await this.commandHandler.handleAdminCommand(ctx, messageText);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды администратора: ${error.message}`);
      await ctx.reply('Произошла ошибка при выполнении команды администратора.');
    }
  }

  // Обработка колбэков от кнопок
  @On('callback_query')
  async onCallbackQuery(@Ctx() ctx: Context): Promise<void> {
    try {
      const callbackData = ctx.callbackQuery.data;
      await this.commandHandler.handleCallback(ctx, callbackData);
    } catch (error) {
      this.logger.error(`Ошибка при обработке callback_query: ${error.message}`);
      await ctx.reply('Произошла ошибка при обработке действия. Попробуйте позже.');
    }
  }

  // Обработка текстовых сообщений
  @On('text')
  async onText(@Ctx() ctx: Context): Promise<void> {
    try {
      await this.messageHandler.handleMessage(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке текстового сообщения: ${error.message}`);
      await ctx.reply('Произошла ошибка при обработке вашего сообщения. Попробуйте позже.');
    }
  }
}
