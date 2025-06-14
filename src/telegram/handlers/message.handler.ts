import { Injectable } from '@nestjs/common';
import { Context } from '../interfaces/context.interface';
import { MessageService } from '../services/message.service';
import { NeedsService } from '../../character/services/needs.service';
import { CharacterBehaviorService } from '../../character/services/character-behavior.service';
import { ActionService } from '../../character/services/action.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { ModuleRef } from '@nestjs/core';
import { LogService } from '../../logging/log.service';

import { MessageFormatterService } from '../services/message-formatter.service';
import { DialogService } from '../../dialog/services/dialog.service';
import { CharacterService } from '../../character/services/character.service';
import { AccessControlService } from '../services/access-control.service';
import { ConfigService } from '@nestjs/config';
import { MessageProcessingCoordinator } from '../../character/services/message-processing-coordinator.service';

@Injectable()
export class MessageHandler {
  constructor(
    private messageService: MessageService,
    private dialogService: DialogService,
    private characterService: CharacterService,
    private needsService: NeedsService,
    private characterBehaviorService: CharacterBehaviorService,
    private actionService: ActionService,
    @InjectRepository(Dialog)
    private dialogRepository: Repository<Dialog>,
    private moduleRef: ModuleRef,
    private readonly messageFormatterService: MessageFormatterService,
    private readonly accessControlService: AccessControlService,
    private readonly configService: ConfigService,
    private readonly messageProcessingCoordinator: MessageProcessingCoordinator,
    private readonly logService: LogService,
  ) {}

  /**
   * Обработчик завершения общения с персонажем
   */
  private async handleStopChatting(ctx: Context): Promise<void> {
    if (!ctx.from?.id) return;

    await ctx.reply('Общение с персонажем завершено.');
    await this.messageService.sendMainMenu(ctx);
    // Простая заглушка для state machine - сбрасываем состояние в сессии
    if (ctx.session) {
      ctx.session.state = 'initial';
    }
    // Удаляем активный разговор
    await this.removeActiveConversation(ctx.from.id);
  }

  /**
   * Обработчик запроса статуса персонажа
   */
  private async handleCharacterStatus(ctx: Context): Promise<void> {
    if (!ctx.from?.id) return;

    // Простая заглушка для получения characterId из сессии
    const characterId = ctx.session?.activeCharacterId;

    if (!characterId) {
      await ctx.reply('Ошибка: персонаж не выбран.');
      return;
    }

    // Получаем персонажа и его потребности
    const character = await this.characterService.findOne(characterId);
    if (!character) {
      await ctx.reply('Ошибка: персонаж не найден.');
      return;
    }

    // Отправляем статус персонажа
    await this.messageService.sendCharacterStatus(ctx, character);
  }

  /**
   * Регистрирует активный разговор между пользователем и персонажем
   */
  public async registerActiveConversation(userId: number, characterId: number): Promise<void> {
    const telegramId = userId.toString();

    // Проверяем, существует ли диалог
    let dialog = await this.dialogRepository.findOne({
      where: {
        telegramId,
        characterId,
      },
    });

    if (!dialog) {
      // Создаем новый диалог если не существует
      dialog = await this.dialogService.getOrCreateDialog(telegramId, characterId);
    }

    // Обновляем статус активности диалога
    dialog.isActive = true;
    dialog.lastInteractionDate = new Date();
    await this.dialogRepository.save(dialog);

    // Уведомляем ActionService о связи персонажа с чатом
    this.actionService.updateChatState(characterId.toString(), userId.toString(), true);

    this.logService.log(
      `Активирован диалог #${dialog.id} между пользователем ${userId} и персонажем ${characterId}`,
    );
  }

  /**
   * Удаляет активный разговор
   */
  public async removeActiveConversation(userId: number): Promise<void> {
    return withErrorHandling(
      async () => {
        const telegramId = userId.toString();

        // Получаем все активные диалоги пользователя
        const dialogs = await this.dialogRepository.find({
          where: {
            telegramId,
            isActive: true,
          },
        });

        for (const dialog of dialogs) {
          // Обновляем статус активности диалога
          dialog.isActive = false;
          await this.dialogRepository.save(dialog);

          // Уведомляем ActionService об отключении связи персонажа с чатом
          this.actionService.updateChatState(
            dialog.characterId.toString(),
            userId.toString(),
            false,
          );

          this.logService.log(
            `Деактивирован диалог #${dialog.id} между пользователем ${userId} и персонажем ${dialog.characterId}`,
          );
        }
      },
      'удалении активного разговора',
      this.logService,
      { userId },
    );
  }

  // Обработка текстовых сообщений
  async handleMessage(ctx: Context): Promise<void> {
    return await withErrorHandling(
      async () => {
        // Проверяем, что ctx.message существует и имеет свойство text
        if (!ctx.message || !('text' in ctx.message)) {
          return;
        }

        const messageText = ctx.message.text;

        // Если это команда, пропускаем (команды обрабатываются отдельно)
        if (messageText.startsWith('/')) {
          return;
        }

        // Определяем текущее состояние
        const userId = ctx.from?.id;
        if (!userId) {
          return;
        }

        // Простая проверка состояния из сессии
        const currentState = ctx.session?.state || 'initial';

        // Проверяем, ожидается ли ввод ключа доступа
        if (currentState === 'waiting_for_access_key') {
          await this.handleAccessKeyInput(ctx, messageText);
          return;
        }

        // Проверяем доступ пользователя
        if (!this.accessControlService.hasAccess(userId)) {
          await ctx.reply('У вас нет доступа к этой функции.');
          return;
        }

        // Обрабатываем как сообщение персонажу
        await this.handleCharacterChat(ctx);
      },
      'обработке сообщения',
      this.logService,
      { userId: ctx.from?.id },
    );
  }

  // Обработка ввода ключа доступа
  private async handleAccessKeyInput(ctx: Context, keyValue: string): Promise<void> {
    try {
      // Получаем ключ доступа из конфигурации
      const validKey = this.configService.get<string>('telegram.accessKey', 'access123');
      if (keyValue === validKey) {
        if (ctx.session) {
          ctx.session.state = 'authenticated';
        }
        await ctx.reply('Доступ предоставлен!');
      } else {
        await ctx.reply('Неверный ключ доступа. Попробуйте еще раз.');
      }
    } catch (error) {
      this.logService.error('Ошибка при валидации ключа', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Обработка общения с персонажем
  private async handleCharacterChat(ctx: Context): Promise<void> {
    try {
      // Проверяем наличие необходимых данных в контексте
      if (!ctx.from?.id || !ctx.message || !('text' in ctx.message)) {
        this.logService.warn('Недостаточно данных в контексте сообщения');
        return;
      }

      const userId = ctx.from.id;
      const userMessage = ctx.message.text;

      // Получаем активного персонажа из сессии
      const characterId = ctx.session?.activeCharacterId;

      if (!characterId) {
        await ctx.reply('Ошибка: персонаж не выбран. Пожалуйста, выберите персонажа снова.');
        if (ctx.session) {
          ctx.session.state = 'initial';
        }
        return;
      }

      // Получаем персонажа
      const character = await this.characterService.findOne(characterId);
      if (!character) {
        await ctx.reply('Ошибка: персонаж не найден.');
        return;
      }

      // Получаем или создаем диалог
      let dialog = await this.dialogRepository.findOne({
        where: {
          telegramId: userId.toString(),
          characterId,
        },
      });

      if (!dialog) {
        // Создаем новый диалог если не существует
        dialog = this.dialogRepository.create({
          telegramId: userId.toString(),
          characterId,
          isActive: true,
          lastInteractionDate: new Date(),
        });
        dialog = await this.dialogRepository.save(dialog);
      }

      // Получаем историю диалога для контекста
      const recentMessages = await this.dialogService.getDialogHistory(
        userId.toString(),
        character.id,
        5,
      );
      const messageTexts = recentMessages.map(msg => msg.content);

      // Отправляем уведомление о печати
      await ctx.sendChatAction('typing');

      // ЦЕНТРАЛИЗОВАННАЯ ОБРАБОТКА ЧЕРЕЗ КООРДИНАТОР
      const result = await this.messageProcessingCoordinator.processUserMessage(
        character,
        userId,
        userMessage,
        messageTexts,
      );

      // Сохраняем сообщение пользователя
      const userMessageRecord = await this.dialogService.saveUserMessage(
        userId.toString(),
        character.id,
        userMessage,
      );

      // Сохраняем ответ персонажа
      await this.dialogService.saveCharacterMessage(userMessageRecord.id, result.response);

      // Отправляем ответ персонажа пользователю
      await ctx.reply(result.response);
    } catch (error) {
      this.logService.error('Ошибка обработки текстового сообщения', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.from?.id,
        text: 'text' in ctx.message ? ctx.message.text : 'no-text',
      });
    }
  }

  async handleHelpMessage(ctx: Context): Promise<void> {
    const helpMessage = await this.messageFormatterService.formatHelpMessage();
    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  async sendNoActiveCharacterMessage(ctx: Context): Promise<void> {
    await ctx.reply(
      this.messageFormatterService.formatInfo(
        'У вас нет активного персонажа. Выберите персонажа из списка или создайте нового.',
        'Нет активного персонажа',
      ),
      { parse_mode: 'Markdown' },
    );
  }

  async handleSendErrorMessage(ctx: Context, error: Error): Promise<void> {
    this.logService.error('Отправка сообщения об ошибке пользователю', {
      error: error.message,
      userId: ctx.from?.id,
    });

    await ctx.reply(
      this.messageFormatterService.formatError(
        'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.',
        'Ошибка',
      ),
      { parse_mode: 'Markdown' },
    );
  }
}
