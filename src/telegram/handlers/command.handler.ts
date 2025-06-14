import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';
import { SessionService } from '../services/session.service';
import { AccessService } from '../services/access.service';
import { MessageService } from '../services/message.service';
import { PsychologicalTestService } from '../services/psychological-test.service';
import { CharacterService } from '../services/character.service';
import { ConfigService } from '@nestjs/config';
import { CharacterActionService } from '../services/character-action.service';
import { CharacterBehaviorService } from '../../character/services/character-behavior.service';

@Injectable()
export class CommandHandler {
  private readonly adminUsers: string[];
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private configService: ConfigService,
    private sessionService: SessionService,
    private accessService: AccessService,
    private messageService: MessageService,
    private psychologicalTestService: PsychologicalTestService,
    private characterService: CharacterService,
    private characterActionService: CharacterActionService,
    private characterBehaviorService: CharacterBehaviorService,
  ) {
    // Получаем список ID администраторов из конфигурации
    const adminIds = this.configService.get<string>('ADMIN_TELEGRAM_IDS', '');
    this.adminUsers = adminIds.split(',').map(id => id.trim());
  }

  // Обработка команды /start
  async handleStart(ctx: Context): Promise<void> {
    try {
      // Проверяем доступ
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) {
        return;
      }

      // Устанавливаем начальное состояние
      this.sessionService.setInitialState(ctx);

      // Отправляем приветственное сообщение
      await this.messageService.sendMainMenu(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /start: ${error.message}`);
      await ctx.reply('Произошла ошибка при запуске бота. Попробуйте позже.');
    }
  }

  // Обработка команды /help
  async handleHelp(ctx: Context): Promise<void> {
    try {
      // Проверяем доступ
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) {
        return;
      }

      await this.messageService.sendHelpMessage(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /help: ${error.message}`);
      await ctx.reply('Произошла ошибка при отображении справки. Попробуйте позже.');
    }
  }

  // Обработка команды /characters
  async handleCharacters(ctx: Context): Promise<void> {
    try {
      // Проверяем доступ
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) {
        return;
      }

      await this.characterService.showUserCharacters(ctx);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /characters: ${error.message}`);
      await ctx.reply('Произошла ошибка при загрузке персонажей. Попробуйте позже.');
    }
  }

  // Обработка команды /create
  async handleCreate(ctx: Context): Promise<void> {
    try {
      // Проверяем доступ
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) {
        return;
      }

      // Предлагаем пройти психологический тест
      await ctx.reply(
        'Для создания персонажа, который вам подойдет, предлагаем пройти короткий психологический тест. Он поможет нам подобрать наиболее подходящий архетип.',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Пройти тест', 'start_test'),
            Markup.button.callback('⏩ Пропустить', 'show_archetypes'),
          ],
        ]),
      );
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /create: ${error.message}`);
      await ctx.reply('Произошла ошибка при создании персонажа. Попробуйте позже.');
    }
  }

  // Обработка команд администратора
  async handleAdminCommand(ctx: Context, command: string): Promise<void> {
    try {
      // Проверяем, является ли пользователь администратором
      const telegramId = ctx.from.id.toString();
      if (!this.adminUsers.includes(telegramId)) {
        await ctx.reply('У вас нет прав для выполнения этой команды.');
        return;
      }

      // Обрабатываем различные админ-команды
      const parts = command.split(' ');
      const action = parts[0];

      switch (action) {
        case '/generate_key':
          // Пример: /generate_key 3 7 (лимит использований: 3, срок действия: 7 дней)
          const usageLimit = parts[1] ? parseInt(parts[1]) : null;
          const expiryDays = parts[2] ? parseInt(parts[2]) : null;

          const key = await this.accessService.generateAccessKey(usageLimit, expiryDays);

          await ctx.reply(
            `✅ Ключ доступа создан:\n\nКлюч: ${key.value}\nЛимит использований: ${
              key.usageLimit !== null ? key.usageLimit : 'неограничен'
            }\nСрок действия: ${
              key.expiryDate ? key.expiryDate.toLocaleDateString() : 'не ограничен'
            }`,
          );
          break;

        case '/list_keys':
          const keys = await this.accessService.getAllKeys();

          if (keys.length === 0) {
            await ctx.reply('Ключи доступа не найдены.');
            return;
          }

          const keysList = keys
            .map(
              k =>
                `🔑 ${k.value} | Использований: ${k.usageCount}/${
                  k.usageLimit !== null ? k.usageLimit : '∞'
                } | Активен: ${k.isActive ? '✅' : '❌'} | Срок: ${
                  k.expiryDate ? k.expiryDate.toLocaleDateString() : '∞'
                }`,
            )
            .join('\n\n');

          await ctx.reply(`Список ключей доступа:\n\n${keysList}`);
          break;

        case '/deactivate_key':
          const keyToDeactivate = parts[1];

          if (!keyToDeactivate) {
            await ctx.reply('Укажите ключ для деактивации.');
            return;
          }

          const deactivated = await this.accessService.deactivateAccessKey(keyToDeactivate);

          if (deactivated) {
            await ctx.reply(`✅ Ключ ${keyToDeactivate} деактивирован.`);
          } else {
            await ctx.reply(`❌ Ключ ${keyToDeactivate} не найден.`);
          }
          break;

        default:
          await ctx.reply('Неизвестная команда администратора.');
      }
    } catch (error) {
      this.logger.error(`Ошибка при обработке админ-команды: ${error.message}`);
      await ctx.reply('Произошла ошибка при выполнении команды администратора.');
    }
  }

  // Обработка кнопок и коллбэков
  async handleCallback(ctx: Context, callbackData: string): Promise<void> {
    try {
      // Проверяем доступ (для некоторых коллбэков это не требуется)
      if (!callbackData.startsWith('test_answer_')) {
        const hasAccess = await this.accessService.checkAccess(ctx);
        if (!hasAccess) {
          return;
        }
      }

      // Удаляем данные запроса коллбэка
      await ctx.answerCbQuery();

      // Обрабатываем различные типы коллбэков
      if (callbackData === 'start_test') {
        // Запускаем психологический тест
        await this.psychologicalTestService.startTest(ctx);
      } else if (callbackData.startsWith('test_answer_')) {
        // Обрабатываем ответ на вопрос теста
        const value = callbackData.replace('test_answer_', '');
        await this.psychologicalTestService.handleAnswer(ctx, value);
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
        await this.characterService.showCharacterInfo(ctx, characterId);
      } else if (callbackData.startsWith('chat_with_')) {
        // Начинаем общение с персонажем
        const characterId = parseInt(callbackData.replace('chat_with_', ''));
        await this.startChatWithCharacter(ctx, characterId);
      } else if (callbackData === 'show_characters') {
        // Показываем список персонажей
        await this.characterService.showUserCharacters(ctx);
      } else if (callbackData === 'create_character') {
        // Запускаем процесс создания персонажа
        await this.handleCreate(ctx);
      }
    } catch (error) {
      this.logger.error(`Ошибка при обработке коллбэка: ${error.message}`);
      await ctx.reply('Произошла ошибка при обработке действия. Попробуйте позже.');
    }
  }

  // Создание персонажа с выбранным архетипом
  private async createCharacterWithArchetype(ctx: Context, archetype: string): Promise<void> {
    try {
      await ctx.reply('⏳ Генерируем персонажа... Это может занять несколько секунд.');

      const userId = ctx.from.id.toString();
      const character = await this.characterService.createCharacter(userId, archetype);

      // Отправляем информацию о созданном персонаже
      await this.messageService.sendNewCharacterInfo(ctx, character);
    } catch (error) {
      this.logger.error(`Ошибка при создании персонажа: ${error.message}`);
      await ctx.reply('Произошла ошибка при создании персонажа. Попробуйте позже.');
    }
  }

  // Запуск общения с персонажем
  private async startChatWithCharacter(ctx: Context, characterId: number): Promise<void> {
    try {
      const character = await this.characterService.getCharacterById(characterId);

      if (!character) {
        await ctx.reply('Персонаж не найден.');
        return;
      }

      // Обновляем состояние сессии
      ctx.session.state = 'chatting';
      ctx.session.data = {
        ...ctx.session.data,
        activeCharacterId: characterId,
      };

      // Отправляем приветственное сообщение от персонажа
      await ctx.reply(
        `💬 Начало общения с ${character.name}.\n\nПросто отправляйте сообщения, чтобы общаться с персонажем. Для завершения общения отправьте /stop.`,
        Markup.keyboard([
          ['👋 Привет', '❓ Как дела?'],
          ['📊 Статус персонажа', '🏁 Завершить общение'],
        ])
          .oneTime()
          .resize(),
      );

      // Отправляем первое сообщение от персонажа
      const greeting = await this.generateCharacterMessage(character, 'greeting');
      await ctx.reply(greeting);
    } catch (error) {
      this.logger.error(`Ошибка при начале общения: ${error.message}`);
      await ctx.reply('Произошла ошибка при начале общения с персонажем. Попробуйте позже.');
    }
  }

  // Генерация сообщения от персонажа (заглушка)
  private async generateCharacterMessage(character: any, messageType: string): Promise<string> {
    // В реальном приложении здесь будет вызов OpenAI API
    // для генерации сообщения персонажа
    const greetings = [
      `Привет! Рада видеть тебя. Я ${character.name}.`,
      `Здравствуй! Меня зовут ${character.name}. Как прошел твой день?`,
      `${character.name} здесь. Надеюсь, у тебя все хорошо.`,
      `Привет! Я только что думала о тебе. Как дела?`,
    ];

    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
  }

  /**
   * Обработка команды /actions - просмотр и управление действиями персонажа
   */
  async handleActionsCommand(ctx: Context): Promise<void> {
    try {
      // Проверяем доступ пользователя
      const hasAccess = await this.accessService.checkAccess(ctx);
      if (!hasAccess) return;

      // Получаем активного персонажа из сессии
      const characterId = ctx.session?.data?.activeCharacterId;
      if (!characterId) {
        await ctx.reply(
          'Для управления действиями, сначала выберите персонажа с помощью команды /characters',
        );
        return;
      }

      // Получаем данные о персонаже
      const character = await this.characterService.getCharacterById(characterId);
      if (!character) {
        await ctx.reply('Ошибка: персонаж не найден');
        return;
      }

      // Получаем информацию о текущем действии персонажа
      const isPerformingAction = this.characterActionService.isPerformingAction(characterId);
      const currentAction = this.characterActionService.getCurrentAction(characterId);

      let actionText = '';
      let keyboard;

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

        // Создаем клавиатуру для управления действием
        keyboard = Markup.inlineKeyboard([
          Markup.button.callback('🛑 Прервать действие', `stop_action:${characterId}`),
        ]);
      } else {
        // Персонаж не выполняет действие
        actionText = `*${character.name}* в данный момент ничем не занят.
          
Вы можете предложить персонажу действие:`;

        // Создаем клавиатуру с возможными действиями
        keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('😴 Спать', `suggest_action:${characterId}:sleep`),
            Markup.button.callback('📚 Читать', `suggest_action:${characterId}:read`),
          ],
          [
            Markup.button.callback(
              '🏋️ Заниматься спортом',
              `suggest_action:${characterId}:exercise`,
            ),
            Markup.button.callback('🧘 Медитировать', `suggest_action:${characterId}:meditate`),
          ],
          [
            Markup.button.callback('🎨 Творчество', `suggest_action:${characterId}:create`),
            Markup.button.callback('👥 Общение', `suggest_action:${characterId}:socialize`),
          ],
        ]);
      }

      // Отправляем сообщение с информацией о действии и клавиатурой
      await ctx.reply(actionText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /actions: ${error.message}`);
      await ctx.reply('Произошла ошибка при получении информации о действиях персонажа');
    }
  }

  /**
   * Обработка callback-запросов для действий персонажа
   */
  async handleActionCallbacks(ctx: Context): Promise<void> {
    try {
      const callbackData = ctx.callbackQuery.data;

      // Обрабатываем остановку действия
      if (callbackData.startsWith('stop_action:')) {
        const characterId = parseInt(callbackData.split(':')[1]);
        await this.characterActionService.completeAction(characterId);
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
          needType: 'USER_SUGGESTION',
          priority: 1,
          threshold: 0,
          actionImpulse: `Выполнить действие ${actionType}, предложенное пользователем`,
        };

        // Добавляем предложенную мотивацию в начало списка
        const updatedMotivations = [suggestedMotivation, ...motivations];

        // Инициируем действие
        const action = await this.characterActionService.determineAndPerformAction(
          characterId,
          updatedMotivations,
          actionType,
        );

        if (action) {
          await ctx.editMessageText(`${action.description} - действие начато!`);
        } else {
          await ctx.editMessageText('Не удалось начать действие. Пожалуйста, попробуйте позже.');
        }
        return;
      }

      // Отвечаем на callback-запрос
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error(`Ошибка при обработке callback-запроса: ${error.message}`);
      await ctx.answerCbQuery('Произошла ошибка при выполнении действия');
    }
  }
}
