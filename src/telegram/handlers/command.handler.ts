import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { Context } from '../interfaces/context.interface';
import { TelegramInitializationService } from '../services/telegram-initialization.service';
import { MessageService } from '../services/message.service';
import { UserService } from '../../user/services/user.service';
import { ConfigService } from '@nestjs/config';
import { ActionExecutorService } from '../../character/services/action/action-executor.service';
import { CharacterBehaviorService } from '../../character/services/behavior/character-behavior.service';
import { DialogService } from '../../dialog/services/dialog.service';
import { CharacterManagementService } from '../../character/services/core/character-management.service';
import { CharacterService } from '../../character/services/core/character.service';
import { AccessControlService } from '../services/access-control.service';
import { CharacterCreationService } from '../services/character-creation.service';
import { CharacterNeedType } from '../../character/enums/character-need-type.enum';
import { BaseService } from '../../common/base/base.service';
import { getErrorMessage } from '../../common/utils/error.utils';

// Утилиты для работы с callback data
function getCallbackData(callbackQuery: unknown): string | undefined {
  if (
    callbackQuery &&
    typeof callbackQuery === 'object' &&
    callbackQuery !== null &&
    'data' in callbackQuery &&
    typeof (callbackQuery as { data: unknown }).data === 'string'
  ) {
    return (callbackQuery as { data: string }).data;
  }
  return undefined;
}

@Injectable()
export class CommandHandler extends BaseService {
  private readonly adminUsers: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramInitializationService: TelegramInitializationService,
    private readonly userService: UserService,
    logService: LogService,
    private readonly messageService: MessageService,
    private readonly actionExecutorService: ActionExecutorService,
    private readonly characterBehaviorService: CharacterBehaviorService,
    private readonly characterManagementService: CharacterManagementService,
    private readonly characterService: CharacterService,
    private readonly dialogService: DialogService,
    private readonly accessControlService: AccessControlService,
    private readonly characterCreationService: CharacterCreationService,
  ) {
    super(logService);

    // Получаем список ID администраторов из конфигурации
    const adminIds = this.configService.get<string>('ADMIN_TELEGRAM_IDS', '');
    this.adminUsers = adminIds.split(',').map(id => id.trim());
  }

  // Обработка команды /start
  async handleStart(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке команды /start', async () => {
      // Проверяем доступ пользователя
      const userId = ctx.from?.id;
      if (!userId || !this.accessControlService.hasAccess(userId)) {
        await ctx.reply('У вас нет доступа к этому боту.');
        return;
      }

      // Устанавливаем начальное состояние
      if (ctx.from?.id && ctx.session) {
        ctx.session.state = 'initial';
      }

      // Отправляем приветственное сообщение
      await this.messageService.sendMainMenu(ctx);
    });
  }

  // Обработка команды /help
  async handleHelp(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке команды /help', async () => {
      // Проверяем доступ пользователя
      const userId = ctx.from?.id;
      if (!userId || !this.accessControlService.hasAccess(userId)) {
        await ctx.reply('У вас нет доступа к этому боту.');
        return;
      }

      await this.messageService.sendHelpMessage(ctx);
    });
  }

  /**
   * Обработка команды /characters
   */
  async handleCharacters(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке команды /characters', async () => {
      // Получаем ID пользователя и проверяем доступ
      const userId = ctx.from?.id;
      if (!userId || !this.accessControlService.hasAccess(userId)) {
        await ctx.reply('У вас нет доступа к этому боту.');
        return;
      }
      if (!userId) {
        await ctx.reply('Не удалось определить ID пользователя.');
        return;
      }

      // Получаем персонажей пользователя напрямую через CharacterService
      const characters = await this.characterService.findByUserId(String(userId));

      if (!characters || characters.length === 0) {
        // Создаем простую клавиатуру для начала теста
        const testStartKeyboard = {
          inline_keyboard: [[{ text: 'Создать персонажа', callback_data: 'create_character' }]],
        };

        await ctx.reply('У вас пока нет персонажей. Вы можете создать персонажа.', {
          reply_markup: testStartKeyboard,
        });
        return;
      }

      // Создаем клавиатуру со списком персонажей
      const characterListKeyboard = {
        inline_keyboard: characters.map(character => {
          return [
            {
              text: character.name,
              callback_data: `info_${character.id}`,
            },
          ];
        }),
      };

      await ctx.reply('Ваши персонажи:', { reply_markup: characterListKeyboard });
    });
  }

  /**
   * Обработка команды /create
   */
  async handleCreate(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке команды /create', async () => {
      // Проверяем доступ пользователя
      const userId = ctx.from?.id;
      if (!userId || !this.accessControlService.hasAccess(userId)) {
        await ctx.reply('У вас нет доступа к этому боту.');
        return;
      }

      // Показываем список архетипов для выбора
      await this.messageService.sendArchetypeSelection(ctx);
    });
  }

  // Обработка команд администратора
  async handleAdminCommand(ctx: Context, command: string): Promise<void> {
    return this.withErrorHandling('обработке админ команды', async () => {
      // Проверяем, является ли пользователь администратором
      const telegramId = ctx.from?.id.toString() || '';
      if (!this.adminUsers.includes(telegramId)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Обрабатываем различные админ-команды
      const parts = command.split(' ');
      const action = parts[0];

      switch (action) {
        case '/generate_key': {
          // Заглушка для генерации ключа
          const fakeKey = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await ctx.reply(
            `✅ Ключ доступа создан:\n\nКлюч: ${fakeKey}\nЛимит использований: неограничен\nСрок действия: не ограничен`,
          );
          break;
        }

        case '/list_keys': {
          await ctx.reply('Ключи доступа не найдены.');
          break;
        }

        case '/deactivate_key': {
          const keyToDeactivate = parts[1];

          if (!keyToDeactivate) {
            await ctx.reply('Укажите ключ для деактивации.');
            return;
          }

          await ctx.reply(`✅ Ключ ${keyToDeactivate} деактивирован.`);
          break;
        }

        default:
          await ctx.reply('Неизвестная команда администратора.');
      }
    });
  }

  // Обработка кнопок и коллбэков
  async handleCallback(ctx: Context, callbackData: string): Promise<void> {
    return this.withErrorHandling('обработке коллбэка', async () => {
      // Удаляем данные запроса коллбэка
      await ctx.answerCbQuery();

      // Обрабатываем различные типы коллбэков
      if (callbackData === 'start_test' || callbackData === 'create_character') {
        // Показываем список архетипов для выбора
        await this.messageService.sendArchetypeSelection(ctx);
      } else if (callbackData.startsWith('test_answer_')) {
        // Простая обработка ответа на тест - показываем архетипы
        await this.messageService.sendArchetypeSelection(ctx);
      } else if (callbackData === 'show_archetypes') {
        // Показываем список архетипов для выбора
        await this.messageService.sendArchetypeSelection(ctx);
      } else if (callbackData.startsWith('archetype_')) {
        // Создаем персонажа выбранного архетипа
        const archetype = callbackData.replace('archetype_', '');
        await this.createCharacterWithArchetype(ctx, archetype);
      } else if (callbackData.startsWith('info_')) {
        // Показываем информацию о персонаже
        const characterId = parseInt(callbackData.replace('info_', ''));
        await this.handleCharacterInfo(ctx, characterId);
      } else if (callbackData.startsWith('chat_with_')) {
        // Начинаем общение с персонажем
        const characterId = parseInt(callbackData.replace('chat_with_', ''));
        await this.startChatWithCharacter(ctx, characterId);
      } else if (callbackData === 'show_characters') {
        // Показываем список персонажей
        await this.handleShowCharacters(ctx);
      }
    });
  }

  /**
   * Обрабатывает callback с информацией о персонаже
   */
  private async handleCharacterInfo(ctx: Context, characterId: number): Promise<void> {
    return this.withErrorHandling('обработке информации о персонаже', async () => {
      // Получаем персонажа через CharacterService
      const character = await this.characterService.findOne(characterId);

      if (!character) {
        await ctx.reply(`Персонаж не найден.`);
        return;
      }

      // Формируем информацию о персонаже
      const characterInfo = `
Имя: ${character.name}
Архетип: ${character.archetype || 'Не указан'}
Настроение: ${character.energy || 50}/100
      `;

      // Создаем простую клавиатуру для персонажа
      const characterInfoKeyboard = {
        inline_keyboard: [
          [{ text: 'Чат', callback_data: `chat_with_${characterId}` }],
          [{ text: 'Назад', callback_data: 'show_characters' }],
        ],
      };

      // Отправляем информацию о персонаже
      await ctx.reply(characterInfo, {
        reply_markup: characterInfoKeyboard,
      });
    });
  }

  /**
   * Обрабатывает callback для показа списка персонажей
   */
  private async handleShowCharacters(ctx: Context): Promise<void> {
    return this.handleCharacters(ctx);
  }

  /**
   * Создает персонажа с указанным архетипом
   */
  private async createCharacterWithArchetype(ctx: Context, archetype: string): Promise<void> {
    return this.withErrorHandling('создании персонажа с архетипом', async () => {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply('Не удалось определить ID пользователя.');
        return;
      }

      try {
        // Используем новый специализированный сервис
        const character = await this.characterCreationService.createCharacterWithArchetype(
          archetype,
          Number(userId),
        );

        // Создаем клавиатуру для персонажа
        const characterInfoKeyboard = {
          inline_keyboard: [
            [
              { text: 'Информация', callback_data: `info_${(character as { id: number }).id}` },
              { text: 'Чат', callback_data: `chat_with_${(character as { id: number }).id}` },
            ],
            [{ text: 'Назад', callback_data: 'show_characters' }],
          ],
        };

        await ctx.reply(
          `✅ Персонаж '${(character as { name: string }).name}' успешно создан!\n\nТеперь вы можете общаться с ним.`,
          {
            reply_markup: characterInfoKeyboard,
          },
        );
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await ctx.reply(`Ошибка создания персонажа: ${errorMessage}`);
      }
    });
  }

  /**
   * Запускает чат с указанным персонажем
   */
  private async startChatWithCharacter(ctx: Context, characterId: number): Promise<void> {
    return this.withErrorHandling('начале чата с персонажем', async () => {
      // Получаем информацию о персонаже
      const character = await this.characterService.findOne(characterId);
      if (!character) {
        await ctx.reply('Персонаж не найден.');
        return;
      }

      // Проверяем, принадлежит ли персонаж этому пользователю
      if (
        ctx.from?.id &&
        character.userId !== undefined &&
        character.userId !== ctx.from.id.toString()
      ) {
        await ctx.reply('У вас нет доступа к этому персонажу.');
        return;
      }

      // Сохраняем состояние сессии напрямую
      const currentSession = ctx.session as { state?: string; characterId?: number } | undefined;
      (ctx as { session: unknown }).session = {
        ...currentSession,
        state: 'chat',
        characterId: characterId,
      };

      // Создаем клавиатуру для чата
      const chatKeyboard = {
        inline_keyboard: [
          [{ text: 'Назад к списку персонажей', callback_data: 'show_characters' }],
        ],
      };

      // Отправляем приветственное сообщение от персонажа
      const greeting = `Привет! Я ${character.name}. Чем я могу помочь?`;

      await ctx.reply(
        `Вы начали общение с персонажем ${character.name}. Напишите сообщение, чтобы продолжить.`,
      );

      await ctx.reply(greeting, {
        reply_markup: chatKeyboard,
      });
    });
  }

  /**
   * Обработка команды /actions
   */
  async handleActionsCommand(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке команды /actions', async () => {
      // Простая проверка доступа
      const hasAccess = true;
      if (!hasAccess) return;

      // Получаем активного персонажа из сессии
      const sessionData = ctx.session?.data as { activeCharacterId?: number } | undefined;
      const characterId = sessionData?.activeCharacterId;
      if (!characterId) {
        await ctx.reply(
          'Для управления действиями, сначала выберите персонажа с помощью команды /characters',
        );
        return;
      }

      // Получаем данные о персонаже
      const character = await this.characterService.findOne(characterId);
      if (!character) {
        await ctx.reply('Ошибка: персонаж не найден');
        return;
      }

      // Получаем информацию о текущем действии персонажа
      const isPerformingAction = this.actionExecutorService.isPerformingAction(
        characterId.toString(),
      );
      const currentAction = this.actionExecutorService.getCurrentAction(characterId.toString());

      let actionText = '';
      let keyboard:
        | {
            reply_markup?: {
              inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
            };
          }
        | undefined;

      if (isPerformingAction && currentAction) {
        // Персонаж выполняет действие
        const startTime = new Date(currentAction.startTime).toLocaleTimeString();
        const endTimeText = currentAction.endTime
          ? `до ${new Date(currentAction.endTime).toLocaleTimeString()}`
          : 'без ограничения по времени';

        actionText = `
*${character.name} сейчас:* ${currentAction.description}
*Начало:* ${startTime}
*Продолжительность:* ${endTimeText}
*Статус:* ${currentAction.status === 'in_progress' ? 'В процессе' : currentAction.status}

${currentAction.content || ''}`;

        // Создаем простую клавиатуру для управления действием
        keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Остановить действие', callback_data: `stop_action:${characterId}` }],
            ],
          },
        };
      } else {
        // Персонаж не выполняет действие
        actionText = `*${character.name}* в данный момент ничем не занят.
          
Вы можете предложить персонажу действие:`;

        // Создаем простую клавиатуру с возможными действиями
        keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Отдых', callback_data: `suggest_action:${characterId}:rest` },
                { text: 'Творчество', callback_data: `suggest_action:${characterId}:create` },
              ],
              [
                { text: 'Обучение', callback_data: `suggest_action:${characterId}:study` },
                { text: 'Общение', callback_data: `suggest_action:${characterId}:socialize` },
              ],
            ],
          },
        };
      }

      // Отправляем сообщение с информацией о действии и клавиатурой
      const replyOptions: {
        parse_mode: 'Markdown';
        reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
      } = {
        parse_mode: 'Markdown',
      };

      if (keyboard?.reply_markup) {
        replyOptions.reply_markup = keyboard.reply_markup;
      }

      await ctx.reply(actionText, replyOptions);
    });
  }

  /**
   * Обработка callback-запросов для действий персонажа
   */
  async handleActionCallbacks(ctx: Context): Promise<void> {
    return this.withErrorHandling('обработке callback-запроса', async () => {
      // Безопасно получаем данные коллбэка
      const callbackData = getCallbackData(ctx.callbackQuery);
      if (!callbackData) {
        this.logWarning('Получен callback-запрос без свойства data');
        return;
      }

      // Обрабатываем остановку действия
      if (callbackData.startsWith('stop_action:')) {
        const characterId = callbackData.split(':')[1];
        await this.actionExecutorService.stopCurrentAction(characterId);
        await ctx.editMessageText('Действие прервано пользователем');
        return;
      }

      // Обрабатываем предложение действия
      if (callbackData.startsWith('suggest_action:')) {
        const parts = callbackData.split(':');
        const characterId = parseInt(parts[1]);
        const actionType = parts[2];

        // Получаем мотивации через CharacterBehaviorService
        const behaviorContext =
          await this.characterBehaviorService.getBehaviorContextForResponse(characterId);
        const motivations = behaviorContext.motivations;

        // Создаем искусственную мотивацию для предложенного действия
        const suggestedMotivation = {
          characterId: characterId,
          needType: CharacterNeedType.USER_COMMAND,
          intensity: 10, // Максимальная интенсивность
          status: 'active',
          threshold: 0,
          actionImpulse: `Выполнить действие ${actionType}, предложенное пользователем`,
        };

        // Добавляем предложенную мотивацию в начало списка
        const updatedMotivations = [suggestedMotivation, ...motivations];

        // Получаем полные данные персонажа
        const character = await this.characterService.findOne(characterId);
        if (!character) {
          await ctx.editMessageText('Персонаж не найден');
          return;
        }

        // Инициируем действие
        const action = await this.actionExecutorService.determineAndPerformAction(character, {
          characterId: characterId,
          userId: Number(ctx.from?.id),
          triggerType: 'user_suggestion',
          triggerData: { actionType },
          timestamp: new Date(),
          motivations: updatedMotivations,
          needsExpression: 'Выполнить предложенное пользователем действие',
          emotionalResponse: 'Готовность выполнить запрос пользователя',
          messagePrompt: `Выполнить действие ${actionType}`,
        });

        if (action) {
          await ctx.editMessageText(`${action.description} - действие начато!`);
        } else {
          await ctx.editMessageText('Не удалось начать действие. Пожалуйста, попробуйте позже.');
        }
        return;
      }

      // Отвечаем на callback-запрос
      await ctx.answerCbQuery();
    });
  }
}
