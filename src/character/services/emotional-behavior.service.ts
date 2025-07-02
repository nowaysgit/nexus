import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { EmotionalState } from '../entities/emotional-state';
import { IMotivation as _IMotivation } from '../interfaces/needs.interfaces';
import { EmotionalStateService } from './emotional-state.service';
import { NeedsService } from './needs.service';
import { MemoryService } from './memory.service';
import { LogService } from '../../logging/log.service';
import { ActionExecutorService } from './action-executor.service';
import { CharacterAction as _CharacterAction } from '../interfaces/behavior.interfaces';

/**
 * Типы фрустрации согласно ТЗ ВОЛЯ
 */
export enum FrustrationType {
  NEED_DEPRIVATION = 'need_deprivation', // Лишение потребности
  FAILED_ACTIONS = 'failed_actions', // Неудачные действия
  SOCIAL_REJECTION = 'social_rejection', // Социальное отвержение
  GOAL_BLOCKING = 'goal_blocking', // Блокировка целей
  RESOURCE_SHORTAGE = 'resource_shortage', // Нехватка ресурсов
}

/**
 * Уровни фрустрации согласно ТЗ ВОЛЯ
 */
export enum FrustrationLevel {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

/**
 * Поведенческие паттерны при фрустрации согласно ТЗ ВОЛЯ
 */
export interface FrustrationBehaviorPattern {
  type: FrustrationType;
  level: FrustrationLevel;
  behaviorModifiers: {
    aggressionIncrease: number; // Увеличение агрессивности (0-100%)
    withdrawalTendency: number; // Склонность к замкнутости (0-100%)
    impulsivityBoost: number; // Повышение импульсивности (0-100%)
    riskTaking: number; // Склонность к риску (0-100%)
    socialAvoidance: number; // Избегание социальных контактов (0-100%)
  };
  emotionalModifiers: {
    irritabilityLevel: number; // Уровень раздражительности (0-100%)
    anxietyLevel: number; // Уровень тревожности (0-100%)
    depressionRisk: number; // Риск депрессии (0-100%)
    emotionalVolatility: number; // Эмоциональная нестабильность (0-100%)
  };
  temporaryDebuffs: {
    actionSuccessReduction: number; // Снижение успешности действий (0-50%)
    resourceEfficiencyLoss: number; // Потеря эффективности ресурсов (0-30%)
    socialSkillPenalty: number; // Штраф к социальным навыкам (0-40%)
    decisionMakingImpairment: number; // Ухудшение принятия решений (0-60%)
    duration: number; // Продолжительность в минутах
  };
}

/**
 * Результат анализа эмоционального изменения
 */
export interface EmotionalChangeAnalysis {
  type: 'positive' | 'negative' | 'neutral';
  intensity: 'low' | 'medium' | 'high';
  behaviorType: string;
  shouldTriggerAction: boolean;
}

/**
 * Сервис для управления эмоциональным поведением персонажей
 * Отвечает за анализ фрустрации, адаптацию поведения к эмоциональным изменениям
 * и применение эмоциональных модификаторов согласно ТЗ ВОЛЯ
 */
@Injectable()
export class EmotionalBehaviorService extends BaseService {
  // Система отслеживания фрустрации согласно ТЗ ВОЛЯ
  private characterFrustrationLevels: Map<number, FrustrationLevel> = new Map();
  private characterFrustrationTypes: Map<number, Set<FrustrationType>> = new Map();
  private activeFrustrationPatterns: Map<number, FrustrationBehaviorPattern[]> = new Map();
  private frustrationDebuffTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    private readonly emotionalStateService: EmotionalStateService,
    private readonly needsService: NeedsService,
    private readonly memoryService: MemoryService,
    private readonly actionExecutorService: ActionExecutorService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(LogService) logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Анализ уровня фрустрации персонажа согласно ТЗ ВОЛЯ
   */
  async analyzeFrustration(characterId: number): Promise<FrustrationLevel> {
    return this.withErrorHandling('анализ фрустрации персонажа', async () => {
      // Получаем персонажа
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });

      if (!character) {
        return FrustrationLevel.NONE;
      }

      let frustrationScore = 0;
      const frustrationTypes = new Set<FrustrationType>();

      // Анализ неудовлетворенных потребностей
      const criticalNeeds = await this.needsService.getUnfulfilledNeeds(characterId);
      if (criticalNeeds.length > 0) {
        frustrationScore += criticalNeeds.length * 15;
        frustrationTypes.add(FrustrationType.NEED_DEPRIVATION);
      }

      // Анализ неудачных действий - заменяем на проверку через память
      const recentMemories = await this.memoryService.getRecentMemories(characterId, 20);
      const failureMemories = recentMemories.filter(memory => {
        const content = memory.content.toLowerCase();
        return (
          content.includes('неудача') ||
          content.includes('провал') ||
          content.includes('ошибка') ||
          content.includes('не получилось')
        );
      });

      if (failureMemories.length > 3) {
        frustrationScore += 20;
        frustrationTypes.add(FrustrationType.FAILED_ACTIONS);
      }

      // Анализ социального отвержения через память
      const negativeInteractions = recentMemories.filter(memory => {
        const content = memory.content.toLowerCase();
        return (
          content.includes('отказ') ||
          content.includes('игнор') ||
          content.includes('конфликт') ||
          content.includes('неудача')
        );
      });

      if (negativeInteractions.length > 2) {
        frustrationScore += negativeInteractions.length * 10;
        frustrationTypes.add(FrustrationType.SOCIAL_REJECTION);
      }

      // Определяем уровень фрустрации
      let level: FrustrationLevel;
      if (frustrationScore >= 80) level = FrustrationLevel.CRITICAL;
      else if (frustrationScore >= 60) level = FrustrationLevel.SEVERE;
      else if (frustrationScore >= 40) level = FrustrationLevel.MODERATE;
      else if (frustrationScore >= 20) level = FrustrationLevel.MILD;
      else level = FrustrationLevel.NONE;

      // Сохраняем состояние фрустрации
      this.characterFrustrationLevels.set(characterId, level);
      this.characterFrustrationTypes.set(characterId, frustrationTypes);

      // Применяем поведенческие паттерны при фрустрации
      if (level !== FrustrationLevel.NONE) {
        await this.applyFrustrationBehaviorPatterns(characterId, level, frustrationTypes);
      }

      this.logDebug(
        `Персонаж ${characterId}: уровень фрустрации ${level}, типы: ${Array.from(frustrationTypes).join(', ')}`,
      );

      return level;
    });
  }

  /**
   * Применение поведенческих паттернов при фрустрации
   */
  private async applyFrustrationBehaviorPatterns(
    characterId: number,
    level: FrustrationLevel,
    types: Set<FrustrationType>,
  ): Promise<void> {
    return this.withErrorHandling('применение паттернов фрустрации', async () => {
      const patterns: FrustrationBehaviorPattern[] = [];

      // Создаем паттерны для каждого типа фрустрации
      for (const type of types) {
        const pattern = this.createFrustrationPattern(type, level);
        patterns.push(pattern);
      }

      // Сохраняем активные паттерны
      this.activeFrustrationPatterns.set(characterId, patterns);

      // Применяем временные дебаффы
      await this.applyTemporaryDebuffs(characterId, patterns);

      // Модифицируем эмоциональное состояние
      await this.modifyEmotionalState(characterId, patterns);
    });
  }

  /**
   * Создание паттерна фрустрации для конкретного типа и уровня
   */
  private createFrustrationPattern(
    type: FrustrationType,
    level: FrustrationLevel,
  ): FrustrationBehaviorPattern {
    const intensity = this.getFrustrationIntensity(level);

    const basePattern: FrustrationBehaviorPattern = {
      type,
      level,
      behaviorModifiers: {
        aggressionIncrease: 0,
        withdrawalTendency: 0,
        impulsivityBoost: 0,
        riskTaking: 0,
        socialAvoidance: 0,
      },
      emotionalModifiers: {
        irritabilityLevel: 0,
        anxietyLevel: 0,
        depressionRisk: 0,
        emotionalVolatility: 0,
      },
      temporaryDebuffs: {
        actionSuccessReduction: intensity * 0.3,
        resourceEfficiencyLoss: intensity * 0.2,
        socialSkillPenalty: intensity * 0.25,
        decisionMakingImpairment: intensity * 0.4,
        duration: intensity * 60, // минуты
      },
    };

    // Настраиваем модификаторы в зависимости от типа фрустрации
    switch (type) {
      case FrustrationType.NEED_DEPRIVATION:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.6;
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.8;
        basePattern.emotionalModifiers.irritabilityLevel = intensity * 0.9;
        break;

      case FrustrationType.FAILED_ACTIONS:
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.7;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.3;
        basePattern.emotionalModifiers.depressionRisk = intensity * 0.5;
        break;

      case FrustrationType.SOCIAL_REJECTION:
        basePattern.behaviorModifiers.socialAvoidance = intensity * 0.8;
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.6;
        basePattern.emotionalModifiers.anxietyLevel = intensity * 0.7;
        break;

      case FrustrationType.GOAL_BLOCKING:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.8;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.9;
        basePattern.emotionalModifiers.emotionalVolatility = intensity * 0.7;
        break;

      case FrustrationType.RESOURCE_SHORTAGE:
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.5;
        basePattern.behaviorModifiers.socialAvoidance = intensity * 0.4;
        basePattern.emotionalModifiers.anxietyLevel = intensity * 0.8;
        break;
    }

    return basePattern;
  }

  /**
   * Получение интенсивности фрустрации по уровню
   */
  private getFrustrationIntensity(level: FrustrationLevel): number {
    switch (level) {
      case FrustrationLevel.MILD:
        return 0.25;
      case FrustrationLevel.MODERATE:
        return 0.5;
      case FrustrationLevel.SEVERE:
        return 0.75;
      case FrustrationLevel.CRITICAL:
        return 1.0;
      default:
        return 0;
    }
  }

  /**
   * Применение временных дебаффов от фрустрации
   */
  private async applyTemporaryDebuffs(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    return this.withErrorHandling('применение временных дебаффов', async () => {
      // Очищаем предыдущий таймер если есть
      const existingTimer = this.frustrationDebuffTimers.get(characterId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Находим максимальную продолжительность дебаффов
      const maxDuration = Math.max(...patterns.map(p => p.temporaryDebuffs.duration));

      // Устанавливаем таймер на снятие эффектов
      const timer = setTimeout(
        () => {
          this.removeFrustrationEffects(characterId);
        },
        maxDuration * 60 * 1000,
      );

      this.frustrationDebuffTimers.set(characterId, timer);
    });
  }

  /**
   * Модификация эмоционального состояния на основе фрустрации
   */
  private async modifyEmotionalState(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    return this.withErrorHandling('модификация эмоционального состояния', async () => {
      // Суммируем все эмоциональные модификаторы
      let totalIrritability = 0;
      let totalAnxiety = 0;
      let totalDepression = 0;
      let totalVolatility = 0;

      for (const pattern of patterns) {
        totalIrritability += pattern.emotionalModifiers.irritabilityLevel;
        totalAnxiety += pattern.emotionalModifiers.anxietyLevel;
        totalDepression += pattern.emotionalModifiers.depressionRisk;
        totalVolatility += pattern.emotionalModifiers.emotionalVolatility;
      }

      // Нормализуем значения (максимум 100)
      totalIrritability = Math.min(totalIrritability, 100);
      totalAnxiety = Math.min(totalAnxiety, 100);
      totalDepression = Math.min(totalDepression, 100);
      totalVolatility = Math.min(totalVolatility, 100);

      // Создаем описание эмоционального состояния
      const emotionalDescription = this.generateEmotionalStateDescription(
        totalIrritability,
        totalAnxiety,
        totalDepression,
        totalVolatility,
      );

      // Обновляем эмоциональное состояние через сервис
      const primary =
        totalIrritability > 50 ? 'irritated' : totalAnxiety > 50 ? 'anxious' : 'frustrated';
      const emotionIntensity = Math.max(
        totalIrritability,
        totalAnxiety,
        totalDepression,
        totalVolatility,
      );

      await this.emotionalStateService.updateEmotionalState(characterId, {
        emotions: {
          [primary]: emotionIntensity,
        },
        source: 'emotional_behavior_service',
        description: emotionalDescription,
      });
    });
  }

  /**
   * Генерация описания эмоционального состояния
   */
  private generateEmotionalStateDescription(
    irritability: number,
    anxiety: number,
    depression: number,
    volatility: number,
  ): string {
    const descriptions = [];

    if (irritability > 60) descriptions.push('крайне раздражен');
    else if (irritability > 30) descriptions.push('раздражен');

    if (anxiety > 60) descriptions.push('очень тревожен');
    else if (anxiety > 30) descriptions.push('тревожен');

    if (depression > 60) descriptions.push('подавлен');
    else if (depression > 30) descriptions.push('грустен');

    if (volatility > 60) descriptions.push('эмоционально нестабилен');

    return descriptions.length > 0 ? descriptions.join(', ') : 'фрустрирован';
  }

  /**
   * Снятие эффектов фрустрации
   */
  private removeFrustrationEffects(characterId: number): void {
    this.activeFrustrationPatterns.delete(characterId);
    this.frustrationDebuffTimers.delete(characterId);
    this.logDebug(`Сняты эффекты фрустрации для персонажа ${characterId}`);
  }

  /**
   * Получение текущего уровня фрустрации
   */
  getFrustrationLevel(characterId: number): FrustrationLevel {
    return this.characterFrustrationLevels.get(characterId) || FrustrationLevel.NONE;
  }

  /**
   * Получение активных паттернов фрустрации
   */
  getActiveFrustrationPatterns(characterId: number): FrustrationBehaviorPattern[] {
    return this.activeFrustrationPatterns.get(characterId) || [];
  }

  /**
   * Применение фрустрации к действию (снижение успешности)
   */
  applyFrustrationToAction(characterId: number, baseSuccessRate: number): number {
    const patterns = this.getActiveFrustrationPatterns(characterId);
    if (patterns.length === 0) return baseSuccessRate;

    // Находим максимальное снижение успешности
    const maxReduction = Math.max(...patterns.map(p => p.temporaryDebuffs.actionSuccessReduction));

    const modifiedRate = baseSuccessRate * (1 - maxReduction / 100);
    return Math.max(modifiedRate, 0.1); // Минимум 10% успешности
  }

  /**
   * Обработчик изменения эмоционального состояния
   */
  @OnEvent('emotional_state.changed')
  async handleEmotionalStateChanged(payload: {
    characterId: number;
    oldState: EmotionalState;
    newState: EmotionalState;
    trigger: string;
    source: string;
    description?: string;
  }): Promise<void> {
    return this.withErrorHandling('обработка изменения эмоционального состояния', async () => {
      this.logDebug(
        `Обработка изменения эмоционального состояния персонажа ${payload.characterId}: ${payload.oldState?.primary} -> ${payload.newState.primary}`,
      );

      // Анализируем изменение эмоций
      const emotionChange = this.analyzeEmotionalChange(payload.oldState, payload.newState);

      // Адаптируем поведение к новому эмоциональному состоянию
      await this.adaptBehaviorToEmotion(payload.characterId, payload.newState, emotionChange);

      // Обновляем уровень фрустрации на основе негативных эмоций
      await this.updateFrustrationFromEmotion(payload.characterId, payload.newState);

      // Генерируем инициативные действия при сильных эмоциональных изменениях
      if (this.shouldTriggerInitiativeAction(emotionChange, payload.newState)) {
        await this.triggerEmotionalInitiativeAction(payload.characterId, payload.newState);
      }
    });
  }

  /**
   * Анализ изменения эмоционального состояния
   */
  private analyzeEmotionalChange(
    oldState: EmotionalState,
    newState: EmotionalState,
  ): EmotionalChangeAnalysis {
    // Определяем тип изменения
    const oldIsPositive = oldState ? this.isPositiveEmotion(oldState.primary) : false;
    const newIsPositive = this.isPositiveEmotion(newState.primary);
    const oldIsNegative = oldState ? this.isNegativeEmotion(oldState.primary) : false;
    const newIsNegative = this.isNegativeEmotion(newState.primary);

    let type: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (!oldIsPositive && newIsPositive) type = 'positive';
    else if (!oldIsNegative && newIsNegative) type = 'negative';
    else if (oldIsNegative && !newIsNegative) type = 'positive';

    // Определяем интенсивность изменения
    const oldIntensity = oldState?.intensity || 0;
    const intensityDiff = Math.abs(newState.intensity - oldIntensity);
    let intensity: 'low' | 'medium' | 'high' = 'low';
    if (intensityDiff > 30) intensity = 'high';
    else if (intensityDiff > 15) intensity = 'medium';

    // Определяем тип поведенческой реакции
    let behaviorType = 'default';
    if (newIsNegative && intensity === 'high') behaviorType = 'defensive';
    else if (newIsPositive && intensity === 'high') behaviorType = 'proactive';
    else if (newState.primary === 'angry') behaviorType = 'aggressive';
    else if (newState.primary === 'sad') behaviorType = 'withdrawn';

    // Определяем необходимость инициативного действия
    const shouldTriggerAction = intensity === 'high' && (newIsNegative || newIsPositive);

    return {
      type,
      intensity,
      behaviorType,
      shouldTriggerAction,
    };
  }

  /**
   * Адаптация поведения к эмоциональному состоянию
   */
  private async adaptBehaviorToEmotion(
    characterId: number,
    emotionalState: EmotionalState,
    emotionChange: EmotionalChangeAnalysis,
  ): Promise<void> {
    return this.withErrorHandling('адаптация поведения к эмоции', async () => {
      // Генерируем событие для обновления поведенческих паттернов
      this.eventEmitter.emit('behavior.pattern_adaptation_requested', {
        characterId,
        emotionalState,
        changeType: emotionChange.type,
        intensity: emotionChange.intensity,
        behaviorType: emotionChange.behaviorType,
        timestamp: new Date(),
      });

      this.logDebug(
        `Адаптация поведения персонажа ${characterId} к эмоции ${emotionalState.primary} (${emotionChange.type}, ${emotionChange.intensity})`,
      );
    });
  }

  /**
   * Проверка необходимости инициативного действия
   */
  private shouldTriggerInitiativeAction(
    emotionChange: EmotionalChangeAnalysis,
    emotionalState: EmotionalState,
  ): boolean {
    return (
      emotionChange.shouldTriggerAction &&
      emotionalState.intensity > 60 &&
      (emotionChange.type === 'negative' || emotionChange.type === 'positive')
    );
  }

  /**
   * Запуск инициативного действия на основе эмоций
   */
  private async triggerEmotionalInitiativeAction(
    characterId: number,
    emotionalState: EmotionalState,
  ): Promise<void> {
    return this.withErrorHandling('запуск инициативного действия', async () => {
      // Определяем тип инициативного действия на основе эмоции
      let actionType = 'emotional_response';
      if (emotionalState.primary === 'angry') actionType = 'confrontational_message';
      else if (emotionalState.primary === 'sad') actionType = 'seeking_comfort';
      else if (emotionalState.primary === 'happy') actionType = 'sharing_joy';
      else if (emotionalState.primary === 'excited') actionType = 'proactive_engagement';

      // Генерируем событие для создания инициативного сообщения
      this.eventEmitter.emit('message.emotional_initiative_requested', {
        characterId,
        actionType,
        emotionalState,
        priority: 'high',
        timestamp: new Date(),
      });

      this.logDebug(`Запущено инициативное действие для персонажа ${characterId}: ${actionType}`);
    });
  }

  /**
   * Обновление фрустрации на основе эмоционального состояния
   */
  private async updateFrustrationFromEmotion(
    characterId: number,
    emotionalState: EmotionalState,
  ): Promise<void> {
    return this.withErrorHandling('обновление фрустрации от эмоций', async () => {
      // Проверяем негативные эмоции высокой интенсивности
      if (this.isNegativeEmotion(emotionalState.primary) && emotionalState.intensity > 50) {
        const currentLevel = this.getFrustrationLevel(characterId);
        const currentTypes = this.characterFrustrationTypes.get(characterId) || new Set();

        // Добавляем тип фрустрации в зависимости от эмоции
        if (emotionalState.primary === 'angry') {
          currentTypes.add(FrustrationType.GOAL_BLOCKING);
        } else if (emotionalState.primary === 'sad') {
          currentTypes.add(FrustrationType.SOCIAL_REJECTION);
        } else if (emotionalState.primary === 'frustrated') {
          currentTypes.add(FrustrationType.FAILED_ACTIONS);
        }

        // Повышаем уровень фрустрации если эмоция очень интенсивная
        if (emotionalState.intensity > 80) {
          let newLevel = currentLevel;
          switch (currentLevel) {
            case FrustrationLevel.NONE:
              newLevel = FrustrationLevel.MILD;
              break;
            case FrustrationLevel.MILD:
              newLevel = FrustrationLevel.MODERATE;
              break;
            case FrustrationLevel.MODERATE:
              newLevel = FrustrationLevel.SEVERE;
              break;
            case FrustrationLevel.SEVERE:
              newLevel = FrustrationLevel.CRITICAL;
              break;
          }

          if (newLevel !== currentLevel) {
            this.characterFrustrationLevels.set(characterId, newLevel);
            this.characterFrustrationTypes.set(characterId, currentTypes);
            await this.applyFrustrationBehaviorPatterns(characterId, newLevel, currentTypes);

            this.logDebug(
              `Повышен уровень фрустрации персонажа ${characterId} до ${newLevel} из-за эмоции ${emotionalState.primary}`,
            );
          }
        }
      }
    });
  }

  /**
   * Проверка позитивной эмоции
   */
  private isPositiveEmotion(emotion: string): boolean {
    const positiveEmotions = [
      'happy',
      'joy',
      'excited',
      'pleased',
      'satisfied',
      'content',
      'grateful',
      'hopeful',
      'confident',
      'calm',
      'peaceful',
    ];
    return positiveEmotions.includes(emotion.toLowerCase());
  }

  /**
   * Проверка негативной эмоции
   */
  private isNegativeEmotion(emotion: string): boolean {
    const negativeEmotions = [
      'angry',
      'sad',
      'frustrated',
      'anxious',
      'worried',
      'disappointed',
      'irritated',
      'depressed',
      'fearful',
      'lonely',
      'guilty',
      'ashamed',
    ];
    return negativeEmotions.includes(emotion.toLowerCase());
  }

  /**
   * Очистка ресурсов при завершении работы
   */
  onModuleDestroy(): void {
    // Очищаем все таймеры фрустрации
    for (const timer of this.frustrationDebuffTimers.values()) {
      clearTimeout(timer);
    }
    this.frustrationDebuffTimers.clear();
    this.logDebug('Очищены все таймеры фрустрации');
  }
}
