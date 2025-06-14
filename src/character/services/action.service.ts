import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { NeedsService } from './needs.service';
import { OpenaiService } from '../../openai/openai.service';
import { Motivation } from '../entities/emotional-state';
import { Need } from '../entities/need.entity';
import { NeedType } from '../../common/enums/need-type.enum';
import { Action } from '../entities/action.entity';
import { EmotionalState } from '../entities/emotional-state';

// Типы действий персонажей
export enum ActionType {
  // Виртуальные действия (персонаж выполняет их "внутри" своей виртуальной жизни)
  SLEEP = 'sleep',
  READ = 'read',
  WORK = 'work',
  EXERCISE = 'exercise',
  RELAX = 'relax',
  SOCIALIZE = 'socialize',
  CREATE = 'create',
  MEDITATE = 'meditate',

  // Действия, связанные с пользователем
  SEND_MESSAGE = 'send_message',
  ASK_QUESTION = 'ask_question',
  SHARE_STORY = 'share_story',
  SHARE_EMOTION = 'share_emotion',
  EXPRESS_NEED = 'express_need',
}

// Интерфейс действия
export interface CharacterAction {
  type: ActionType;
  description: string;
  duration?: number; // в минутах
  content?: string; // содержание действия (например, текст сообщения)
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  // Карта активных действий персонажей: characterId -> CharacterAction
  private activeActions: Map<number, CharacterAction> = new Map();

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
    @InjectRepository(Need)
    private needRepository: Repository<Need>,
    private needsService: NeedsService,
    private openaiService: OpenaiService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
  ) {
    // Инициализация системы действий
    this.initActionSystem();
  }

  // Инициализация системы действий
  private initActionSystem(): void {
    this.logger.log('Инициализация системы действий персонажей');
    // Запускаем периодическую проверку для генерации проактивных действий
    setInterval(() => this.checkCharactersForActions(), 5 * 60 * 1000); // Каждые 5 минут
  }

  // Проверка персонажей для генерации действий
  private async checkCharactersForActions(): Promise<void> {
    try {
      // Получаем всех активных персонажей
      const characters = await this.characterRepository.find({
        relations: ['needs'],
      });

      this.logger.log(`Проверка ${characters.length} персонажей для генерации действий`);

      for (const character of characters) {
        // Если у персонажа уже есть активное действие, пропускаем его
        if (this.activeActions.has(character.id)) {
          continue;
        }

        // Проверяем, нужно ли персонажу совершить какое-то действие
        const motivations = await this.needsService.getCharacterMotivations(character.id);
        if (motivations.length > 0 && Math.random() < 0.3) {
          // 30% шанс, что персонаж совершит действие
          await this.determineAndPerformAction(character.id, motivations);
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при проверке персонажей для действий: ${error.message}`);
    }
  }

  // Определение и выполнение действия на основе мотиваций с указанным типом действия
  public async determineAndPerformAction(
    characterId: number,
    motivations: Motivation[],
    specificActionType?: string,
  ): Promise<CharacterAction | null> {
    try {
      // Получаем персонажа со всеми данными
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character) {
        this.logger.error(`Персонаж с ID ${characterId} не найден`);
        return null;
      }

      // Получаем эмоциональное состояние
      const emotionalState = await this.needsService.getCharacterEmotionalState(characterId);

      // Получаем последние воспоминания персонажа
      const memories = await this.memoryRepository.find({
        where: { characterId },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // Формируем запрос к OpenAI для определения действия
      const action = await this.determineActionWithAI(
        character,
        motivations,
        emotionalState,
        memories,
        specificActionType,
      );

      if (!action) {
        this.logger.log(`Не удалось определить действие для персонажа ${character.id}`);
        return null;
      }

      // Запускаем выполнение действия
      return await this.startAction(characterId, action);
    } catch (error) {
      this.logger.error(
        `Ошибка при определении действия для персонажа ${characterId}: ${error.message}`,
      );
      return null;
    }
  }

  // Определение действия с помощью AI с указанным типом действия
  private async determineActionWithAI(
    character: Character,
    motivations: Motivation[],
    emotionalState: any,
    memories: CharacterMemory[],
    specificActionType?: string,
  ): Promise<CharacterAction | null> {
    try {
      // Если указан конкретный тип действия, создаем действие напрямую без запроса к AI
      if (specificActionType) {
        const actionType = specificActionType as ActionType;

        // Карта описаний для разных типов действий
        const actionDescriptions: { [key in ActionType]?: string } = {
          [ActionType.SLEEP]: 'Спит, восстанавливая силы и энергию',
          [ActionType.READ]: 'Читает, получая новые знания и впечатления',
          [ActionType.WORK]: 'Работает, занимаясь важными делами',
          [ActionType.EXERCISE]: 'Занимается физическими упражнениями',
          [ActionType.RELAX]: 'Отдыхает, восстанавливая силы',
          [ActionType.SOCIALIZE]: 'Общается с другими людьми',
          [ActionType.CREATE]: 'Занимается творчеством, создавая что-то новое',
          [ActionType.MEDITATE]: 'Медитирует, погружаясь в себя',
          [ActionType.SEND_MESSAGE]: 'Хочет написать сообщение',
          [ActionType.ASK_QUESTION]: 'Хочет задать вопрос',
          [ActionType.SHARE_STORY]: 'Хочет рассказать историю',
          [ActionType.SHARE_EMOTION]: 'Хочет поделиться своими чувствами',
          [ActionType.EXPRESS_NEED]: 'Хочет выразить свою потребность',
        };

        // Длительность действий в минутах
        const actionDurations: { [key in ActionType]?: number } = {
          [ActionType.SLEEP]: 480, // 8 часов
          [ActionType.READ]: 120, // 2 часа
          [ActionType.WORK]: 240, // 4 часа
          [ActionType.EXERCISE]: 60, // 1 час
          [ActionType.RELAX]: 90, // 1.5 часа
          [ActionType.SOCIALIZE]: 120, // 2 часа
          [ActionType.CREATE]: 180, // 3 часа
          [ActionType.MEDITATE]: 40, // 40 минут
        };

        // Создаем действие вручную
        const action: CharacterAction = {
          type: actionType,
          description: actionDescriptions[actionType] || `Выполняет действие: ${actionType}`,
          duration: actionDurations[actionType] || 30, // По умолчанию 30 минут
          startTime: new Date(),
          status: 'pending',
          metadata: {
            suggestedByUser: true,
          },
        };

        return action;
      }

      // Иначе формируем запрос к OpenAI
      const prompt = this.createActionSelectionPrompt(
        character,
        motivations,
        emotionalState,
        memories,
      );

      // Отправляем запрос и получаем ответ
      const response = await this.openaiService.createChatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Ты модель, которая помогает определить следующее действие для виртуального персонажа на основе его мотиваций, эмоционального состояния и памяти. Ответ должен быть строго в формате JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        model: 'gpt-4',
      });

      // Парсим ответ
      const content = response.choices[0].message.content;
      const actionData = JSON.parse(content);

      // Создаем объект действия
      const action: CharacterAction = {
        type: actionData.type as ActionType,
        description: actionData.description,
        duration: actionData.duration,
        content: actionData.content,
        startTime: new Date(),
        status: 'pending',
        metadata: actionData.metadata,
      };

      return action;
    } catch (error) {
      this.logger.error(`Ошибка при определении действия с AI: ${error.message}`);
      return null;
    }
  }

  // Создание промпта для выбора действия
  private createActionSelectionPrompt(
    character: Character,
    motivations: Motivation[],
    emotionalState: any,
    memories: CharacterMemory[],
  ): string {
    const needsDescription = character.needs
      .map(need => `${need.type}: ${need.value}% (приоритет: ${need.priority})`)
      .join(', ');

    const memoryDescriptions = memories
      .map(memory => `- ${memory.type}: ${memory.content} (важность: ${memory.importance})`)
      .join('\n');

    const motivationDescriptions = motivations
      .map(m => `- ${m.needType}: ${m.actionImpulse} (приоритет: ${m.priority})`)
      .join('\n');

    return `
    Определи следующее действие для персонажа на основе его текущего состояния.
    
    ### Информация о персонаже
    Имя: ${character.name}
    Архетип: ${character.archetype}
    Личность: ${character.personality}
    
    ### Текущие потребности
    ${needsDescription}
    
    ### Эмоциональное состояние
    Основная эмоция: ${emotionalState?.primary || 'нейтральность'}
    Вторичная эмоция: ${emotionalState?.secondary || 'нейтральность'}
    Интенсивность: ${emotionalState?.intensity || 0}%
    Описание: ${emotionalState?.description || 'Нейтральное эмоциональное состояние'}
    
    ### Текущие мотивации
    ${motivationDescriptions}
    
    ### Последние воспоминания
    ${memoryDescriptions}
    
    Выбери одно действие из списка и обоснуй свой выбор:
    1. Сон (sleep): персонаж отдыхает и восстанавливается
    2. Чтение (read): персонаж читает для развития
    3. Работа (work): персонаж занимается работой/делами
    4. Физическая активность (exercise): персонаж занимается спортом
    5. Отдых (relax): персонаж расслабляется
    6. Социализация (socialize): персонаж взаимодействует с другими
    7. Творчество (create): персонаж занимается творчеством
    8. Медитация (meditate): персонаж медитирует
    9. Отправка сообщения (send_message): персонаж пишет пользователю
    10. Вопрос (ask_question): персонаж задает вопрос пользователю
    11. Рассказ истории (share_story): персонаж рассказывает историю
    12. Выражение эмоций (share_emotion): персонаж делится чувствами
    13. Выражение потребности (express_need): персонаж напрямую просит о чем-то
    
    Верни свой ответ в формате JSON:
    {
      "type": "один из типов действий (sleep, read, work, exercise, relax, socialize, create, meditate, send_message, ask_question, share_story, share_emotion, express_need)",
      "description": "краткое описание действия",
      "duration": число (в минутах, сколько длится действие),
      "content": "содержание действия (для сообщений - текст сообщения, для других действий - детали)",
      "reasoning": "объяснение, почему выбрано именно это действие",
      "metadata": {"дополнительные данные о действии"}
    }
    `;
  }

  // Запуск выполнения действия
  public async startAction(characterId: number, action: CharacterAction): Promise<CharacterAction> {
    try {
      // Устанавливаем время начала
      action.startTime = new Date();
      action.status = 'in_progress';

      // Если указана длительность, рассчитываем время завершения
      if (action.duration) {
        action.endTime = new Date(action.startTime.getTime() + action.duration * 60 * 1000);
      }

      // Сохраняем действие в активных действиях
      this.activeActions.set(characterId, action);

      // Создаем запись в памяти о начале действия
      await this.createActionMemory(characterId, action, 'start');

      // Запускаем выполнение действия
      this.logger.log(
        `Персонаж ${characterId} начал действие: ${action.type} - ${action.description}`,
      );

      // Для длительных действий устанавливаем таймер завершения
      if (action.duration) {
        setTimeout(
          () => {
            this.completeAction(characterId).catch(error => {
              this.logger.error(
                `Ошибка при завершении действия персонажа ${characterId}: ${error.message}`,
              );
            });
          },
          action.duration * 60 * 1000,
        );
      } else {
        // Для мгновенных действий сразу выполняем
        await this.executeAction(characterId, action);
      }

      return action;
    } catch (error) {
      this.logger.error(
        `Ошибка при запуске действия для персонажа ${characterId}: ${error.message}`,
      );

      // В случае ошибки помечаем действие как провалившееся
      action.status = 'failed';
      return action;
    }
  }

  // Выполнение действия
  private async executeAction(characterId: number, action: CharacterAction): Promise<void> {
    try {
      switch (action.type) {
        // Виртуальные действия не требуют немедленного взаимодействия с пользователем
        case ActionType.SLEEP:
        case ActionType.READ:
        case ActionType.WORK:
        case ActionType.EXERCISE:
        case ActionType.RELAX:
        case ActionType.SOCIALIZE:
        case ActionType.CREATE:
        case ActionType.MEDITATE:
          // Для этих действий ничего делать не нужно, они завершатся по таймеру
          break;

        // Действия, требующие взаимодействия с пользователем
        case ActionType.SEND_MESSAGE:
        case ActionType.ASK_QUESTION:
        case ActionType.SHARE_STORY:
        case ActionType.SHARE_EMOTION:
        case ActionType.EXPRESS_NEED:
          // Эти действия должны быть интегрированы с Telegram API
          // Они будут отправлять сообщение пользователю через TelegramService

          // Если действие не имеет длительности, то сразу завершаем его
          if (!action.duration) {
            await this.completeAction(characterId);
          }
          break;

        default:
          this.logger.warn(`Неизвестный тип действия: ${action.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при выполнении действия для персонажа ${characterId}: ${error.message}`,
      );

      // В случае ошибки помечаем действие как провалившееся
      action.status = 'failed';
      this.activeActions.set(characterId, action);
    }
  }

  // Завершение действия
  public async completeAction(characterId: number): Promise<void> {
    try {
      const action = this.activeActions.get(characterId);

      if (!action) {
        this.logger.warn(`Попытка завершить несуществующее действие для персонажа ${characterId}`);
        return;
      }

      // Устанавливаем время завершения и статус
      action.endTime = new Date();
      action.status = 'completed';

      // Создаем запись в памяти о завершении действия
      await this.createActionMemory(characterId, action, 'complete');

      // Обновляем потребности в зависимости от выполненного действия
      await this.updateNeedsAfterAction(characterId, action);

      // Удаляем действие из списка активных
      this.activeActions.delete(characterId);

      this.logger.log(
        `Персонаж ${characterId} завершил действие: ${action.type} - ${action.description}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при завершении действия персонажа ${characterId}: ${error.message}`,
      );
    }
  }

  // Создание записи в памяти о действии
  private async createActionMemory(
    characterId: number,
    action: CharacterAction,
    stage: 'start' | 'complete',
  ): Promise<void> {
    try {
      const memory = new CharacterMemory();
      memory.characterId = characterId;
      memory.type = 'event';

      // Формируем содержание памяти в зависимости от стадии
      if (stage === 'start') {
        memory.content = `Начал действие: ${action.description}`;
      } else {
        memory.content = `Завершил действие: ${action.description}`;
      }

      // Определяем важность памяти в зависимости от типа действия
      switch (action.type) {
        case ActionType.SEND_MESSAGE:
        case ActionType.ASK_QUESTION:
        case ActionType.SHARE_STORY:
        case ActionType.SHARE_EMOTION:
        case ActionType.EXPRESS_NEED:
          memory.importance = 7; // Высокая важность для взаимодействия с пользователем
          break;
        default:
          memory.importance = 4; // Средняя важность для рутинных действий
      }

      // Добавляем метаданные
      memory.metadata = {
        actionType: action.type,
        actionContent: action.content,
        actionDuration: action.duration,
      };

      memory.createdAt = new Date();

      await this.memoryRepository.save(memory);
    } catch (error) {
      this.logger.error(
        `Ошибка при создании памяти о действии для персонажа ${characterId}: ${error.message}`,
      );
    }
  }

  // Обновление потребностей после действия
  private async updateNeedsAfterAction(
    characterId: number,
    action: CharacterAction,
  ): Promise<void> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character || !character.needs) {
        return;
      }

      // В зависимости от типа действия, обновляем разные потребности
      for (const need of character.needs) {
        let changeValue = 0;
        let reason = '';

        switch (action.type) {
          case ActionType.SLEEP:
            if (need.type === NeedType.SECURITY) {
              changeValue = -30; // Сон сильно уменьшает потребность в безопасности
              reason = 'Хорошо выспался и чувствует себя в безопасности';
            }
            break;

          case ActionType.READ:
            if (need.type === NeedType.GROWTH) {
              changeValue = -35; // Чтение сильно уменьшает потребность в росте
              reason = 'Получил новые знания и развитие из книги';
            }
            break;

          case ActionType.EXERCISE:
            if (need.type === NeedType.SECURITY || need.type === NeedType.GROWTH) {
              changeValue = -25; // Упражнения уменьшают потребности в безопасности и росте
              reason = 'Занимался физической активностью и почувствовал себя лучше';
            }
            break;

          case ActionType.SOCIALIZE:
            if (need.type === NeedType.CONNECTION || need.type === NeedType.ATTENTION) {
              changeValue = -40; // Социализация сильно уменьшает потребности в связи и внимании
              reason = 'Общался с другими и получил социальное взаимодействие';
            }
            break;

          case ActionType.SEND_MESSAGE:
          case ActionType.ASK_QUESTION:
          case ActionType.SHARE_STORY:
          case ActionType.SHARE_EMOTION:
          case ActionType.EXPRESS_NEED:
            if (
              need.type === NeedType.ATTENTION ||
              need.type === NeedType.CONNECTION ||
              need.type === NeedType.VALIDATION
            ) {
              changeValue = -20; // Сообщения пользователю уменьшают потребность в связи и внимании
              reason = 'Инициировал общение с пользователем';
            }
            break;
        }

        // Если определили изменение, обновляем потребность
        if (changeValue !== 0) {
          await this.needsService.updateNeedValue(
            need.id,
            Math.max(0, need.value + changeValue), // Убедимся, что значение не ниже 0
            reason,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при обновлении потребностей после действия для персонажа ${characterId}: ${error.message}`,
      );
    }
  }

  // Проверка, выполняет ли персонаж действие в данный момент
  public isPerformingAction(characterId: number): boolean {
    return this.activeActions.has(characterId);
  }

  // Получение текущего действия персонажа
  public getCurrentAction(characterId: number): CharacterAction | null {
    return this.activeActions.get(characterId) || null;
  }

  // Генерация сообщения с помощью AI
  public async generateProactiveMessage(
    characterId: number,
    actionType: ActionType,
    context: string,
  ): Promise<string> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Формируем промпт в зависимости от типа действия
      let prompt = '';

      switch (actionType) {
        case ActionType.SEND_MESSAGE:
          prompt = `Ты ${character.name}, ${character.personality}. 
          Напиши сообщение пользователю, с которым ты общаешься. 
          Контекст: ${context}`;
          break;

        case ActionType.ASK_QUESTION:
          prompt = `Ты ${character.name}, ${character.personality}. 
          Задай интересный или глубокий вопрос пользователю, с которым ты общаешься. 
          Контекст: ${context}`;
          break;

        case ActionType.SHARE_STORY:
          prompt = `Ты ${character.name}, ${character.personality}. 
          Расскажи короткую историю из "своей жизни", которая будет интересна пользователю. 
          Контекст: ${context}`;
          break;

        case ActionType.SHARE_EMOTION:
          prompt = `Ты ${character.name}, ${character.personality}. 
          Поделись своими чувствами или эмоциями с пользователем. Будь уязвимым и открытым. 
          Контекст: ${context}`;
          break;

        case ActionType.EXPRESS_NEED:
          prompt = `Ты ${character.name}, ${character.personality}. 
          Выскажи свою потребность или желание пользователю. Это может быть что-то, что тебе нужно или чего ты хочешь. 
          Контекст: ${context}`;
          break;

        default:
          throw new Error(`Неподдерживаемый тип действия для генерации сообщения: ${actionType}`);
      }

      // Отправляем запрос к OpenAI
      const response = await this.openaiService.createChatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Ты виртуальный персонаж, который общается с пользователем. Твоя задача - создавать естественные, эмоциональные сообщения в соответствии с твоей личностью и контекстом.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'gpt-4',
      });

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Ошибка при генерации проактивного сообщения: ${error.message}`);
      return 'Привет! Как дела?'; // Запасной вариант в случае ошибки
    }
  }

  /**
   * Инициирует действие персонажа на основе мотивации
   * @param characterId ID персонажа
   * @param motivation Мотивация для действия
   * @param emotionalState Эмоциональное состояние персонажа
   * @param suggestedAction Предлагаемое действие (опционально)
   * @returns Созданное действие
   */
  async initiateActionBasedOnMotivation(
    characterId: number,
    motivation: Motivation,
    emotionalState: EmotionalState,
    suggestedAction?: string,
  ): Promise<Action> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });
      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Определяем тип действия на основе мотивации или используем предложенное действие
      let actionType: string;
      let actionDescription: string;

      if (suggestedAction) {
        // Если предложено конкретное действие, используем его
        actionType = 'CUSTOM';
        actionDescription = suggestedAction;
      } else {
        // Иначе определяем действие на основе мотивации и эмоционального состояния
        const actions = this.getAvailableActionsForNeed(motivation.needType);

        // Выбираем случайное действие из доступных для данной потребности
        const selectedAction = actions[Math.floor(Math.random() * actions.length)];

        actionType = selectedAction.type;
        actionDescription = selectedAction.description
          .replace('{emotion}', emotionalState.dominantEmotion || 'нейтрально')
          .replace('{motivation}', motivation.description || 'удовлетворить потребность');
      }

      // Создаем запись о действии
      const action = new Action();
      action.characterId = characterId;
      action.type = actionType;
      action.description = actionDescription;
      action.startTime = new Date();
      action.expectedDuration = this.config.actions.defaultDuration;
      action.status = 'IN_PROGRESS';
      action.relatedNeed = motivation.needType;

      // Сохраняем действие
      const savedAction = await this.actionRepository.save(action);

      // Обновляем текущее действие персонажа
      this.activeActions.set(characterId, {
        type: actionType as ActionType,
        description: actionDescription,
        startTime: new Date(),
        status: 'in_progress',
      });

      this.logger.log(`Персонаж ${character.name} начал действие: ${actionDescription}`);

      return savedAction;
    } catch (error) {
      this.logger.error(`Ошибка при инициации действия: ${error.message}`);
      throw error;
    }
  }
}
