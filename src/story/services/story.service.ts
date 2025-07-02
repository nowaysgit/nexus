import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryEvent, IStoryEventTrigger, IStoryEventEffect } from '../entities/story-event.entity';
import { CharacterStoryProgress } from '../entities/character-story-progress.entity';
import { Character } from '../../character/entities/character.entity';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';

/**
 * Контекст для проверки триггеров событий.
 */
export interface IStoryContext {
  character: Character;
  lastUserMessage?: string;
  // Другие релевантные данные, например, из MessageAnalysis
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

      for (const event of eventsToCheck) {
        if (this.areTriggersMet(event.triggers, context)) {
          await this.applyEvent(event, character);
        }
      }
    });
  }

  /**
   * Проверяет, выполнены ли условия триггеров.
   * @private
   */
  private areTriggersMet(triggers: IStoryEventTrigger, context: IStoryContext): boolean {
    // Проверка ключевых слов
    if (triggers.specificKeyword && context.lastUserMessage) {
      const message = context.lastUserMessage.toLowerCase();
      if (!triggers.specificKeyword.some(keyword => message.includes(keyword.toLowerCase()))) {
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

    // TODO: Добавить другие проверки триггеров (потребности и т.д.)

    // Если все проверки пройдены
    return true;
  }

  /**
   * Применяет эффекты события к персонажу и сохраняет прогресс.
   * @private
   */
  private async applyEvent(event: StoryEvent, character: Character): Promise<void> {
    this.logInfo(`Применение события "${event.name}" для персонажа ${character.name}`);

    // Применяем эффекты
    this.applyEffects(character, event.effects);

    // Сохраняем измененного персонажа
    await this.characterRepository.save(character);

    // Сохраняем прогресс
    const progress = this.progressRepository.create({
      character,
      storyEvent: event,
      eventData: { message: 'Событие активировано' }, // TODO: Сохранять реальный контекст
    });
    await this.progressRepository.save(progress);

    // TODO: Здесь может быть логика по сохранению измененного персонажа.
    // Это зависит от того, как управляются сущности в приложении (Unit of Work и т.д.)
  }

  /**
   * Непосредственно изменяет состояние персонажа на основе эффектов.
   * @private
   */
  private applyEffects(character: Character, effects: IStoryEventEffect): void {
    if (effects.relationshipChange) {
      character.trust += effects.relationshipChange; // Упрощенный пример
    }

    if (effects.personalityChange) {
      if (effects.personalityChange.addTrait) {
        character.personality.traits.push(...effects.personalityChange.addTrait);
      }
      if (effects.personalityChange.removeTrait) {
        character.personality.traits = character.personality.traits.filter(
          trait => !effects.personalityChange.removeTrait.includes(trait),
        );
      }
    }

    // TODO: Добавить применение других эффектов (потребности и т.д.)
  }

  /**
   * Вспомогательная функция для преобразования стадии отношений в числовое значение.
   * @private
   */
  private getRelationshipStageValue(stage: string): number {
    const stageMap = {
      acquaintance: 10,
      friendship: 30,
      romance: 60,
      commitment: 90,
    };
    return stageMap[stage.toLowerCase()] || 0;
  }
}
