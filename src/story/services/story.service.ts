import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryEvent, IStoryEventTrigger, IStoryEventEffect } from '../entities/story-event.entity';
import { CharacterStoryProgress } from '../entities/character-story-progress.entity';
import { Character, RelationshipStage } from '../../character/entities/character.entity';
import { Need } from '../../character/entities/need.entity';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { MessageAnalysis } from '../../character/interfaces/analysis.interfaces';

/**
 * Расширенный контекст для проверки триггеров событий.
 */
export interface IStoryContext {
  character: Character;
  lastUserMessage?: string;
  messageAnalysis?: MessageAnalysis;
  currentNeeds?: Need[];
  conversationLength?: number;
  timeSinceLastInteraction?: number;
}

@Injectable()
export class StoryService extends BaseService {
  constructor(
    @InjectRepository(StoryEvent)
    private readonly storyEventRepository: Repository<StoryEvent>,
    @InjectRepository(CharacterStoryProgress)
    private readonly progressRepository: Repository<CharacterStoryProgress>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Проверяет и активирует сюжетные события для персонажа.
   * @param context - Текущий контекст взаимодействия.
   */
  async checkAndTriggerEvents(context: IStoryContext): Promise<void> {
    return this.withErrorHandling('проверки и активации сюжетных событий', async () => {
      const { character } = context;

      // Получаем потребности персонажа для контекста
      if (!context.currentNeeds) {
        context.currentNeeds = await this.needRepository.find({
          where: { characterId: character.id, isActive: true },
        });
      }

      const activeEvents = await this.storyEventRepository.find({ where: { isActive: true } });
      const completedEventIds = (
        await this.progressRepository.find({
          where: { character: { id: character.id } },
          relations: ['storyEvent'],
        })
      ).map(p => p.storyEvent.id);

      const eventsToCheck = activeEvents.filter(
        event => !completedEventIds.includes(event.id) || event.isRepeatable,
      );

      let triggeredEvents = 0;
      for (const event of eventsToCheck) {
        if (await this.areTriggersMet(event.triggers, context)) {
          await this.applyEvent(event, character, context);
          triggeredEvents++;

          // Ограничиваем количество событий за один раз
          if (triggeredEvents >= 3) break;
        }
      }

      if (triggeredEvents > 0) {
        this.logInfo(
          `Активировано ${triggeredEvents} сюжетных событий для персонажа ${character.name}`,
        );
      }
    });
  }

  /**
   * Создает новое сюжетное событие
   */
  async createStoryEvent(
    name: string,
    description: string,
    triggers: IStoryEventTrigger,
    effects: IStoryEventEffect,
    isRepeatable: boolean = false,
  ): Promise<StoryEvent> {
    return this.withErrorHandling('создания сюжетного события', async () => {
      const event = this.storyEventRepository.create({
        name,
        description,
        triggers,
        effects,
        isRepeatable,
        isActive: true,
      });

      await this.storyEventRepository.save(event);
      this.logInfo(`Создано новое сюжетное событие: ${name}`);
      return event;
    });
  }

  /**
   * Получает прогресс персонажа по сюжетным событиям
   */
  async getCharacterStoryProgress(characterId: number): Promise<CharacterStoryProgress[]> {
    return this.withErrorHandling('получения прогресса персонажа', async () => {
      return await this.progressRepository.find({
        where: { character: { id: characterId } },
        relations: ['storyEvent'],
        order: { completedAt: 'DESC' },
      });
    });
  }

  /**
   * Проверяет, выполнены ли условия триггеров.
   * @private
   */
  private async areTriggersMet(
    triggers: IStoryEventTrigger,
    context: IStoryContext,
  ): Promise<boolean> {
    // Проверка ключевых слов
    if (triggers.specificKeyword && context.lastUserMessage) {
      const message = context.lastUserMessage.toLowerCase();
      const hasKeyword = triggers.specificKeyword.some(keyword =>
        message.includes(keyword.toLowerCase()),
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Проверка стадии отношений
    if (triggers.relationshipStage) {
      const currentStageValue = this.getRelationshipStageValue(context.character.relationshipStage);
      if (
        (triggers.relationshipStage.min && currentStageValue < triggers.relationshipStage.min) ||
        (triggers.relationshipStage.max && currentStageValue > triggers.relationshipStage.max)
      ) {
        return false;
      }
    }

    // Проверка значений потребностей
    if (triggers.needValue && context.currentNeeds) {
      const targetNeed = context.currentNeeds.find(
        need => String(need.type) === String(triggers.needValue.need),
      );
      if (targetNeed) {
        const needValue = targetNeed.currentValue;
        if (
          (triggers.needValue.min !== undefined && needValue < triggers.needValue.min) ||
          (triggers.needValue.max !== undefined && needValue > triggers.needValue.max)
        ) {
          return false;
        }
      } else {
        // Если потребность не найдена, считаем условие невыполненным
        return false;
      }
    }

    // Проверка времени с последнего взаимодействия
    if (triggers.timeSinceLastInteraction && context.timeSinceLastInteraction !== undefined) {
      if (context.timeSinceLastInteraction < triggers.timeSinceLastInteraction) {
        return false;
      }
    }

    // Проверка длины разговора
    if (triggers.conversationLength && context.conversationLength !== undefined) {
      if (context.conversationLength < triggers.conversationLength) {
        return false;
      }
    }

    // Проверка эмоционального состояния из анализа сообщений
    if (triggers.emotionalState && context.messageAnalysis?.emotionalAnalysis) {
      const userMood = context.messageAnalysis.emotionalAnalysis.userMood;
      if (
        triggers.emotionalState.required &&
        !triggers.emotionalState.required.includes(userMood)
      ) {
        return false;
      }
      if (triggers.emotionalState.excluded && triggers.emotionalState.excluded.includes(userMood)) {
        return false;
      }
    }

    // Проверка уровня доверия
    if (triggers.trustLevel) {
      const trust = context.character.trust;
      if (
        (triggers.trustLevel.min !== undefined && trust < triggers.trustLevel.min) ||
        (triggers.trustLevel.max !== undefined && trust > triggers.trustLevel.max)
      ) {
        return false;
      }
    }

    // Если все проверки пройдены
    return true;
  }

  /**
   * Применяет эффекты события к персонажу и сохраняет прогресс.
   * @private
   */
  private async applyEvent(
    event: StoryEvent,
    character: Character,
    context: IStoryContext,
  ): Promise<void> {
    this.logInfo(`Применение события "${event.name}" для персонажа ${character.name}`);

    // Применяем эффекты
    await this.applyEffects(character, event.effects, context);

    // Сохраняем измененного персонажа
    await this.characterRepository.save(character);

    // Сохраняем прогресс с подробным контекстом
    const eventData = {
      message: `Событие "${event.name}" активировано`,
      trigger: event.triggers,
      context: {
        userMessage: context.lastUserMessage,
        relationshipStage: character.relationshipStage,
        trust: character.trust,
        timestamp: new Date().toISOString(),
      },
    };

    const progress = this.progressRepository.create({
      character,
      storyEvent: event,
      eventData,
    });
    await this.progressRepository.save(progress);

    this.logInfo(`Событие "${event.name}" успешно применено к персонажу ${character.name}`);
  }

  /**
   * Непосредственно изменяет состояние персонажа на основе эффектов.
   * @private
   */
  private async applyEffects(
    character: Character,
    effects: IStoryEventEffect,
    context: IStoryContext,
  ): Promise<void> {
    // Изменение отношений
    if (effects.relationshipChange) {
      character.trust = Math.max(0, Math.min(100, character.trust + effects.relationshipChange));
      this.logDebug(
        `Доверие персонажа изменено на ${effects.relationshipChange}, новое значение: ${character.trust}`,
      );
    }

    // Изменение привязанности
    if (effects.affectionChange) {
      character.affection = Math.max(
        0,
        Math.min(100, character.affection + effects.affectionChange),
      );
      this.logDebug(
        `Привязанность персонажа изменена на ${effects.affectionChange}, новое значение: ${character.affection}`,
      );
    }

    // Изменение личности
    if (effects.personalityChange) {
      if (effects.personalityChange.addTrait) {
        const newTraits = effects.personalityChange.addTrait.filter(
          trait => !character.personality.traits.includes(trait),
        );
        character.personality.traits.push(...newTraits);
        this.logDebug(`Добавлены черты личности: ${newTraits.join(', ')}`);
      }

      if (effects.personalityChange.removeTrait) {
        character.personality.traits = character.personality.traits.filter(
          trait => !effects.personalityChange.removeTrait.includes(trait),
        );
        this.logDebug(
          `Удалены черты личности: ${effects.personalityChange.removeTrait.join(', ')}`,
        );
      }
    }

    // Изменение потребностей
    if (effects.needChange && context.currentNeeds) {
      for (const needEffect of effects.needChange) {
        const need = context.currentNeeds.find(n => String(n.type) === String(needEffect.need));
        if (need) {
          const oldValue = need.currentValue;
          need.currentValue = Math.max(
            0,
            Math.min(need.maxValue, need.currentValue + needEffect.value),
          );
          await this.needRepository.save(need);
          this.logDebug(
            `Потребность ${needEffect.need} изменена с ${oldValue} на ${need.currentValue}`,
          );
        }
      }
    }

    // Изменение энергии
    if (effects.energyChange) {
      character.energy = Math.max(0, Math.min(100, character.energy + effects.energyChange));
      this.logDebug(
        `Энергия персонажа изменена на ${effects.energyChange}, новое значение: ${character.energy}`,
      );
    }

    // Изменение стадии отношений
    if (effects.relationshipStageChange) {
      const currentStageValue = this.getRelationshipStageValue(character.relationshipStage);
      const newStageValue = currentStageValue + effects.relationshipStageChange;
      character.relationshipStage = this.getRelationshipStageByValue(newStageValue);
      this.logDebug(`Стадия отношений изменена на: ${character.relationshipStage}`);
    }

    // Добавление воспоминаний
    if (effects.addMemory) {
      // Здесь можно интегрироваться с MemoryService для добавления важных воспоминаний
      this.logDebug(`Добавлено воспоминание: ${effects.addMemory}`);
    }
  }

  /**
   * Вспомогательная функция для преобразования стадии отношений в числовое значение.
   * @private
   */
  private getRelationshipStageValue(stage: string): number {
    const stageMap: Record<string, number> = {
      acquaintance: 10,
      friendship: 30,
      romance: 60,
      commitment: 90,
    };
    const stageKey = stage.toLowerCase();
    return stageKey in stageMap ? stageMap[stageKey] : 0;
  }

  /**
   * Вспомогательная функция для получения стадии отношений по числовому значению.
   * @private
   */
  private getRelationshipStageByValue(value: number): RelationshipStage {
    if (value >= 90) return RelationshipStage.COMMITMENT;
    if (value >= 60) return RelationshipStage.ROMANCE;
    if (value >= 30) return RelationshipStage.FRIENDSHIP;
    return RelationshipStage.ACQUAINTANCE;
  }
}
