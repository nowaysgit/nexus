import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryEvent, EventType, EventStatus } from '../entities/story-event.entity';
import {
  StoryPlan,
  StoryMilestone,
  TransformationType,
  MilestoneStatus,
} from '../entities/story-plan.entity';
import { CharacterService } from './character.service';
import { DialogService } from '../../dialog/services/dialog.service';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';

// Интерфейс для стадий отношений
export enum RelationshipStage {
  STRANGER = 'stranger',
  ACQUAINTANCE = 'acquaintance',
  FRIEND = 'friend',
  CLOSE_FRIEND = 'close_friend',
  ROMANCE = 'romance',
  COMMITMENT = 'commitment',
}

@Injectable()
export class StoryService extends BaseService {
  constructor(
    @InjectRepository(StoryEvent)
    private readonly storyEventRepository: Repository<StoryEvent>,
    @InjectRepository(StoryPlan)
    private readonly storyPlanRepository: Repository<StoryPlan>,
    @InjectRepository(StoryMilestone)
    private readonly storyMilestoneRepository: Repository<StoryMilestone>,
    private readonly characterService: CharacterService,
    private readonly dialogService: DialogService,
    logService: LogService,
  ) {
    super(logService);
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ СОБЫТИЯМИ =====

  async createStoryEvent(characterId: number, eventData: Partial<StoryEvent>): Promise<StoryEvent> {
    return this.withErrorHandling('создании сюжетного события', async () => {
      // Проверяем существование персонажа
      await this.characterService.findOne(characterId);

      const storyEvent = this.storyEventRepository.create({
        ...eventData,
        characterId,
        status: EventStatus.PENDING,
      });

      const savedEvent = await this.storyEventRepository.save(storyEvent);
      this.logInfo(`Создано сюжетное событие ${savedEvent.id} для персонажа ${characterId}`);

      return savedEvent;
    });
  }

  async findPendingEvents(characterId: number): Promise<StoryEvent[]> {
    return this.withErrorHandling('поиске ожидающих событий', async () => {
      return await this.storyEventRepository.find({
        where: { characterId, status: EventStatus.PENDING },
        order: { createdAt: 'ASC' },
      });
    });
  }

  async findTriggeredEvents(characterId: number): Promise<StoryEvent[]> {
    return this.withErrorHandling('поиске активированных событий', async () => {
      return await this.storyEventRepository.find({
        where: { characterId, status: EventStatus.TRIGGERED },
        order: { triggeredAt: 'DESC' },
      });
    });
  }

  async completeEvent(eventId: number): Promise<StoryEvent> {
    return this.withErrorHandling('завершении события', async () => {
      const event = await this.storyEventRepository.findOne({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error(`Событие с ID ${eventId} не найдено`);
      }

      event.status = EventStatus.COMPLETED;
      event.completedAt = new Date();

      const savedEvent = await this.storyEventRepository.save(event);
      this.logInfo(`Событие ${eventId} помечено как завершенное`);

      return savedEvent;
    });
  }

  async skipEvent(eventId: number): Promise<StoryEvent> {
    return this.withErrorHandling('пропуске события', async () => {
      const event = await this.storyEventRepository.findOne({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error(`Событие с ID ${eventId} не найдено`);
      }

      event.status = EventStatus.SKIPPED;

      const savedEvent = await this.storyEventRepository.save(event);
      this.logInfo(`Событие ${eventId} пропущено`);

      return savedEvent;
    });
  }

  async updateEventStatus(eventId: number, status: EventStatus): Promise<StoryEvent> {
    return this.withErrorHandling('обновлении статуса события', async () => {
      const event = await this.storyEventRepository.findOne({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error(`Событие с ID ${eventId} не найдено`);
      }

      event.status = status;

      if (status === EventStatus.TRIGGERED) {
        event.triggeredAt = new Date();
      } else if (status === EventStatus.COMPLETED) {
        event.completedAt = new Date();
      }

      const savedEvent = await this.storyEventRepository.save(event);
      this.logInfo(`Статус события ${eventId} обновлен на ${status}`);

      return savedEvent;
    });
  }

  async deleteEvent(eventId: number): Promise<void> {
    return this.withErrorHandling('удалении события', async () => {
      const result = await this.storyEventRepository.delete(eventId);

      if (result.affected === 0) {
        throw new Error(`Событие с ID ${eventId} не найдено`);
      }

      this.logInfo(`Событие ${eventId} удалено`);
    });
  }

  async getEventsByType(characterId: number, eventType: EventType): Promise<StoryEvent[]> {
    return this.withErrorHandling('поиске событий по типу', async () => {
      return await this.storyEventRepository.find({
        where: { characterId, type: eventType },
        order: { createdAt: 'DESC' },
      });
    });
  }

  async getEventHistory(characterId: number, limit: number = 10): Promise<StoryEvent[]> {
    return this.withErrorHandling('получении истории событий', async () => {
      return await this.storyEventRepository.find({
        where: { characterId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    });
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ ТРИГГЕРАМИ =====

  async checkEventTriggers(
    characterId: number,
    dialogId: number,
    relationshipStage?: RelationshipStage,
    interactionCount?: number,
  ): Promise<StoryEvent[]> {
    return this.withErrorHandling('проверке триггеров событий', async () => {
      const pendingEvents = await this.findPendingEvents(characterId);
      const triggeredEvents: StoryEvent[] = [];

      for (const event of pendingEvents) {
        if (await this.shouldTriggerEvent(event, relationshipStage, interactionCount)) {
          const triggeredEvent = await this.triggerEvent(event, dialogId);
          triggeredEvents.push(triggeredEvent);
        }
      }

      if (triggeredEvents.length > 0) {
        this.logInfo(`Активировано ${triggeredEvents.length} событий для персонажа ${characterId}`);
      }

      return triggeredEvents;
    });
  }

  private async shouldTriggerEvent(
    event: StoryEvent,
    relationshipStage?: RelationshipStage,
    interactionCount?: number,
  ): Promise<boolean> {
    return this.withErrorHandling('проверке условий триггера', async () => {
      const triggers = event.triggers;

      // Проверка стадии отношений
      if (
        triggers.relationshipStage &&
        relationshipStage &&
        relationshipStage.toString() !== triggers.relationshipStage
      ) {
        return false;
      }

      // Проверка количества сообщений
      if (
        triggers.messageCount &&
        (!interactionCount || interactionCount < triggers.messageCount)
      ) {
        return false;
      }

      // Проверка вероятности
      if (triggers.probability) {
        const random = Math.random();
        if (random > triggers.probability) {
          return false;
        }
      }

      return true;
    });
  }

  private async triggerEvent(event: StoryEvent, _dialogId: number): Promise<StoryEvent> {
    return this.withErrorHandling('активации события', async () => {
      event.status = EventStatus.TRIGGERED;
      event.triggeredAt = new Date();

      const savedEvent = await this.storyEventRepository.save(event);
      await this.applyEventEffects(event);

      return savedEvent;
    });
  }

  private async applyEventEffects(event: StoryEvent): Promise<void> {
    return this.withErrorHandling('применении эффектов события', async () => {
      if (!event.effects || Object.keys(event.effects).length === 0) {
        this.logDebug(`Событие ${event.id} не имеет эффектов для применения`);
        return;
      }

      // Применяем эффекты к персонажу
      const character = await this.characterService.findOne(event.characterId);
      if (!character) {
        throw new Error(`Персонаж с ID ${event.characterId} не найден`);
      }

      const appliedEffects: string[] = [];

      // Применяем изменения уровня привязанности
      if (event.effects.affectionChange !== undefined) {
        // В будущем можно интегрировать с системой отношений
        appliedEffects.push(
          `привязанность: ${event.effects.affectionChange > 0 ? '+' : ''}${event.effects.affectionChange}`,
        );
      }

      // Применяем изменения уровня доверия
      if (event.effects.trustChange !== undefined) {
        // В будущем можно интегрировать с системой отношений
        appliedEffects.push(
          `доверие: ${event.effects.trustChange > 0 ? '+' : ''}${event.effects.trustChange}`,
        );
      }

      // Применяем изменения стадии отношений
      if (event.effects.relationshipStageChange) {
        appliedEffects.push(`стадия отношений: ${event.effects.relationshipStageChange}`);
      }

      // Применяем изменения потребностей
      if (event.effects.needsChanges && Object.keys(event.effects.needsChanges).length > 0) {
        for (const [needType, change] of Object.entries(event.effects.needsChanges)) {
          appliedEffects.push(`потребность ${needType}: ${change > 0 ? '+' : ''}${change}`);
        }
      }

      // Применяем изменения личности
      if (
        event.effects.personalityChanges &&
        Object.keys(event.effects.personalityChanges).length > 0
      ) {
        for (const [trait, change] of Object.entries(event.effects.personalityChanges)) {
          appliedEffects.push(`черта ${trait}: ${change > 0 ? '+' : ''}${change}`);
        }
      }

      this.logInfo(`Применены эффекты события ${event.id}: ${appliedEffects.join(', ')}`);
    });
  }

  async createEventTriggers(characterId: number): Promise<void> {
    return this.withErrorHandling('создании триггеров событий', async () => {
      await this.createRelationshipTriggers(characterId);
      await this.createInteractionTriggers(characterId);
      await this.createTimedTriggers(characterId);
    });
  }

  private async createRelationshipTriggers(characterId: number): Promise<void> {
    return this.withErrorHandling('создании триггеров отношений', async () => {
      const relationshipEvents = [
        {
          title: 'Переход к дружбе',
          description: 'Персонаж готов к более близким отношениям',
          type: EventType.RELATIONSHIP_MILESTONE,
          triggers: { relationshipStage: RelationshipStage.FRIEND },
        },
        {
          title: 'Романтический интерес',
          description: 'Развитие романтических чувств',
          type: EventType.RELATIONSHIP_MILESTONE,
          triggers: { relationshipStage: RelationshipStage.ROMANCE },
        },
      ];

      for (const eventData of relationshipEvents) {
        await this.createStoryEvent(characterId, eventData);
      }
    });
  }

  private async createInteractionTriggers(characterId: number): Promise<void> {
    return this.withErrorHandling('создании триггеров взаимодействий', async () => {
      const interactionEvents = [
        {
          title: 'Эмоциональное раскрытие',
          description: 'Персонаж готов поделиться личными переживаниями',
          type: EventType.PERSONAL_CHANGE,
          triggers: { messageCount: 50 },
        },
        {
          title: 'Глубокое доверие',
          description: 'Установление глубокого доверия между персонажами',
          type: EventType.PERSONAL_CHANGE,
          triggers: { messageCount: 100 },
        },
      ];

      for (const eventData of interactionEvents) {
        await this.createStoryEvent(characterId, eventData);
      }
    });
  }

  private async createTimedTriggers(characterId: number): Promise<void> {
    return this.withErrorHandling('создании временных триггеров', async () => {
      const timedEvents = [
        {
          title: 'Кризис роста',
          description: 'Персонаж переживает внутренний кризис',
          type: EventType.CRISIS,
          triggers: { daysPassed: 30, probability: 0.3 },
        },
      ];

      for (const eventData of timedEvents) {
        await this.createStoryEvent(characterId, eventData);
      }
    });
  }

  async checkMilestoneEvents(
    characterId: number,
    _currentStage: RelationshipStage,
    _interactionCount: number,
  ): Promise<StoryEvent[]> {
    return this.withErrorHandling('проверке событий вех', async () => {
      return await this.storyEventRepository.find({
        where: { characterId, type: EventType.RELATIONSHIP_MILESTONE, status: EventStatus.PENDING },
      });
    });
  }

  async createDefaultEvents(characterId: number): Promise<StoryEvent[]> {
    return this.withErrorHandling('создании событий по умолчанию', async () => {
      await this.createEventTriggers(characterId);
      return await this.findPendingEvents(characterId);
    });
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ ПЛАНАМИ =====

  async createTwelveMonthPlan(
    characterId: number,
    planData: Partial<StoryPlan>,
  ): Promise<StoryPlan> {
    return this.withErrorHandling('создании 12-месячного плана', async () => {
      // Проверяем существование персонажа
      await this.characterService.findOne(characterId);

      const storyPlan = this.storyPlanRepository.create({
        ...planData,
        characterId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 год
      });

      const savedPlan = await this.storyPlanRepository.save(storyPlan);
      this.logInfo(`Создан 12-месячный план ${savedPlan.id} для персонажа ${characterId}`);

      // Создаем ключевые вехи трансформации
      await this.createKeyTransformationMilestones(savedPlan.id);

      return savedPlan;
    });
  }

  async createMilestone(
    storyPlanId: number,
    milestoneData: Partial<StoryMilestone>,
  ): Promise<StoryMilestone> {
    return this.withErrorHandling('создании вехи', async () => {
      const milestone = this.storyMilestoneRepository.create({
        ...milestoneData,
        storyPlanId,
        status: MilestoneStatus.PLANNED,
      });

      const savedMilestone = await this.storyMilestoneRepository.save(milestone);
      this.logInfo(`Создана веха ${savedMilestone.id} для плана ${storyPlanId}`);

      return savedMilestone;
    });
  }

  async getCharacterPlan(characterId: number): Promise<StoryPlan | null> {
    return this.withErrorHandling('получении плана персонажа', async () => {
      return await this.storyPlanRepository.findOne({
        where: { characterId },
        relations: ['milestones'],
      });
    });
  }

  async getUpcomingMilestones(
    characterId: number,
    daysAhead: number = 30,
  ): Promise<StoryMilestone[]> {
    return this.withErrorHandling('получении предстоящих вех', async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      return await this.storyMilestoneRepository.find({
        where: {
          characterId,
          status: MilestoneStatus.PLANNED,
        },
        order: { plannedDay: 'ASC' },
        take: 10,
      });
    });
  }

  async checkMilestoneProgress(characterId: number): Promise<StoryMilestone[]> {
    return this.withErrorHandling('проверке прогресса вех', async () => {
      const milestones = await this.storyMilestoneRepository.find({
        where: { characterId },
      });

      const now = new Date();
      const readyMilestones: StoryMilestone[] = [];

      for (const milestone of milestones) {
        if (milestone.status === MilestoneStatus.PLANNED && milestone.plannedDay <= now.getDate()) {
          // Активируем веху
          milestone.status = MilestoneStatus.IN_PROGRESS;
          await this.storyMilestoneRepository.save(milestone);
          readyMilestones.push(milestone);
        }
      }

      if (readyMilestones.length > 0) {
        this.logInfo(`Активировано ${readyMilestones.length} вех для персонажа ${characterId}`);
      }

      return readyMilestones;
    });
  }

  async triggerMilestone(milestoneId: number): Promise<StoryMilestone> {
    return this.withErrorHandling('активации вехи', async () => {
      const milestone = await this.storyMilestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (!milestone) {
        throw new Error(`Веха с ID ${milestoneId} не найдена`);
      }

      milestone.status = MilestoneStatus.IN_PROGRESS;
      milestone.achievedAt = new Date();

      const savedMilestone = await this.storyMilestoneRepository.save(milestone);
      this.logInfo(`Веха ${milestoneId} активирована`);

      // Применяем эффекты трансформации
      await this.applyTransformationEffects(milestone);

      return savedMilestone;
    });
  }

  async completeMilestone(
    milestoneId: number,
    actualResults: Record<string, unknown>,
  ): Promise<StoryMilestone> {
    return this.withErrorHandling('завершении вехи', async () => {
      const milestone = await this.storyMilestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (!milestone) {
        throw new Error(`Веха с ID ${milestoneId} не найдена`);
      }

      milestone.status = MilestoneStatus.ACHIEVED;
      milestone.achievedAt = new Date();
      milestone.actualResults = actualResults;

      const savedMilestone = await this.storyMilestoneRepository.save(milestone);
      this.logInfo(`Веха ${milestoneId} завершена`);

      // Обрабатываем каузальные связи
      await this.processCausalConnections(milestone);

      return savedMilestone;
    });
  }

  async adaptMilestone(
    milestoneId: number,
    adaptations: Partial<StoryMilestone>,
  ): Promise<StoryMilestone> {
    return this.withErrorHandling('адаптации вехи', async () => {
      const milestone = await this.storyMilestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (!milestone) {
        throw new Error(`Веха с ID ${milestoneId} не найдена`);
      }

      Object.assign(milestone, adaptations);
      milestone.status = MilestoneStatus.MODIFIED;

      const savedMilestone = await this.storyMilestoneRepository.save(milestone);
      this.logInfo(`Веха ${milestoneId} адаптирована`);

      return savedMilestone;
    });
  }

  private async applyTransformationEffects(milestone: StoryMilestone): Promise<void> {
    return this.withErrorHandling('применении эффектов трансформации', async () => {
      if (!milestone.transformationDetails) {
        this.logDebug(`Веха ${milestone.id} не имеет деталей трансформации для применения`);
        return;
      }

      // Получаем персонажа для применения трансформации
      const character = await this.characterService.findOne(milestone.characterId);
      if (!character) {
        throw new Error(`Персонаж с ID ${milestone.characterId} не найден`);
      }

      const appliedTransformations: string[] = [];

      // Применяем трансформацию на основе типа
      switch (milestone.transformationType) {
        case TransformationType.EMOTIONAL_MATURITY:
          appliedTransformations.push('эмоциональная зрелость');
          break;
        case TransformationType.BEHAVIOR_PATTERN_CHANGE:
          appliedTransformations.push('изменение поведенческих паттернов');
          break;
        case TransformationType.PERSONALITY_CHANGE:
          appliedTransformations.push('изменение личности');
          break;
        case TransformationType.RELATIONSHIP_DYNAMIC_CHANGE:
          appliedTransformations.push('эволюция отношений');
          break;
        case TransformationType.WORLDVIEW_SHIFT:
          appliedTransformations.push('сдвиг мировоззрения');
          break;
        case TransformationType.EXISTENTIAL_AWARENESS:
          appliedTransformations.push('экзистенциальное осознание');
          break;
        case TransformationType.VALUE_SYSTEM_EVOLUTION:
          appliedTransformations.push('эволюция системы ценностей');
          break;
        default:
          appliedTransformations.push('общая трансформация');
      }

      // Обновляем прогресс трансформации
      if (milestone.transformationDetails.progressIndicators) {
        for (const indicator of milestone.transformationDetails.progressIndicators) {
          appliedTransformations.push(`прогресс: ${indicator}`);
        }
      }

      this.logInfo(
        `Применены эффекты трансформации для вехи ${milestone.id}: ${appliedTransformations.join(', ')}`,
      );
    });
  }

  private async processCausalConnections(milestone: StoryMilestone): Promise<void> {
    return this.withErrorHandling('обработке каузальных связей', async () => {
      const connections = milestone.causalConnections;
      if (connections && connections.consequenceEvents) {
        for (const eventId of connections.consequenceEvents) {
          await this.triggerConnectedEvent(eventId, milestone.id);
        }
      }
    });
  }

  private async triggerConnectedEvent(
    eventId: number,
    triggeredByMilestoneId: number,
  ): Promise<void> {
    return this.withErrorHandling('активации связанного события', async () => {
      const event = await this.storyEventRepository.findOne({
        where: { id: eventId },
      });

      if (event) {
        event.status = EventStatus.TRIGGERED;
        event.triggeredAt = new Date();

        await this.storyEventRepository.save(event);
        this.logInfo(`Событие ${eventId} активировано вехой ${triggeredByMilestoneId}`);
      }
    });
  }

  // ===== МЕТОДЫ ГЕНЕРАЦИИ ПЛАНОВ =====

  async generatePersonalityEvolutionPlan(characterId: number): Promise<StoryPlan> {
    return this.withErrorHandling('генерации плана эволюции личности', async () => {
      const planData = {
        title: 'План эволюции личности',
        description: 'Долгосрочный план развития и трансформации личности персонажа',
        overallArc: {
          startingState: {},
          endingState: {},
          majorThemes: ['личностный рост', 'эмоциональное развитие', 'адаптация поведения'],
          evolutionDirection: 'прогрессивная трансформация',
        },
        retrospectivePlanning: {
          preExistingTraits: {},
          formativeEvents: [],
          characterHistory: '',
          pastInfluences: [],
        },
        adaptabilitySettings: {
          coreEventsRigidity: 7,
          detailsFlexibility: 8,
          userInfluenceWeight: 6,
          emergentEventTolerance: 5,
        },
      };

      return await this.createTwelveMonthPlan(characterId, planData);
    });
  }

  private async createKeyTransformationMilestones(storyPlanId: number): Promise<void> {
    return this.withErrorHandling('создании ключевых вех трансформации', async () => {
      const milestones = [
        {
          title: 'Эмоциональный сдвиг',
          description: 'Изменение эмоциональных реакций и паттернов',
          transformationType: TransformationType.EMOTIONAL_MATURITY,
          plannedMonth: 3,
          plannedDay: 15,
        },
        {
          title: 'Поведенческие изменения',
          description: 'Адаптация поведенческих паттернов',
          transformationType: TransformationType.BEHAVIOR_PATTERN_CHANGE,
          plannedMonth: 6,
          plannedDay: 30,
        },
        {
          title: 'Эволюция личности',
          description: 'Глубокие изменения в структуре личности',
          transformationType: TransformationType.PERSONALITY_CHANGE,
          plannedMonth: 12,
          plannedDay: 31,
        },
      ];

      for (const milestoneData of milestones) {
        await this.createMilestone(storyPlanId, {
          ...milestoneData,
          transformationDetails: {
            currentState: {},
            targetState: {},
            progressIndicators: [],
            prerequisiteEvents: [],
            transitionMethod: 'gradual',
          },
          causalConnections: {
            triggeringConditions: [],
            consequenceEvents: [],
            timelineConstraints: {},
          },
          rigidityLevel: 5,
          isKeyMilestone: true,
        });
      }
    });
  }
}
