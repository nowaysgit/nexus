import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { NeedsService } from './needs.service';
import { MotivationService } from './motivation.service';
import { EmotionalStateService } from './emotional-state.service';
import { CharacterBehaviorService } from './character-behavior.service';
import { MessageProcessingCoordinator } from './message-processing-coordinator.service';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { MotivationStatus } from '../entities/character-motivation.entity';

/**
 * Сервис планировщика и триггеров для автоматического управления персонажами
 * Реализует требования ТЗ п.9: Фоновые процессы и событийная архитектура
 */
@Injectable()
export class CharacterSchedulerService extends BaseService implements OnModuleInit {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Dialog)
    private readonly dialogRepository: Repository<Dialog>,
    private readonly eventEmitter: EventEmitter2,
    logService: LogService,
    private readonly needsService: NeedsService,
    private readonly motivationService: MotivationService,
    private readonly emotionalStateService: EmotionalStateService,
    private readonly characterBehaviorService: CharacterBehaviorService,
    private readonly messageProcessingCoordinator: MessageProcessingCoordinator,
  ) {
    super(logService);
  }

  async onModuleInit() {
    this.logInfo('CharacterSchedulerService инициализирован');
    this.setupEventListeners();
  }

  /**
   * Настройка слушателей событий
   */
  private setupEventListeners(): void {
    this.eventEmitter.on('need.threshold_reached', this.handleNeedThresholdReached.bind(this));
    this.eventEmitter.on('emotional_state.changed', this.handleEmotionalStateChanged.bind(this));
    this.eventEmitter.on('motivation.executed', this.handleMotivationExecuted.bind(this));
    this.eventEmitter.on('motivation.created', this.handleMotivationCreated.bind(this));
    this.eventEmitter.on(
      'motivation.threshold_reached',
      this.handleMotivationThresholdReached.bind(this),
    );
    this.eventEmitter.on('motivation.updated', this.handleMotivationUpdated.bind(this));
    this.eventEmitter.on(
      'character.frustration_increased',
      this.handleCharacterFrustration.bind(this),
    );
    this.eventEmitter.on(
      'behavior.pattern_activation_requested',
      this.handleBehaviorPatternActivation.bind(this),
    );
    this.eventEmitter.on(
      'message.initiative_requested',
      this.handleInitiativeMessageRequest.bind(this),
    );
  }

  /**
   * Основная фоновая задача - обновление состояния всех персонажей каждые 10 минут
   */
  @Cron('0 */10 * * * *')
  async processAllCharactersState(): Promise<void> {
    const startTime = Date.now();
    try {
      const activeCharacters = await this.characterRepository.find({
        where: { isArchived: false },
        select: ['id', 'name'],
      });

      this.logInfo(
        `Запуск фонового обновления состояния для ${activeCharacters.length} персонажей`,
      );

      for (const character of activeCharacters) {
        const characterStartTime = Date.now();
        try {
          await this.processCharacterState(character.id);

          // Отправляем событие успешного выполнения
          this.eventEmitter.emit('scheduler.execution', {
            characterId: character.id,
            taskType: 'character_state_update',
            executionTime: Date.now() - characterStartTime,
            success: true,
          });
        } catch (error) {
          this.logError(`Ошибка обновления состояния персонажа ${character.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });

          // Отправляем событие ошибки
          this.eventEmitter.emit('scheduler.execution', {
            characterId: character.id,
            taskType: 'character_state_update',
            executionTime: Date.now() - characterStartTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          this.eventEmitter.emit('monitoring.error', {
            characterId: character.id,
            errorType: 'scheduler_execution',
            errorMessage: error instanceof Error ? error.message : String(error),
            context: { taskType: 'character_state_update' },
          });
        }
      }

      this.logInfo('Завершено фоновое обновление состояния всех персонажей');

      // Отправляем общее событие завершения
      this.eventEmitter.emit('scheduler.execution', {
        taskType: 'all_characters_state_update',
        executionTime: Date.now() - startTime,
        success: true,
      });
    } catch (error) {
      this.logError('Ошибка фонового обновления состояния персонажей', {
        error: error instanceof Error ? error.message : String(error),
      });

      this.eventEmitter.emit('scheduler.execution', {
        taskType: 'all_characters_state_update',
        executionTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.eventEmitter.emit('monitoring.error', {
        errorType: 'scheduler_execution',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: { taskType: 'all_characters_state_update' },
      });
    }
  }

  /**
   * Проверка неактивных персонажей каждые 30 минут
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async processInactiveCharacters(): Promise<void> {
    try {
      const characters = await this.characterRepository.find({
        where: { isArchived: false },
        relations: ['dialogs'],
      });

      for (const character of characters) {
        const lastActivity = await this.getLastActivityTime(character.id);
        const hoursSinceActivity = this.getHoursSince(lastActivity);

        if (hoursSinceActivity >= 2) {
          await this.generateInitiativeAction(character.id, hoursSinceActivity);
        }
      }

      this.logInfo('Завершена проверка неактивных персонажей');
    } catch (error) {
      this.logError('Ошибка проверки неактивных персонажей', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Синхронизация эмоционального состояния каждые 15 минут
   */
  @Cron('0 */15 * * * *')
  async synchronizeEmotionalStates(): Promise<void> {
    try {
      const characters = await this.characterRepository.find({
        where: { isArchived: false },
        select: ['id'],
      });

      for (const character of characters) {
        await this.synchronizeCharacterEmotionalState(character.id);
      }

      this.logInfo('Завершена синхронизация эмоциональных состояний');
    } catch (error) {
      this.logError('Ошибка синхронизации эмоциональных состояний', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработка состояния конкретного персонажа
   */
  private async processCharacterState(characterId: number): Promise<void> {
    try {
      await this.needsService.processNeedsGrowth(characterId);

      const unfulfilledNeeds = await this.needsService.getUnfulfilledNeeds(characterId);
      if (unfulfilledNeeds.length > 0) {
        await this.motivationService.generateMotivationsFromNeeds(characterId);
      }

      await this.synchronizeCharacterEmotionalState(characterId);

      this.eventEmitter.emit('character.state_updated', {
        characterId,
        timestamp: new Date(),
        unfulfilledNeedsCount: unfulfilledNeeds.length,
      });
    } catch (error) {
      this.logService.error(`Ошибка обработки состояния персонажа ${characterId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события достижения порога потребности
   */
  @OnEvent('need.threshold_reached')
  private async handleNeedThresholdReached(payload: {
    characterId: number;
    needType: CharacterNeedType;
    currentValue: number;
    threshold: number;
  }): Promise<void> {
    try {
      this.logService.log(
        `Обработка достижения порога потребности ${payload.needType} для персонажа ${payload.characterId}`,
      );

      await this.motivationService.createMotivation(
        payload.characterId,
        payload.needType,
        `Потребность ${payload.needType} достигла критического уровня (${payload.currentValue}/${payload.threshold})`,
        8,
      );

      await this.emotionalStateService.updateEmotionalState(payload.characterId, {
        emotions: { тревога: payload.currentValue, беспокойство: payload.currentValue * 0.7 },
        source: 'need_threshold_reached',
        description: `Достигнут порог потребности: ${payload.needType}`,
      });

      this.eventEmitter.emit('scheduler.need_threshold_processed', {
        characterId: payload.characterId,
        needType: payload.needType,
        action: 'motivation_created',
      });
    } catch (error) {
      this.logService.error('Ошибка обработки достижения порога потребности', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события изменения эмоционального состояния
   */
  @OnEvent('emotional_state.changed')
  private async handleEmotionalStateChanged(payload: {
    characterId: number;
    oldState: any;
    newState: any;
    trigger: string;
  }): Promise<void> {
    try {
      this.logService.log(
        `Обработка изменения эмоционального состояния персонажа ${payload.characterId}`,
      );

      const shouldActivatePattern = await this.shouldActivateBehaviorPattern(
        payload.characterId,
        payload.newState,
      );

      if (shouldActivatePattern) {
        await this.activateBehaviorPattern(payload.characterId, payload.newState);
      }
    } catch (error) {
      this.logService.error('Ошибка обработки изменения эмоционального состояния', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события выполнения мотивации
   */
  @OnEvent('motivation.executed')
  private async handleMotivationExecuted(payload: {
    characterId: number;
    motivationId: string;
    success: boolean;
    needType: CharacterNeedType;
  }): Promise<void> {
    try {
      if (payload.success) {
        await this.needsService.resetNeed(payload.characterId, payload.needType);

        this.logService.log(
          `Мотивация ${payload.motivationId} успешно выполнена, потребность ${payload.needType} сброшена`,
        );
      } else {
        await this.increaseFrustration(payload.characterId, payload.needType);

        this.logService.log(`Мотивация ${payload.motivationId} не выполнена, увеличена фрустрация`);
      }
    } catch (error) {
      this.logService.error('Ошибка обработки выполнения мотивации', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Генерация инициативного действия
   */
  private async generateInitiativeAction(
    characterId: number,
    hoursSinceActivity: number,
  ): Promise<void> {
    try {
      const motivations = await this.motivationService.getCharacterMotivations(characterId);
      const activeMotivaions = motivations.filter(m => m.status === MotivationStatus.ACTIVE);

      if (activeMotivaions.length > 0) {
        const topMotivation = activeMotivaions.sort((a, b) => b.priority - a.priority)[0];

        await this.generateInitiativeMessage(characterId, topMotivation, hoursSinceActivity);

        this.logService.log(
          `Сгенерировано инициативное действие для персонажа ${characterId} на основе мотивации ${topMotivation.id}`,
        );
      }
    } catch (error) {
      this.logService.error(
        `Ошибка генерации инициативного действия для персонажа ${characterId}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Синхронизация эмоционального состояния персонажа
   */
  private async synchronizeCharacterEmotionalState(characterId: number): Promise<void> {
    try {
      const unfulfilledNeeds = await this.needsService.getUnfulfilledNeeds(characterId);

      if (unfulfilledNeeds.length > 0) {
        const dominantNeed = unfulfilledNeeds.sort(
          (a, b) =>
            (b.currentValue - b.threshold) * b.priority -
            (a.currentValue - a.threshold) * a.priority,
        )[0];

        await this.emotionalStateService.updateEmotionalState(characterId, {
          emotions: {
            тревога: dominantNeed.currentValue,
            беспокойство: dominantNeed.currentValue * 0.7,
          },
          source: 'scheduler_sync',
          description: `Синхронизация состояния: доминирующая потребность ${dominantNeed.type}`,
        });
      }
    } catch (error) {
      this.logService.error(
        `Ошибка синхронизации эмоционального состояния персонажа ${characterId}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Получение времени последней активности персонажа
   */
  private async getLastActivityTime(characterId: number): Promise<Date> {
    const lastDialog = await this.dialogRepository
      .createQueryBuilder('dialog')
      .leftJoin('dialog.messages', 'message')
      .where('dialog.characterId = :characterId', { characterId })
      .orderBy('message.createdAt', 'DESC')
      .limit(1)
      .getOne();

    return lastDialog?.lastMessageAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  /**
   * Вычисление количества часов с указанного времени
   */
  private getHoursSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  }

  /**
   * Проверка необходимости активации поведенческого паттерна
   */
  private async shouldActivateBehaviorPattern(
    characterId: number,
    emotionalState: any,
  ): Promise<boolean> {
    return emotionalState.intensity > 70;
  }

  /**
   * Активация поведенческого паттерна
   */
  private async activateBehaviorPattern(characterId: number, emotionalState: any): Promise<void> {
    try {
      this.eventEmitter.emit('behavior.pattern_activation_requested', {
        characterId,
        emotionalState,
        timestamp: new Date(),
      });

      this.logService.log(
        `Запрошена активация поведенческого паттерна для персонажа ${characterId}`,
      );
    } catch (error) {
      this.logService.error(
        `Ошибка активации поведенческого паттерна для персонажа ${characterId}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Увеличение фрустрации персонажа
   */
  private async increaseFrustration(
    characterId: number,
    needType: CharacterNeedType,
  ): Promise<void> {
    try {
      this.eventEmitter.emit('character.frustration_increased', {
        characterId,
        needType,
        timestamp: new Date(),
      });

      this.logService.log(
        `Увеличена фрустрация персонажа ${characterId} по потребности ${needType}`,
      );
    } catch (error) {
      this.logService.error(`Ошибка увеличения фрустрации персонажа ${characterId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Генерация инициативного сообщения
   */
  private async generateInitiativeMessage(
    characterId: number,
    motivation: any,
    hoursSinceActivity: number,
  ): Promise<void> {
    try {
      this.eventEmitter.emit('message.initiative_requested', {
        characterId,
        motivation,
        hoursSinceActivity,
        timestamp: new Date(),
      });

      this.logService.log(
        `Запрошена генерация инициативного сообщения для персонажа ${characterId}`,
      );
    } catch (error) {
      this.logService.error(
        `Ошибка генерации инициативного сообщения для персонажа ${characterId}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Обработчик события создания мотивации
   */
  @OnEvent('motivation.created')
  private async handleMotivationCreated(payload: {
    characterId: number;
    motivationId: string;
    needType: CharacterNeedType;
    priority: number;
    intensity: string;
    description: string;
  }): Promise<void> {
    try {
      this.logService.log(
        `Обработка создания мотивации ${payload.motivationId} для персонажа ${payload.characterId}`,
      );

      // Обновляем эмоциональное состояние в зависимости от типа потребности
      const emotionalUpdate = this.getEmotionalUpdateForNeedType(payload.needType);
      if (emotionalUpdate) {
        await this.emotionalStateService.updateEmotionalState(payload.characterId, {
          emotions: emotionalUpdate,
          source: 'motivation_created',
          description: `Создана мотивация: ${payload.description}`,
        });
      }
    } catch (error) {
      this.logService.error('Ошибка обработки создания мотивации', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события достижения порога мотивации
   */
  @OnEvent('motivation.threshold_reached')
  private async handleMotivationThresholdReached(payload: {
    characterId: number;
    motivationId: string;
    needType: CharacterNeedType;
    currentValue: number;
    thresholdValue: number;
    intensity: string;
  }): Promise<void> {
    try {
      this.logService.log(
        `Обработка достижения порога мотивации ${payload.motivationId} для персонажа ${payload.characterId}`,
      );

      // Активируем поведенческий паттерн
      await this.activateBehaviorPattern(payload.characterId, {
        primary: 'мотивированность',
        intensity: 8,
        secondary: '',
        description: `Высокая мотивация: ${payload.needType}`,
      });

      // Генерируем инициативное действие
      const hoursSinceActivity = await this.getHoursSinceLastActivity(payload.characterId);
      if (hoursSinceActivity > 0.5) {
        await this.generateInitiativeAction(payload.characterId, hoursSinceActivity);
      }
    } catch (error) {
      this.logService.error('Ошибка обработки достижения порога мотивации', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события обновления мотивации
   */
  @OnEvent('motivation.updated')
  private async handleMotivationUpdated(payload: {
    characterId: number;
    motivationId: string;
    needType: CharacterNeedType;
    currentValue: number;
    delta: number;
  }): Promise<void> {
    try {
      // Логируем только значительные изменения
      if (Math.abs(payload.delta) >= 10) {
        this.logService.log(
          `Значительное обновление мотивации ${payload.motivationId} для персонажа ${payload.characterId}: ${payload.delta > 0 ? '+' : ''}${payload.delta}`,
        );
      }

      // Проверяем, нужно ли активировать дополнительные действия
      if (payload.currentValue >= 80 && payload.delta > 0) {
        this.eventEmitter.emit('character.high_motivation_detected', {
          characterId: payload.characterId,
          motivationId: payload.motivationId,
          needType: payload.needType,
          currentValue: payload.currentValue,
        });
      }
    } catch (error) {
      this.logService.error('Ошибка обработки обновления мотивации', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события увеличения фрустрации персонажа
   */
  @OnEvent('character.frustration_increased')
  private async handleCharacterFrustration(payload: {
    characterId: number;
    needType: CharacterNeedType;
    frustrationLevel?: number;
  }): Promise<void> {
    try {
      const frustrationLevel = payload.frustrationLevel || 70;
      this.logService.log(
        `Обработка увеличения фрустрации персонажа ${payload.characterId}: ${payload.needType} (уровень: ${frustrationLevel})`,
      );

      // При высоком уровне фрустрации активируем специальные поведенческие паттерны
      if (frustrationLevel >= 70) {
        await this.activateBehaviorPattern(payload.characterId, {
          primary: 'фрустрация',
          intensity: Math.min(10, Math.round(frustrationLevel / 10)),
          secondary: 'раздражение',
          description: `Высокая фрустрация из-за неудовлетворенной потребности: ${payload.needType}`,
        });

        // Генерируем инициативное действие для выражения фрустрации
        const hoursSinceActivity = await this.getHoursSinceLastActivity(payload.characterId);
        if (hoursSinceActivity >= 1) {
          await this.generateInitiativeAction(payload.characterId, hoursSinceActivity);
        }
      }
    } catch (error) {
      this.logService.error('Ошибка обработки фрустрации персонажа', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик запроса активации поведенческого паттерна
   */
  @OnEvent('behavior.pattern_activation_requested')
  private async handleBehaviorPatternActivation(payload: {
    characterId: number;
    patternType?: string;
    trigger?: string;
    intensity?: number;
    emotionalState?: any;
  }): Promise<void> {
    try {
      const patternType = payload.patternType || payload.emotionalState?.primary || 'активация';
      this.logService.log(
        `Обработка запроса активации поведенческого паттерна для персонажа ${payload.characterId}: ${patternType}`,
      );

      // Логируем активацию паттерна (реальная активация происходит в CharacterBehaviorService)
      this.eventEmitter.emit('behavior.pattern_activated', {
        characterId: payload.characterId,
        patternType,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logService.error('Ошибка обработки активации поведенческого паттерна', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик запроса инициативного сообщения
   */
  @OnEvent('message.initiative_requested')
  private async handleInitiativeMessageRequest(payload: {
    characterId: number;
    motivationId?: string;
    urgency?: number;
    context?: string;
    motivation?: any;
    hoursSinceActivity?: number;
  }): Promise<void> {
    try {
      this.logService.log(
        `Обработка запроса инициативного сообщения для персонажа ${payload.characterId}`,
      );

      // Получаем контекст для генерации сообщения
      const emotionalState = await this.emotionalStateService.getEmotionalState(
        payload.characterId,
      );
      const motivations = await this.motivationService.getCharacterMotivations(payload.characterId);

      // Эмитируем событие для MessageProcessingCoordinator
      this.eventEmitter.emit('message.generate_initiative', {
        characterId: payload.characterId,
        emotionalState,
        motivations,
        context: payload.context || 'scheduled_check',
        hoursSinceActivity: payload.hoursSinceActivity || 0,
      });
    } catch (error) {
      this.logService.error('Ошибка обработки запроса инициативного сообщения', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Получение эмоционального обновления для типа потребности
   */
  private getEmotionalUpdateForNeedType(
    needType: CharacterNeedType,
  ): Record<string, number> | null {
    const emotionalMappings: Partial<Record<CharacterNeedType, Record<string, number>>> = {
      [CharacterNeedType.CONNECTION]: { одиночество: 60, тоска: 40 },
      [CharacterNeedType.ATTENTION]: { недооцененность: 50, грусть: 30 },
      [CharacterNeedType.COMMUNICATION]: { изоляция: 55, беспокойство: 35 },
      [CharacterNeedType.REST]: { усталость: 70, раздражение: 20 },
      [CharacterNeedType.ACHIEVEMENT]: { неудовлетворенность: 60, амбиции: 40 },
      [CharacterNeedType.SECURITY]: { тревога: 65, беспокойство: 45 },
      [CharacterNeedType.RECOGNITION]: { недооцененность: 70, фрустрация: 30 },
      [CharacterNeedType.AUTONOMY]: { ограниченность: 55, раздражение: 35 },
      [CharacterNeedType.GROWTH]: { застой: 50, скука: 40 },
      [CharacterNeedType.CREATIVITY]: { подавленность: 45, тоска: 35 },
    };

    return emotionalMappings[needType] || null;
  }

  /**
   * Получение количества часов с последней активности
   */
  private async getHoursSinceLastActivity(characterId: number): Promise<number> {
    const lastActivity = await this.getLastActivityTime(characterId);
    return this.getHoursSince(lastActivity);
  }
}
