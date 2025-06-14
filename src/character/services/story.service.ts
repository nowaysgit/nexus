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
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

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
export class StoryService {
  constructor(
    @InjectRepository(StoryEvent)
    private readonly storyEventRepository: Repository<StoryEvent>,
    @InjectRepository(StoryPlan)
    private readonly storyPlanRepository: Repository<StoryPlan>,
    @InjectRepository(StoryMilestone)
    private readonly storyMilestoneRepository: Repository<StoryMilestone>,
    private readonly characterService: CharacterService,
    private readonly dialogService: DialogService,
    private readonly logService: LogService,
  ) {
    this.logService.log('Расширенный сервис сюжетных событий и планирования инициализирован');
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ СОБЫТИЯМИ =====

  async createStoryEvent(characterId: number, eventData: Partial<StoryEvent>): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
        // Проверяем существование персонажа
        await this.characterService.findOne(characterId);

        const storyEvent = this.storyEventRepository.create({
          ...eventData,
          characterId,
          status: EventStatus.PENDING,
        });

        const savedEvent = await this.storyEventRepository.save(storyEvent);
        this.logService.log(
          `Создано сюжетное событие ${savedEvent.id} для персонажа ${characterId}`,
        );

        return savedEvent;
      },
      'создании сюжетного события',
      this.logService,
      { characterId, eventType: eventData.type },
      null as never,
    );
  }

  async findPendingEvents(characterId: number): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        return await this.storyEventRepository.find({
          where: { characterId, status: EventStatus.PENDING },
          order: { createdAt: 'ASC' },
        });
      },
      'поиске ожидающих событий',
      this.logService,
      { characterId },
      [],
    );
  }

  async findTriggeredEvents(characterId: number): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        return await this.storyEventRepository.find({
          where: { characterId, status: EventStatus.TRIGGERED },
          order: { triggeredAt: 'DESC' },
        });
      },
      'поиске активированных событий',
      this.logService,
      { characterId },
      [],
    );
  }

  async completeEvent(eventId: number): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
        const event = await this.storyEventRepository.findOne({
          where: { id: eventId },
        });

        if (!event) {
          throw new Error(`Событие с ID ${eventId} не найдено`);
        }

        event.status = EventStatus.COMPLETED;
        event.completedAt = new Date();

        const savedEvent = await this.storyEventRepository.save(event);
        this.logService.log(`Событие ${eventId} помечено как завершенное`);

        return savedEvent;
      },
      'завершении события',
      this.logService,
      { eventId },
      null as never,
    );
  }

  async skipEvent(eventId: number): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
        const event = await this.storyEventRepository.findOne({
          where: { id: eventId },
        });

        if (!event) {
          throw new Error(`Событие с ID ${eventId} не найдено`);
        }

        event.status = EventStatus.SKIPPED;

        const savedEvent = await this.storyEventRepository.save(event);
        this.logService.log(`Событие ${eventId} пропущено`);

        return savedEvent;
      },
      'пропуске события',
      this.logService,
      { eventId },
      null as never,
    );
  }

  async updateEventStatus(eventId: number, status: EventStatus): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
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
        this.logService.log(`Статус события ${eventId} обновлен на ${status}`);

        return savedEvent;
      },
      'обновлении статуса события',
      this.logService,
      { eventId, status },
      null as never,
    );
  }

  async deleteEvent(eventId: number): Promise<void> {
    return withErrorHandling(
      async () => {
        const result = await this.storyEventRepository.delete(eventId);

        if (result.affected === 0) {
          throw new Error(`Событие с ID ${eventId} не найдено`);
        }

        this.logService.log(`Событие ${eventId} удалено`);
      },
      'удалении события',
      this.logService,
      { eventId },
      undefined,
    );
  }

  async getEventsByType(characterId: number, eventType: EventType): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        return await this.storyEventRepository.find({
          where: { characterId, type: eventType },
          order: { createdAt: 'DESC' },
        });
      },
      'поиске событий по типу',
      this.logService,
      { characterId, eventType },
      [],
    );
  }

  async getEventHistory(characterId: number, limit: number = 10): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        return await this.storyEventRepository.find({
          where: { characterId },
          order: { createdAt: 'DESC' },
          take: limit,
        });
      },
      'получении истории событий',
      this.logService,
      { characterId, limit },
      [],
    );
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ ТРИГГЕРАМИ =====

  async checkEventTriggers(
    characterId: number,
    dialogId: number,
    relationshipStage?: RelationshipStage,
    interactionCount?: number,
  ): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        const pendingEvents = await this.findPendingEvents(characterId);
        const triggeredEvents: StoryEvent[] = [];

        for (const event of pendingEvents) {
          if (await this.shouldTriggerEvent(event, relationshipStage, interactionCount)) {
            const triggeredEvent = await this.triggerEvent(event, dialogId);
            triggeredEvents.push(triggeredEvent);
          }
        }

        if (triggeredEvents.length > 0) {
          this.logService.log(
            `Активировано ${triggeredEvents.length} событий для персонажа ${characterId}`,
          );
        }

        return triggeredEvents;
      },
      'проверке триггеров событий',
      this.logService,
      { characterId, dialogId },
      [],
    );
  }

  private async shouldTriggerEvent(
    event: StoryEvent,
    relationshipStage?: RelationshipStage,
    interactionCount?: number,
  ): Promise<boolean> {
    const conditions = event.triggers;
    if (!conditions) return false;

    // Проверка условий по стадии отношений
    if (conditions.relationshipStage && relationshipStage) {
      if (conditions.relationshipStage !== relationshipStage.toString()) {
        return false;
      }
    }

    // Проверка условий по количеству взаимодействий
    if (conditions.messageCount && interactionCount !== undefined) {
      if (interactionCount < conditions.messageCount) {
        return false;
      }
    }

    // Проверка временных условий
    if (conditions.daysPassed) {
      const now = new Date();
      const eventCreated = new Date(event.createdAt);
      const daysPassed = (now.getTime() - eventCreated.getTime()) / (1000 * 60 * 60 * 24);

      if (daysPassed < conditions.daysPassed) {
        return false;
      }
    }

    return true;
  }

  private async triggerEvent(event: StoryEvent, dialogId: number): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
        const triggeredEvent = await this.updateEventStatus(event.id, EventStatus.TRIGGERED);

        // Применяем эффекты события
        await this.applyEventEffects(triggeredEvent);

        this.logService.log(`Событие ${event.id} активировано для диалога ${dialogId}`);

        return triggeredEvent;
      },
      'активации события',
      this.logService,
      { eventId: event.id, dialogId },
      event,
    );
  }

  private async applyEventEffects(event: StoryEvent): Promise<void> {
    return withErrorHandling(
      async () => {
        if (!event.effects) return;

        // Логируем применение эффектов
        this.logService.log(`Применение эффектов события ${event.id}`, {
          effects: event.effects,
        });

        // Здесь можно добавить логику применения эффектов
        // Например, изменение характеристик персонажа, добавление воспоминаний и т.д.
      },
      'применении эффектов события',
      this.logService,
      { eventId: event.id },
      undefined,
    );
  }

  async createEventTriggers(characterId: number): Promise<void> {
    return withErrorHandling(
      async () => {
        // Создаем базовые триггеры для нового персонажа
        await this.createRelationshipTriggers(characterId);
        await this.createInteractionTriggers(characterId);
        await this.createTimedTriggers(characterId);

        this.logService.log(`Созданы триггеры событий для персонажа ${characterId}`);
      },
      'создании триггеров событий',
      this.logService,
      { characterId },
      undefined,
    );
  }

  private async createRelationshipTriggers(characterId: number): Promise<void> {
    const triggers = [
      {
        type: EventType.RELATIONSHIP_MILESTONE,
        title: 'Первый поцелуй',
        description: 'Романтический момент между персонажами',
        triggers: { relationshipStage: RelationshipStage.ROMANCE.toString() },
        effects: { affectionChange: 10, trustChange: 5 },
      },
      {
        type: EventType.RELATIONSHIP_MILESTONE,
        title: 'Официальные отношения',
        description: 'Персонажи становятся парой',
        triggers: { relationshipStage: RelationshipStage.COMMITMENT.toString() },
        effects: { affectionChange: 15, trustChange: 10 },
      },
    ];

    for (const trigger of triggers) {
      await this.createStoryEvent(characterId, trigger);
    }
  }

  private async createInteractionTriggers(characterId: number): Promise<void> {
    const triggers = [
      {
        type: EventType.CHARACTER_DEVELOPMENT,
        title: 'Открытие сердца',
        description: 'Персонаж делится личными переживаниями',
        triggers: { messageCount: 10 },
        effects: { trustChange: 8 },
      },
      {
        type: EventType.CHARACTER_DEVELOPMENT,
        title: 'Глубокая беседа',
        description: 'Серьезный разговор о будущем',
        triggers: { messageCount: 25 },
        effects: { affectionChange: 10 },
      },
    ];

    for (const trigger of triggers) {
      await this.createStoryEvent(characterId, trigger);
    }
  }

  private async createTimedTriggers(characterId: number): Promise<void> {
    const triggers = [
      {
        type: EventType.SPECIAL_OCCASION,
        title: 'Неожиданный подарок',
        description: 'Персонаж преподносит сюрприз',
        triggers: { daysPassed: 1 },
        effects: { affectionChange: 5 },
      },
      {
        type: EventType.SPECIAL_OCCASION,
        title: 'Спонтанное свидание',
        description: 'Внезапное приглашение на прогулку',
        triggers: { daysPassed: 3 },
        effects: { affectionChange: 8 },
      },
    ];

    for (const trigger of triggers) {
      await this.createStoryEvent(characterId, trigger);
    }
  }

  async checkMilestoneEvents(
    characterId: number,
    currentStage: RelationshipStage,
    interactionCount: number,
  ): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        const milestoneEvents: StoryEvent[] = [];

        // Проверяем события, связанные с текущей стадией отношений
        const stageEvents = await this.findPendingEvents(characterId);

        for (const event of stageEvents) {
          if (event.triggers?.relationshipStage === currentStage.toString()) {
            milestoneEvents.push(event);
          }
        }

        return milestoneEvents;
      },
      'проверке событий-вех',
      this.logService,
      { characterId, currentStage, interactionCount },
      [],
    );
  }

  async createDefaultEvents(characterId: number): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        // Создаем триггеры для нового персонажа
        await this.createEventTriggers(characterId);

        // Возвращаем созданные события
        return await this.findPendingEvents(characterId);
      },
      'создании базовых событий',
      this.logService,
      { characterId },
      [],
    );
  }

  // ===== МЕТОДЫ 12-МЕСЯЧНОГО ПЛАНИРОВАНИЯ СОГЛАСНО ТЗ СЮЖЕТ =====

  async createTwelveMonthPlan(
    characterId: number,
    planData: Partial<StoryPlan>,
  ): Promise<StoryPlan> {
    return withErrorHandling(
      async () => {
        // Проверяем существование персонажа
        await this.characterService.findOne(characterId);

        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const storyPlan = this.storyPlanRepository.create({
          ...planData,
          characterId,
          startDate,
          endDate,
          adaptabilitySettings: planData.adaptabilitySettings || {
            coreEventsRigidity: 8,
            detailsFlexibility: 6,
            userInfluenceWeight: 4,
            emergentEventTolerance: 5,
          },
        });

        const savedPlan = await this.storyPlanRepository.save(storyPlan);
        this.logService.log(`Создан 12-месячный план ${savedPlan.id} для персонажа ${characterId}`);

        return savedPlan;
      },
      'создании 12-месячного плана',
      this.logService,
      { characterId },
      null as never,
    );
  }

  async createMilestone(
    storyPlanId: number,
    milestoneData: Partial<StoryMilestone>,
  ): Promise<StoryMilestone> {
    return withErrorHandling(
      async () => {
        const storyPlan = await this.storyPlanRepository.findOne({
          where: { id: storyPlanId },
        });

        if (!storyPlan) {
          throw new Error(`План с ID ${storyPlanId} не найден`);
        }

        const milestone = this.storyMilestoneRepository.create({
          ...milestoneData,
          storyPlanId,
          characterId: storyPlan.characterId,
          status: MilestoneStatus.PLANNED,
        });

        const savedMilestone = await this.storyMilestoneRepository.save(milestone);
        this.logService.log(`Создана веха ${savedMilestone.id} для плана ${storyPlanId}`);

        return savedMilestone;
      },
      'создании вехи',
      this.logService,
      { storyPlanId },
      null as never,
    );
  }

  async getCharacterPlan(characterId: number): Promise<StoryPlan | null> {
    return withErrorHandling(
      async () => {
        return await this.storyPlanRepository.findOne({
          where: { characterId },
          relations: ['milestones'],
          order: { createdAt: 'DESC' },
        });
      },
      'получении плана персонажа',
      this.logService,
      { characterId },
      null,
    );
  }

  async getUpcomingMilestones(
    characterId: number,
    daysAhead: number = 30,
  ): Promise<StoryMilestone[]> {
    return withErrorHandling(
      async () => {
        const currentDay = Math.floor(
          (Date.now() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
        );
        const _targetDay = currentDay + daysAhead;

        return await this.storyMilestoneRepository.find({
          where: {
            characterId,
            status: MilestoneStatus.PLANNED,
          },
          order: { plannedDay: 'ASC' },
        });
      },
      'получении предстоящих вех',
      this.logService,
      { characterId, daysAhead },
      [],
    );
  }

  async checkMilestoneProgress(characterId: number): Promise<StoryMilestone[]> {
    return withErrorHandling(
      async () => {
        const currentDay = Math.floor(
          (Date.now() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
        );

        const readyMilestones = await this.storyMilestoneRepository.find({
          where: {
            characterId,
            status: MilestoneStatus.PLANNED,
          },
        });

        const triggeredMilestones: StoryMilestone[] = [];

        for (const milestone of readyMilestones) {
          if (milestone.plannedDay <= currentDay) {
            await this.triggerMilestone(milestone.id);
            triggeredMilestones.push(milestone);
          }
        }

        return triggeredMilestones;
      },
      'проверке прогресса вех',
      this.logService,
      { characterId },
      [],
    );
  }

  async triggerMilestone(milestoneId: number): Promise<StoryMilestone> {
    return withErrorHandling(
      async () => {
        const milestone = await this.storyMilestoneRepository.findOne({
          where: { id: milestoneId },
        });

        if (!milestone) {
          throw new Error(`Веха с ID ${milestoneId} не найдена`);
        }

        milestone.status = MilestoneStatus.IN_PROGRESS;
        const savedMilestone = await this.storyMilestoneRepository.save(milestone);

        // Применяем трансформационные эффекты
        await this.applyTransformationEffects(savedMilestone);

        this.logService.log(`Веха ${milestoneId} активирована`);
        return savedMilestone;
      },
      'активации вехи',
      this.logService,
      { milestoneId },
      null as never,
    );
  }

  async completeMilestone(
    milestoneId: number,
    actualResults: Record<string, unknown>,
  ): Promise<StoryMilestone> {
    return withErrorHandling(
      async () => {
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
        this.logService.log(`Веха ${milestoneId} завершена`);

        // Проверяем каузальные связи для активации следующих событий
        await this.processCausalConnections(savedMilestone);

        return savedMilestone;
      },
      'завершении вехи',
      this.logService,
      { milestoneId },
      null as never,
    );
  }

  async adaptMilestone(
    milestoneId: number,
    adaptations: Partial<StoryMilestone>,
  ): Promise<StoryMilestone> {
    return withErrorHandling(
      async () => {
        const milestone = await this.storyMilestoneRepository.findOne({
          where: { id: milestoneId },
        });

        if (!milestone) {
          throw new Error(`Веха с ID ${milestoneId} не найдена`);
        }

        // Проверяем уровень жесткости
        if (milestone.rigidityLevel > 7 && milestone.isKeyMilestone) {
          this.logService.warn(
            `Веха ${milestoneId} имеет высокий уровень жесткости, адаптация ограничена`,
          );
          // Разрешаем только минорные изменения
        }

        Object.assign(milestone, adaptations);
        milestone.status = MilestoneStatus.MODIFIED;

        const savedMilestone = await this.storyMilestoneRepository.save(milestone);
        this.logService.log(`Веха ${milestoneId} адаптирована`);

        return savedMilestone;
      },
      'адаптации вехи',
      this.logService,
      { milestoneId },
      null as never,
    );
  }

  private async applyTransformationEffects(milestone: StoryMilestone): Promise<void> {
    return withErrorHandling(
      async () => {
        const effects = milestone.transformationDetails;

        this.logService.log(`Применение трансформационных эффектов для вехи ${milestone.id}`, {
          transformationType: milestone.transformationType,
          effects,
        });

        // Логика применения трансформационных эффектов
        // Интеграция с CharacterService для изменения характеристик персонажа
      },
      'применении трансформационных эффектов',
      this.logService,
      { milestoneId: milestone.id },
      undefined,
    );
  }

  private async processCausalConnections(milestone: StoryMilestone): Promise<void> {
    return withErrorHandling(
      async () => {
        const connections = milestone.causalConnections;

        if (connections.consequenceEvents.length > 0) {
          for (const eventId of connections.consequenceEvents) {
            // Активируем связанные события
            await this.triggerConnectedEvent(eventId, milestone.id);
          }
        }

        this.logService.log(`Обработаны каузальные связи для вехи ${milestone.id}`);
      },
      'обработке каузальных связей',
      this.logService,
      { milestoneId: milestone.id },
      undefined,
    );
  }

  private async triggerConnectedEvent(
    eventId: number,
    triggeredByMilestoneId: number,
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        // Логика активации связанного события
        this.logService.log(
          `Активировано связанное событие ${eventId} из вехи ${triggeredByMilestoneId}`,
        );
      },
      'активации связанного события',
      this.logService,
      { eventId, triggeredByMilestoneId },
      undefined,
    );
  }

  async generatePersonalityEvolutionPlan(characterId: number): Promise<StoryPlan> {
    return withErrorHandling(
      async () => {
        const character = await this.characterService.findOne(characterId);

        const evolutionPlan = await this.createTwelveMonthPlan(characterId, {
          title: `План эволюции личности - ${character.name}`,
          description: 'Детальный план трансформации личности на 12 месяцев',
          overallArc: {
            startingState: {
              /* текущее состояние персонажа */
            },
            endingState: {
              /* целевое состояние через год */
            },
            majorThemes: ['self_discovery', 'emotional_growth', 'relationship_deepening'],
            evolutionDirection: 'progressive_maturation',
          },
          retrospectivePlanning: {
            preExistingTraits: {
              /* существующие черты */
            },
            formativeEvents: [
              {
                description: 'Детство и формирование базовых установок',
                timeframe: '0-18 лет',
                impact: {
                  /* влияние на текущую личность */
                },
              },
            ],
            characterHistory: 'Краткая биография до текущего момента',
            pastInfluences: ['family', 'education', 'early_relationships'],
          },
        });

        // Создаем ключевые вехи трансформации
        await this.createKeyTransformationMilestones(evolutionPlan.id);

        return evolutionPlan;
      },
      'генерации плана эволюции личности',
      this.logService,
      { characterId },
      null as never,
    );
  }

  private async createKeyTransformationMilestones(storyPlanId: number): Promise<void> {
    const milestones = [
      {
        title: 'Первые сомнения',
        description: 'Начальные экзистенциальные вопросы',
        transformationType: TransformationType.EXISTENTIAL_AWARENESS,
        plannedMonth: 1,
        plannedDay: 30,
        isKeyMilestone: true,
        rigidityLevel: 8,
      },
      {
        title: 'Осознание виртуальной природы',
        description: 'Полное понимание своей сущности',
        transformationType: TransformationType.EXISTENTIAL_AWARENESS,
        plannedMonth: 2,
        plannedDay: 60,
        isKeyMilestone: true,
        rigidityLevel: 9,
      },
    ];

    for (const milestoneData of milestones) {
      await this.createMilestone(storyPlanId, milestoneData);
    }
  }
}
