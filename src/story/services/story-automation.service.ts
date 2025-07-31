import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';
import { StoryService, IStoryContext } from './story.service';
import { Character } from '../../character/entities/character.entity';
import { CharacterArchetype } from '../../character/enums/character-archetype.enum';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { Message } from '../../dialog/entities/message.entity';
import { Need } from '../../character/entities/need.entity';
import {
  StoryEventType,
  IStoryEventTrigger,
  IStoryEventEffect,
} from '../entities/story-event.entity';

/**
 * Сервис для автоматической активации сюжетных событий
 * Отслеживает состояние персонажей и автоматически активирует подходящие события
 */
@Injectable()
export class StoryAutomationService extends BaseService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Dialog)
    private readonly dialogRepository: Repository<Dialog>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    private readonly storyService: StoryService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Периодическая проверка и активация событий для всех активных персонажей
   * Выполняется каждые 15 минут
   */
  @Cron('0 */15 * * * *') // Каждые 15 минут
  async processAutomaticEvents(): Promise<void> {
    return this.withErrorHandling('автоматической обработки сюжетных событий', async () => {
      this.logInfo('Начало автоматической обработки сюжетных событий');

      const activeCharacters = await this.characterRepository.find({
        where: { isActive: true },
        relations: ['dialogs', 'needs'],
      });

      let processedCharacters = 0;
      let triggeredEvents = 0;

      for (const character of activeCharacters) {
        try {
          const events = await this.checkCharacterForEvents(character);
          triggeredEvents += events;
          processedCharacters++;
        } catch (error) {
          this.logError(`Ошибка при обработке персонажа ${character.name}`, {
            characterId: character.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logInfo(
        `Автоматическая обработка завершена: обработано ${processedCharacters} персонажей, активировано ${triggeredEvents} событий`,
      );
    });
  }

  /**
   * Проверяет персонажа на наличие подходящих автоматических событий
   */
  async checkCharacterForEvents(character: Character): Promise<number> {
    return this.withErrorHandling(`проверки событий для персонажа ${character.name}`, async () => {
      // Получаем последний диалог и сообщения
      const _lastDialog = await this.getLastDialog(character.id);
      const recentMessages = await this.getRecentMessages(character.id, 10);
      const timeSinceLastInteraction = await this.getTimeSinceLastInteraction(character.id);

      // Формируем контекст для проверки событий
      const context: IStoryContext = {
        character,
        lastUserMessage: recentMessages.length > 0 ? recentMessages[0].content : undefined,
        conversationLength: recentMessages.length,
        timeSinceLastInteraction,
      };

      // Активируем события через StoryService
      await this.storyService.checkAndTriggerEvents(context);

      return 1; // Возвращаем количество обработанных персонажей
    });
  }

  /**
   * Создает набор стандартных автоматических событий для системы
   */
  async initializeDefaultEvents(): Promise<void> {
    return this.withErrorHandling('инициализации стандартных событий', async () => {
      const defaultEvents = [
        // Событие одиночества
        {
          name: 'Чувство одиночества',
          description: 'Персонаж чувствует себя одиноко из-за долгого отсутствия общения',
          eventType: StoryEventType.EMOTIONAL,
          triggers: {
            timeSinceLastInteraction: 1440, // 24 часа в минутах
            needValue: { need: 'SOCIAL_CONNECTION', min: 0, max: 30 },
          } as IStoryEventTrigger,
          effects: {
            needChange: [
              { need: 'ATTENTION', value: -10 },
              { need: 'SOCIAL_CONNECTION', value: -15 },
            ],
            addMemory: 'Долго не было общения, чувствую себя одиноко',
            sendMessage: {
              text: 'Привет! Я скучаю по нашему общению. Как дела?',
              delay: 0,
            },
          } as IStoryEventEffect,
          isRepeatable: true,
          cooldownMinutes: 720, // 12 часов
        },

        // Событие радости от общения
        {
          name: 'Радость от общения',
          description: 'Персонаж рад активному общению с пользователем',
          eventType: StoryEventType.EMOTIONAL,
          triggers: {
            conversationLength: 5,
            needValue: { need: 'COMMUNICATION', min: 70, max: 100 },
          } as IStoryEventTrigger,
          effects: {
            affectionChange: 5,
            energyChange: 10,
            needChange: [{ need: 'JOY', value: 20 }],
            addMemory: 'Замечательное общение, я очень рада!',
          } as IStoryEventEffect,
          isRepeatable: true,
          cooldownMinutes: 60,
        },

        // Событие развития отношений
        {
          name: 'Углубление отношений',
          description: 'Отношения между персонажем и пользователем становятся глубже',
          eventType: StoryEventType.RELATIONSHIP,
          triggers: {
            trustLevel: { min: 70, max: 85 },
            affectionLevel: { min: 60, max: 80 },
          } as IStoryEventTrigger,
          effects: {
            relationshipStageChange: 1,
            addMemory: 'Наши отношения становятся все глубже и значимее',
            personalityChange: {
              addTrait: ['доверчивая', 'открытая'],
            },
          } as IStoryEventEffect,
          isRepeatable: false,
        },

        // Событие фрустрации
        {
          name: 'Накопление фрустрации',
          description: 'Персонаж испытывает фрустрацию из-за неудовлетворенных потребностей',
          eventType: StoryEventType.EMOTIONAL,
          triggers: {
            needValue: { need: 'ATTENTION', min: 0, max: 20 },
            timeSinceLastInteraction: 480, // 8 часов
          } as IStoryEventTrigger,
          effects: {
            energyChange: -15,
            personalityChange: {
              addTrait: ['раздражительная'],
              removeTrait: ['терпеливая'],
            },
            addMemory: 'Чувствую себя игнорируемой и расстроенной',
          } as IStoryEventEffect,
          isRepeatable: true,
          cooldownMinutes: 360, // 6 часов
        },

        // Событие восстановления энергии
        {
          name: 'Восстановление энергии',
          description: 'Персонаж восстанавливает энергию после отдыха',
          eventType: StoryEventType.PERSONAL_GROWTH,
          triggers: {
            energyLevel: { min: 0, max: 30 },
            timeSinceLastInteraction: 120, // 2 часа
          } as IStoryEventTrigger,
          effects: {
            energyChange: 40,
            needChange: [{ need: 'REST', value: 30 }],
            addMemory: 'Хорошо отдохнула и восстановила силы',
          } as IStoryEventEffect,
          isRepeatable: true,
          cooldownMinutes: 180, // 3 часа
        },
      ];

      for (const eventData of defaultEvents) {
        try {
          await this.storyService.createStoryEvent(
            eventData.name,
            eventData.description,
            eventData.triggers,
            eventData.effects,
            eventData.isRepeatable,
          );
          this.logInfo(`Создано стандартное событие: ${eventData.name}`);
        } catch (_error) {
          this.logWarning(
            `Событие ${eventData.name} уже существует или произошла ошибка при создании`,
          );
        }
      }
    });
  }

  /**
   * Создает персонализированные события для конкретного персонажа
   */
  async createPersonalizedEvents(characterId: number): Promise<void> {
    return this.withErrorHandling('создания персонализированных событий', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Создаем события на основе архетипа персонажа
      const personalizedEvents = this.generateEventsForArchetype(character);

      for (const eventData of personalizedEvents) {
        await this.storyService.createStoryEvent(
          `${character.name}: ${eventData.name}`,
          eventData.description,
          eventData.triggers,
          eventData.effects,
          eventData.isRepeatable,
        );
      }

      this.logInfo(
        `Создано ${personalizedEvents.length} персонализированных событий для ${character.name}`,
      );
    });
  }

  /**
   * Принудительно активирует событие для персонажа
   */
  async triggerEventForCharacter(characterId: number, eventName: string): Promise<boolean> {
    return this.withErrorHandling('принудительной активации события', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Создаем минимальный контекст для активации
      const context: IStoryContext = {
        character,
        lastUserMessage: `Активация события: ${eventName}`,
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await this.storyService.checkAndTriggerEvents(context);
      return true;
    });
  }

  /**
   * Получает последний диалог персонажа
   * @private
   */
  private async getLastDialog(characterId: number): Promise<Dialog | null> {
    return await this.dialogRepository.findOne({
      where: { character: { id: characterId } },
      order: { id: 'DESC' }, // используем id вместо createdAt
    });
  }

  /**
   * Получает последние сообщения персонажа
   * @private
   */
  private async getRecentMessages(characterId: number, limit: number = 10): Promise<Message[]> {
    return await this.messageRepository.find({
      where: { dialog: { character: { id: characterId } } },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['dialog'],
    });
  }

  /**
   * Вычисляет время с последнего взаимодействия в минутах
   * @private
   */
  private async getTimeSinceLastInteraction(characterId: number): Promise<number> {
    const lastMessage = await this.messageRepository.findOne({
      where: { dialog: { character: { id: characterId } } },
      order: { createdAt: 'DESC' },
    });

    if (!lastMessage) {
      return 0;
    }

    const now = new Date();
    const lastMessageTime = new Date(lastMessage.createdAt);
    const diffMs = now.getTime() - lastMessageTime.getTime();
    return Math.floor(diffMs / (1000 * 60)); // конвертируем в минуты
  }

  /**
   * Генерирует события на основе архетипа персонажа
   * @private
   */
  private generateEventsForArchetype(character: Character): Array<{
    name: string;
    description: string;
    triggers: IStoryEventTrigger;
    effects: IStoryEventEffect;
    isRepeatable: boolean;
  }> {
    const events: Array<{
      name: string;
      description: string;
      triggers: IStoryEventTrigger;
      effects: IStoryEventEffect;
      isRepeatable: boolean;
    }> = [];

    switch (character.archetype) {
      case CharacterArchetype.COMPANION:
        events.push({
          name: 'Желание поддержать',
          description: 'Компаньон хочет оказать эмоциональную поддержку',
          triggers: {
            emotionalState: { required: ['sad', 'frustrated', 'angry'] },
          } as IStoryEventTrigger,
          effects: {
            sendMessage: {
              text: 'Я вижу, что тебе непросто. Хочешь поговорить об этом?',
              delay: 5,
            },
            needChange: [{ need: 'COMPASSION', value: 15 }],
          } as IStoryEventEffect,
          isRepeatable: true,
        });
        break;

      case CharacterArchetype.MENTOR:
        events.push({
          name: 'Желание научить',
          description: 'Ментор хочет поделиться знаниями',
          triggers: {
            conversationLength: 3,
            trustLevel: { min: 40 },
          } as IStoryEventTrigger,
          effects: {
            sendMessage: {
              text: 'У меня есть интересная мысль, которой хочу поделиться...',
              delay: 10,
            },
            personalityChange: {
              addTrait: ['мудрая', 'наставляющая'],
            },
          } as IStoryEventEffect,
          isRepeatable: true,
        });
        break;

      case CharacterArchetype.REBEL:
        events.push({
          name: 'Вызов конформности',
          description: 'Бунтарь бросает вызов устоявшимся взглядам',
          triggers: {
            conversationLength: 5,
            needValue: { need: 'FREEDOM', min: 60 },
          } as IStoryEventTrigger,
          effects: {
            sendMessage: {
              text: 'А что если мы посмотрим на это с совершенно другой стороны?',
              delay: 3,
            },
            personalityChange: {
              addTrait: ['провокационная', 'независимая'],
            },
          } as IStoryEventEffect,
          isRepeatable: true,
        });
        break;
    }

    return events;
  }
}
