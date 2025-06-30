import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { ConfigService } from '@nestjs/config';
import { Character } from '../../character/entities/character.entity';
import { BaseService } from '../../common/base/base.service';
import { MessageFormatterService } from './message-formatter.service';
import { KeyboardFormatterService } from './keyboard-formatter.service';
import { CharacterMetadata, TelegramSendOptions } from '../interfaces/telegram.interfaces';
import { ErrorHandlingService } from '../../common/utils/error-handling/error-handling.service';
import { LogService } from '../../logging/log.service';
import { CharacterManagementService } from '../../character/services/character-management.service';
import { TelegramService } from '../telegram.service';
import { Context } from '../interfaces/context.interface';
import { getErrorMessage } from '../../common/utils/error.utils';

/**
 * Интерфейс прогресса действия
 */
export interface ActionProgress {
  percentage: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

@Injectable()
export class MessageService extends BaseService {
  private readonly lastSentProgressNotifications = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly messageFormatter: MessageFormatterService,
    private readonly keyboardFormatter: KeyboardFormatterService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly characterManagementService: CharacterManagementService,
    private readonly telegramService: TelegramService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Отправляет текстовое сообщение в Telegram чат
   * @param chatId ID чата или пользователя в Telegram
   * @param message Текст сообщения
   * @param options Дополнительные опции отправки
   * @returns Promise с результатом отправки
   */
  async sendMessage(
    chatId: number | string,
    message: string,
    options: TelegramSendOptions = {},
  ): Promise<void> {
    try {
      // Используем TelegramService вместо прямого обращения к bot
      await this.telegramService.sendMessage(chatId, message, options);
      this.logDebug(`Сообщение отправлено в чат ${chatId}`);
    } catch (error) {
      this.logError(`Ошибка при отправке сообщения в чат ${chatId}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Отправка сообщения от персонажа пользователю
   * @param telegramId - ID пользователя в Telegram
   * @param message - Текст сообщения
   * @param options - Дополнительные опции (characterId, isProactive, etc.)
   */
  async sendMessageToUser(
    chatId: number | string,
    message: string,
    options: {
      characterId?: number;
      isProactive?: boolean;
      actionType?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    return this.withErrorHandling('отправке сообщения пользователю', async () => {
      // Добавляем метаданные для отслеживания
      const sendOptions: TelegramSendOptions = {
        parse_mode: 'Markdown',
        metadata: {
          characterId: options.characterId,
          isProactive: options.isProactive,
          actionType: options.actionType,
          ...options.metadata,
        },
      };

      // Используем TelegramService вместо прямого обращения к bot
      await this.telegramService.sendMessage(chatId, message, sendOptions);
    });
  }

  // Отправка главного меню
  async sendMainMenu(ctx: Context): Promise<void> {
    return this.withErrorHandling('отправке главного меню', async () => {
      const keyboard = this.keyboardFormatter.createMainMenuKeyboard();
      await ctx.reply('Главное меню', {
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка информации о персонаже
  async sendCharacterInfo(ctx: Context, character: Character): Promise<void> {
    return this.withErrorHandling('отправке информации о персонаже', async () => {
      // Преобразуем Character в CharacterMetadata
      const characterMetadata: CharacterMetadata = {
        id: character.id.toString(),
        name: character.name,
        description: character.biography || '',
        isArchived: Boolean(character.isArchived),
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      };

      const messageText = await this.messageFormatter.formatCharacterInfo(characterMetadata);
      const keyboard =
        await this.keyboardFormatter.createCharacterProfileKeyboard(characterMetadata);

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка состояния персонажа
  async sendCharacterStatus(ctx: Context, character: Character): Promise<void> {
    return this.withErrorHandling('отправке статуса персонажа', async () => {
      // Получаем данные персонажа с анализом
      const characterAnalysis = await this.characterManagementService.getCharacterAnalysis(
        character.id.toString(),
      );

      // Преобразуем Character в CharacterMetadata
      const characterMetadata: CharacterMetadata = {
        id: character.id.toString(),
        name: character.name,
        description: character.biography || '',
        isArchived: Boolean(character.isArchived),
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      };

      // Формируем информацию о состоянии персонажа
      const status = `
Привязанность: ${character.affection || 0}/100
Доверие: ${character.trust || 0}/100
Энергия: ${character.energy || 0}/100
Этап отношений: ${character.relationshipStage || 'Начальный'}
Общее состояние: ${characterAnalysis.overallState}
`;

      const statusText = await this.messageFormatter.formatCharacterStatus(
        characterMetadata,
        status,
      );

      // Создаем действия для персонажа
      const actions = ['Подарок', 'Комплимент', 'Вопрос', 'Игра', 'Прогулка'];
      const keyboard = this.keyboardFormatter.createActionKeyboard(
        character.id.toString(),
        actions,
      );

      await ctx.reply(statusText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка информации о созданном персонаже
  async sendNewCharacterInfo(ctx: Context, character: Character): Promise<void> {
    return this.withErrorHandling('отправке информации о новом персонаже', async () => {
      // Преобразуем Character в CharacterMetadata
      const characterMetadata: CharacterMetadata = {
        id: character.id.toString(),
        name: character.name,
        description: character.biography || '',
        isArchived: Boolean(character.isArchived),
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      };

      const messageText = await this.messageFormatter.formatNewCharacterInfo(characterMetadata);
      const keyboard =
        await this.keyboardFormatter.createCharacterProfileKeyboard(characterMetadata);

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка списка персонажей
  async sendCharacterList(ctx: Context, characters: Character[]): Promise<void> {
    return this.withErrorHandling('отправке списка персонажей', async () => {
      // Операция отправки списка персонажей

      // Преобразуем массив Character в массив CharacterMetadata
      const characterMetadatas: CharacterMetadata[] = characters.map(character => ({
        id: character.id.toString(),
        name: character.name,
        description: character.biography || '',
        isArchived: Boolean(character.isArchived),
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      }));

      const messageText = await this.messageFormatter.formatCharacterList(characterMetadatas);
      const keyboard = this.keyboardFormatter.createCharacterListKeyboard(characterMetadatas);

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка кнопок выбора архетипа
  async sendArchetypeSelection(ctx: Context): Promise<void> {
    return this.withErrorHandling('отправке выбора архетипа', async () => {
      const messageText =
        'Выберите архетип персонажа. ИИ дополнит его биографию, внешность и другие детали автоматически.';

      const archetypes = [
        'Герой',
        'Мудрец',
        'Шут',
        'Творец',
        'Бунтарь',
        'Искатель',
        'Любовник',
        'Заботливый',
        'Правитель',
        'Маг',
        'Простодушный',
        'Славный малый',
      ];

      const keyboard = this.keyboardFormatter.createArchetypeKeyboard(archetypes);

      await ctx.reply(messageText, {
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка справочной информации
  async sendHelpMessage(ctx: Context): Promise<void> {
    return this.withErrorHandling('отправке справочной информации', async () => {
      const helpText = `
*Основные команды:*
/start - Начать взаимодействие с ботом
/help - Показать справку
/character - Управление персонажами
/create - Создать нового персонажа
/list - Показать список ваших персонажей
/settings - Настройки бота

*Управление персонажами:*
- Создавайте уникальных персонажей
- Общайтесь с ними и развивайте отношения
- Узнавайте персонажей лучше через диалоги

*Дополнительно:*
- Используйте кнопки под сообщениями для быстрых действий
- Персонажи запоминают вашу историю общения
- Персонажи могут проявлять инициативу
`;

      await ctx.reply(helpText, {
        parse_mode: 'Markdown',
      });
    });
  }

  // Отправка меню действий персонажа
  async sendCharacterActionsMenu(ctx: Context, characterId: number): Promise<void> {
    return this.withErrorHandling('отправке меню действий персонажа', async () => {
      // Получаем персонажа через CharacterManagementService
      const character = await this.characterManagementService.getCharacterWithData(
        characterId.toString(),
      );

      if (!character) {
        await ctx.reply('Персонаж не найден.');
        return;
      }

      const keyboard = this.keyboardFormatter.createCharacterActionsKeyboard(
        character.id.toString(),
      );

      await ctx.reply(`Выберите действие для персонажа ${character.name}:`, {
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }

  // Отправка подтверждения
  async sendConfirmationMessage(
    ctx: Context,
    message: string,
    action: string,
    entityId: number,
  ): Promise<void> {
    return this.withErrorHandling('отправке сообщения с подтверждением', async () => {
      const keyboard = this.keyboardFormatter.createConfirmationKeyboard(
        action,
        entityId.toString(),
      );

      await ctx.reply(message, {
        reply_markup: keyboard as InlineKeyboardMarkup,
      });
    });
  }
}
