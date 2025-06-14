import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StoryEvent,
  EventStatus,
  EventType,
} from './entities/story-event.entity';
import { CharacterService } from '../character/character.service';
import { DialogService } from '../dialog/services/dialog.service';
import { RelationshipStage } from '../character/entities/character.entity';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    @InjectRepository(StoryEvent)
    private storyEventRepository: Repository<StoryEvent>,

    private readonly characterService: CharacterService,
    private readonly dialogService: DialogService,
  ) {}

  async createStoryEvent(
    characterId: number,
    eventData: Partial<StoryEvent>,
  ): Promise<StoryEvent> {
    try {
      // Проверяем существование персонажа
      await this.characterService.findOne(characterId);

      const storyEvent = this.storyEventRepository.create({
        ...eventData,
        characterId,
        status: EventStatus.PENDING,
      });

      return this.storyEventRepository.save(storyEvent);
    } catch (error) {
      this.logger.error(
        `Ошибка при создании сюжетного события: ${error.message}`,
      );
      throw error;
    }
  }

  async findPendingEvents(characterId: number): Promise<StoryEvent[]> {
    return this.storyEventRepository.find({
      where: {
        characterId,
        status: EventStatus.PENDING,
      },
    });
  }

  async findTriggeredEvents(characterId: number): Promise<StoryEvent[]> {
    return this.storyEventRepository.find({
      where: {
        characterId,
        status: EventStatus.TRIGGERED,
      },
    });
  }

  async checkEventTriggers(
    characterId: number,
    dialogId: number,
  ): Promise<StoryEvent[]> {
    try {
      const character = await this.characterService.findOne(characterId);
      const pendingEvents = await this.findPendingEvents(characterId);
      const triggeredEvents: StoryEvent[] = [];

      for (const event of pendingEvents) {
        const triggers = event.triggers || {};
        let shouldTrigger = false;

        // Проверяем условия срабатывания события
        if (
          triggers.affectionLevel &&
          character.affection >= triggers.affectionLevel
        ) {
          shouldTrigger = true;
        }

        if (triggers.trustLevel && character.trust >= triggers.trustLevel) {
          shouldTrigger = true;
        }

        // Проверка вероятности (случайные события)
        if (triggers.probability && Math.random() <= triggers.probability) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          // Активируем событие
          event.status = EventStatus.TRIGGERED;
          event.triggeredAt = new Date();

          const savedEvent = await this.storyEventRepository.save(event);
          triggeredEvents.push(savedEvent);

          // Отправляем системное сообщение в диалог о событии
          await this.dialogService.createMessage({
            dialogId: dialogId,
            content: `[Сюжетное событие: ${event.title}] ${event.description}`,
            isFromUser: false,
            metadata: { eventType: 'story', eventId: event.id },
          });

          // Применяем эффекты события
          if (event.effects) {
            if (event.effects.affectionChange) {
              await this.characterService.updateAffection(
                characterId,
                event.effects.affectionChange,
              );
            }

            if (event.effects.trustChange) {
              await this.characterService.updateTrust(
                characterId,
                event.effects.trustChange,
              );
            }

            if (event.effects.relationshipStageChange) {
              await this.characterService.updateRelationshipStage(
                characterId,
                event.effects.relationshipStageChange as RelationshipStage,
              );
            }

            // Обработка изменений потребностей
            if (event.effects.needsChanges) {
              for (const [needType, change] of Object.entries(
                event.effects.needsChanges,
              )) {
                await this.characterService.satisfyNeed(
                  characterId,
                  needType as any,
                  change,
                );
              }
            }
          }
        }
      }

      return triggeredEvents;
    } catch (error) {
      this.logger.error(`Ошибка при проверке событий: ${error.message}`);
      throw error;
    }
  }

  async completeEvent(eventId: number): Promise<StoryEvent> {
    const event = await this.storyEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Событие с ID ${eventId} не найдено`);
    }

    event.status = EventStatus.COMPLETED;
    event.completedAt = new Date();

    return this.storyEventRepository.save(event);
  }

  async skipEvent(eventId: number): Promise<StoryEvent> {
    const event = await this.storyEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Событие с ID ${eventId} не найдено`);
    }

    event.status = EventStatus.SKIPPED;

    return this.storyEventRepository.save(event);
  }

  async createDefaultEvents(characterId: number): Promise<StoryEvent[]> {
    const defaultEvents = [
      {
        title: 'Первая ссора',
        description:
          'Между вами возникло недопонимание, которое может перерасти в конфликт.',
        type: EventType.CRISIS,
        triggers: {
          messageCount: 50,
          probability: 0.3,
        },
        effects: {
          trustChange: -10,
          affectionChange: -5,
        },
        dialogOptions: [
          'Мне кажется, ты меня не понимаешь...',
          'Почему ты всегда так реагируешь?',
          'Я думала, ты другой человек.',
        ],
      },
      {
        title: 'Откровенный разговор',
        description:
          'Пора перейти на новый уровень близости и поговорить о чем-то личном.',
        type: EventType.RELATIONSHIP_CHANGE,
        triggers: {
          affectionLevel: 70,
          trustLevel: 60,
        },
        effects: {
          trustChange: 15,
          relationshipStageChange: RelationshipStage.FRIENDSHIP,
        },
        dialogOptions: [
          'Знаешь, я давно хотела рассказать тебе...',
          'Мне кажется, мы достаточно близки, чтобы поговорить о...',
          'Ты единственный человек, которому я могу доверить...',
        ],
      },
      {
        title: 'Неожиданная новость',
        description:
          'Происходит важное событие в жизни персонажа, которое меняет ваши отношения.',
        type: EventType.LIFE_EVENT,
        triggers: {
          messageCount: 100,
          probability: 0.5,
        },
        effects: {
          affectionChange: 10,
          needsChanges: {
            communication: 20,
            attention: 30,
          },
        },
        dialogOptions: [
          'У меня потрясающие новости!',
          'Ты не поверишь, что со мной случилось...',
          'Мне срочно нужно с тобой поделиться...',
        ],
      },
    ];

    const createdEvents: StoryEvent[] = [];

    for (const eventData of defaultEvents) {
      const event = await this.createStoryEvent(characterId, eventData as any);
      createdEvents.push(event);
    }

    return createdEvents;
  }
}
