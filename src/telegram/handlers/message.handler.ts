import { Injectable, Logger } from '@nestjs/common';
import { Context } from '../interfaces/context.interface';
import { SessionService } from '../services/session.service';
import { AccessService } from '../services/access.service';
import { MessageService } from '../services/message.service';
import { CharacterService } from '../services/character.service';
import { OpenAIService } from '../../openai/openai.service';
import { DialogService } from '../../dialog/services/dialog.service';
import { NeedsService } from '../../character/services/needs.service';
import { CharacterActionService } from '../services/character-action.service';
import { CharacterBehaviorService } from '../../character/services/character-behavior.service';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private sessionService: SessionService,
    private accessService: AccessService,
    private messageService: MessageService,
    private characterService: CharacterService,
    private openaiService: OpenAIService,
    private dialogService: DialogService,
    private needsService: NeedsService,
    private characterActionService: CharacterActionService,
    private characterBehaviorService: CharacterBehaviorService,
  ) {}

  // Обработка текстовых сообщений
  async handleMessage(ctx: Context): Promise<void> {
    try {
      const messageText = ctx.message.text;
      const currentState = this.sessionService.getState(ctx);

      // Проверяем, ожидается ли ввод ключа доступа
      if (currentState === 'waiting_for_access_key') {
        await this.handleAccessKeyInput(ctx, messageText);
        return;
      }

      // Проверяем доступ пользователя
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) {
        return;
      }

      // Обработка быстрых ответов
      if (messageText === '👥 Мои персонажи') {
        await this.characterService.showUserCharacters(ctx);
        return;
      } else if (messageText === '➕ Создать персонажа') {
        await ctx.reply(
          'Для создания персонажа используйте команду /create или нажмите на соответствующую кнопку.',
        );
        return;
      } else if (messageText === '❓ Помощь') {
        await this.messageService.sendHelpMessage(ctx);
        return;
      } else if (messageText === '⚙️ Настройки') {
        await ctx.reply('Функция настроек находится в разработке.');
        return;
      }

      // Обработка общения с персонажем
      if (currentState === 'chatting') {
        await this.handleCharacterChat(ctx, messageText);
        return;
      }

      // Если ничего не подошло, отправляем подсказку
      await ctx.reply(
        'Используйте меню или команды для взаимодействия с ботом:\n' +
          '/start - Начать работу с ботом\n' +
          '/characters - Показать ваших персонажей\n' +
          '/create - Создать нового персонажа\n' +
          '/help - Показать справку',
      );
    } catch (error) {
      this.logger.error(`Ошибка при обработке сообщения: ${error.message}`);
      await ctx.reply(
        'Произошла ошибка при обработке вашего сообщения. Попробуйте позже.',
      );
    }
  }

  // Обработка ввода ключа доступа
  private async handleAccessKeyInput(
    ctx: Context,
    keyValue: string,
  ): Promise<void> {
    try {
      await this.accessService.validateAccessKey(ctx, keyValue);
    } catch (error) {
      this.logger.error(`Ошибка при валидации ключа: ${error.message}`);
      await ctx.reply('Произошла ошибка при проверке ключа. Попробуйте позже.');
    }
  }

  // Обработка общения с персонажем
  private async handleCharacterChat(
    ctx: Context,
    userMessage: string,
  ): Promise<void> {
    try {
      // Получаем ID активного персонажа из сессии
      const characterId = ctx.session.data.activeCharacterId;
      const userId = ctx.from.id;

      if (!characterId) {
        await ctx.reply(
          'Ошибка: персонаж не выбран. Пожалуйста, выберите персонажа снова.',
        );
        this.sessionService.clearSessionForUser(ctx);
        return;
      }

      // Проверяем специальные команды
      if (userMessage === '/stop' || userMessage === '🏁 Завершить общение') {
        await ctx.reply('Общение с персонажем завершено.');
        await this.messageService.sendMainMenu(ctx);
        this.sessionService.updateSessionData(ctx, { activeCharacterId: null });
        this.sessionService.transitionToState(ctx, 'main');
        // Удаляем активный разговор
        this.characterActionService.removeActiveConversation(userId);
        return;
      }

      if (userMessage === '📊 Статус персонажа') {
        const character =
          await this.characterService.getCharacterById(characterId);
        await this.messageService.sendCharacterStatus(ctx, character);
        return;
      }

      // Регистрируем активный разговор (если еще не зарегистрирован)
      this.characterActionService.registerActiveConversation(
        userId,
        characterId,
      );

      // Проверяем, может ли персонаж ответить (учитывая его текущее действие)
      // и обрабатываем сообщение с учетом контекста действия
      const wasHandled =
        await this.characterActionService.handleMessageWithActionContext(
          ctx,
          userId,
          characterId,
          userMessage,
        );

      // Если сообщение было обработано с учетом действия, прекращаем дальнейшую обработку
      if (wasHandled) {
        return;
      }

      // Получаем данные персонажа
      const character =
        await this.characterService.getCharacterById(characterId);

      if (!character) {
        await ctx.reply(
          'Ошибка: персонаж не найден. Пожалуйста, выберите персонажа снова.',
        );
        this.sessionService.clearSessionForUser(ctx);
        return;
      }

      // Сохраняем сообщение пользователя в диалог
      const telegramId = ctx.from.id.toString();
      const dialogMessage = await this.dialogService.saveUserMessage(
        telegramId,
        characterId,
        userMessage,
      );

      // Обрабатываем сообщение пользователя через CharacterBehaviorService
      // Это обновит потребности, сохранит сообщение в памяти и изменит действие при необходимости
      await this.characterBehaviorService.processUserMessage(
        characterId,
        userMessage,
      );

      // Получаем контекст поведения персонажа для генерации ответа
      const behaviorContext =
        await this.characterBehaviorService.getBehaviorContextForResponse(
          characterId,
        );

      // Генерируем ответ персонажа с учетом контекста поведения
      const characterResponse = await this.generateCharacterResponse(
        character,
        userMessage,
        dialogMessage.id,
        behaviorContext.emotionalState,
        behaviorContext.motivations,
        behaviorContext.currentAction
          ? `${behaviorContext.currentAction.description}`
          : '',
      );

      // Отправляем ответ персонажа
      await ctx.reply(characterResponse);
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке сообщения в чате: ${error.message}`,
      );
      await ctx.reply(
        'Произошла ошибка при обработке сообщения. Попробуйте позже.',
      );
    }
  }

  // Генерация ответа персонажа с учетом эмоционального состояния и мотиваций
  private async generateCharacterResponse(
    character: any,
    userMessage: string,
    userMessageId: number,
    emotionalState: any,
    motivations: any[],
    actionContext: string,
  ): Promise<string> {
    try {
      // Получаем историю диалога с пользователем в формате для нейросети
      const telegramId = String(character.userId || '');
      const formattedHistory =
        await this.dialogService.getFormattedDialogHistoryForAI(
          telegramId,
          character.id,
          20,
        );

      // Формируем строку с эмоциональным состоянием
      let emotionalStateText = '';
      if (emotionalState) {
        emotionalStateText = `Твое текущее эмоциональное состояние: ${emotionalState.description || 'нейтральное'}. 
        Основная эмоция: ${emotionalState.primary || 'нейтральность'}, 
        интенсивность: ${emotionalState.intensity || '0'}%.`;
      }

      // Формируем строку с потребностями и мотивациями
      let motivationsText = '';
      if (motivations && motivations.length > 0) {
        motivationsText =
          'Твои текущие мотивации:\n' +
          motivations
            .slice(0, 3)
            .map(
              (m) =>
                `- ${m.needType}: ${m.actionImpulse} (приоритет: ${m.priority})`,
            )
            .join('\n');
      }

      // Составляем системный промпт для OpenAI
      const systemPrompt = `
      Ты играешь роль персонажа по имени ${character.name}. 
      ${character.personality ? `Твоя личность: ${character.personality}` : ''}
      ${character.biography ? `Твоя биография: ${character.biography}` : ''}
      ${character.appearance ? `Твоя внешность: ${character.appearance}` : ''}
      Архетип: ${character.archetype}

      ${emotionalStateText}
      
      ${motivationsText}
      
      ${actionContext ? `Контекст действия: ${actionContext}` : ''}

      Отвечай от лица персонажа, учитывая его эмоциональное состояние, мотивации и текущие действия.`;

      // Получаем ответ от OpenAI
      const response = await this.openaiService.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...formattedHistory,
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      // Получаем текст ответа
      const responseText = response.choices[0].message.content;

      // Сохраняем ответ в диалог
      await this.dialogService.saveCharacterMessage(
        userMessageId,
        responseText,
      );

      return responseText;
    } catch (error) {
      this.logger.error(
        `Ошибка при генерации ответа персонажа: ${error.message}`,
      );
      return 'Извини, я не могу сейчас ответить. Что-то мешает моим мыслям...';
    }
  }
}
