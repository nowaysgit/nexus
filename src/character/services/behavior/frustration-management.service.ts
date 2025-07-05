import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { Character } from '../../entities/character.entity';
import { ActionStatus } from '../../entities/action.entity';

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
 * Специализированный сервис для управления фрустрацией персонажей
 * Выделен из CharacterBehaviorService для лучшей архитектуры
 */
@Injectable()
export class FrustrationManagementService extends BaseService {
  // Система отслеживания фрустрации согласно ТЗ ВОЛЯ
  private characterFrustrationLevels: Map<number, FrustrationLevel> = new Map();
  private characterFrustrationTypes: Map<number, Set<FrustrationType>> = new Map();
  private activeFrustrationPatterns: Map<number, FrustrationBehaviorPattern[]> = new Map();
  private frustrationDebuffTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly eventEmitter: EventEmitter2,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Анализ фрустрации персонажа согласно ТЗ ВОЛЯ
   */
  async analyzeFrustration(characterId: number): Promise<FrustrationLevel> {
    return this.withErrorHandling(`анализе фрустрации персонажа ${characterId}`, async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs', 'actions'],
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Определяем типы фрустрации
      const frustrationTypes = new Set<FrustrationType>();
      let totalFrustrationScore = 0;

      // 1. Анализ лишения потребностей
      if (character.needs) {
        const unmetNeeds = character.needs.filter(need => need.currentValue < need.threshold);
        if (unmetNeeds.length > 0) {
          frustrationTypes.add(FrustrationType.NEED_DEPRIVATION);
          totalFrustrationScore += Math.min(unmetNeeds.length * 15, 60);
        }
      }

      // 2. Анализ неудачных действий (за последние 24 часа)
      const recentFailedActions = character.actions?.filter(
        action =>
          action.status === ActionStatus.FAILED &&
          new Date(action.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000,
      );
      if (recentFailedActions && recentFailedActions.length > 2) {
        frustrationTypes.add(FrustrationType.FAILED_ACTIONS);
        totalFrustrationScore += Math.min(recentFailedActions.length * 10, 40);
      }

      // 3. Анализ социального отвержения (отсутствие взаимодействий)
      const lastInteraction = character.lastInteraction;
      if (lastInteraction) {
        const hoursSinceLastInteraction =
          (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastInteraction > 48) {
          frustrationTypes.add(FrustrationType.SOCIAL_REJECTION);
          totalFrustrationScore += Math.min(hoursSinceLastInteraction * 0.5, 30);
        }
      }

      // 4. Анализ блокировки целей (проверяем низкий уровень энергии как индикатор)
      if (character.energy !== undefined && character.energy < 30) {
        frustrationTypes.add(FrustrationType.GOAL_BLOCKING);
        totalFrustrationScore += 25;
      }

      // 5. Анализ нехватки ресурсов
      if (character.energy !== undefined && character.energy < 20) {
        frustrationTypes.add(FrustrationType.RESOURCE_SHORTAGE);
        totalFrustrationScore += 20;
      }

      // Определяем уровень фрустрации
      let level: FrustrationLevel;
      if (totalFrustrationScore >= 80) {
        level = FrustrationLevel.CRITICAL;
      } else if (totalFrustrationScore >= 60) {
        level = FrustrationLevel.SEVERE;
      } else if (totalFrustrationScore >= 40) {
        level = FrustrationLevel.MODERATE;
      } else if (totalFrustrationScore >= 20) {
        level = FrustrationLevel.MILD;
      } else {
        level = FrustrationLevel.NONE;
      }

      // Сохраняем состояние фрустрации
      this.characterFrustrationLevels.set(characterId, level);
      this.characterFrustrationTypes.set(characterId, frustrationTypes);

      // Применяем поведенческие паттерны
      if (level !== FrustrationLevel.NONE) {
        await this.applyFrustrationBehaviorPatterns(characterId, level, frustrationTypes);
      } else {
        this.removeFrustrationEffects(characterId);
      }

      this.logInfo(
        `Анализ фрустрации персонажа ${characterId}: уровень ${level}, типы: ${Array.from(frustrationTypes).join(', ')}, счет: ${totalFrustrationScore}`,
      );

      return level;
    });
  }

  /**
   * Применение поведенческих паттернов фрустрации
   */
  private async applyFrustrationBehaviorPatterns(
    characterId: number,
    level: FrustrationLevel,
    types: Set<FrustrationType>,
  ): Promise<void> {
    const patterns: FrustrationBehaviorPattern[] = [];

    // Создаем паттерны для каждого типа фрустрации
    for (const type of types) {
      patterns.push(this.createFrustrationPattern(type, level));
    }

    this.activeFrustrationPatterns.set(characterId, patterns);

    // Применяем временные дебаффы
    await this.applyTemporaryDebuffs(characterId, patterns);

    // Модифицируем эмоциональное состояние
    await this.modifyEmotionalState(characterId, patterns);

    this.logInfo(
      `Применены поведенческие паттерны фрустрации для персонажа ${characterId}: ${patterns.length} паттернов`,
    );
  }

  /**
   * Создание паттерна поведения при фрустрации
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
        irritabilityLevel: intensity * 0.6,
        anxietyLevel: intensity * 0.4,
        depressionRisk: intensity * 0.3,
        emotionalVolatility: intensity * 0.5,
      },
      temporaryDebuffs: {
        actionSuccessReduction: intensity * 0.3,
        resourceEfficiencyLoss: intensity * 0.2,
        socialSkillPenalty: intensity * 0.25,
        decisionMakingImpairment: intensity * 0.4,
        duration: intensity * 30, // 30 минут на единицу интенсивности
      },
    };

    // Специфичные модификации по типам фрустрации
    switch (type) {
      case FrustrationType.NEED_DEPRIVATION:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.7;
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.6;
        break;

      case FrustrationType.FAILED_ACTIONS:
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.8;
        basePattern.emotionalModifiers.depressionRisk = intensity * 0.6;
        break;

      case FrustrationType.SOCIAL_REJECTION:
        basePattern.behaviorModifiers.socialAvoidance = intensity * 0.9;
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.7;
        break;

      case FrustrationType.GOAL_BLOCKING:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.8;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.6;
        break;

      case FrustrationType.RESOURCE_SHORTAGE:
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.5;
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
      case FrustrationLevel.NONE:
        return 0;
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
   * Применение временных дебаффов
   */
  private async applyTemporaryDebuffs(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    // Очищаем предыдущий таймер
    const existingTimer = this.frustrationDebuffTimers.get(characterId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Находим максимальную продолжительность
    const maxDuration = Math.max(...patterns.map(p => p.temporaryDebuffs.duration));

    // Устанавливаем новый таймер
    const timer = setTimeout(
      () => {
        this.removeFrustrationEffects(characterId);
      },
      maxDuration * 60 * 1000,
    ); // Конвертируем минуты в миллисекунды

    this.frustrationDebuffTimers.set(characterId, timer);

    this.logInfo(
      `Применены временные дебаффы для персонажа ${characterId} на ${maxDuration} минут`,
    );
  }

  /**
   * Модификация эмоционального состояния
   */
  private async modifyEmotionalState(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    // Суммируем эмоциональные модификаторы
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

    // Ограничиваем значения
    totalIrritability = Math.min(totalIrritability, 100);
    totalAnxiety = Math.min(totalAnxiety, 100);
    totalDepression = Math.min(totalDepression, 100);
    totalVolatility = Math.min(totalVolatility, 100);

    // Генерируем описание эмоционального состояния
    const emotionalDescription = this.generateEmotionalStateDescription(
      totalIrritability,
      totalAnxiety,
      totalDepression,
      totalVolatility,
    );

    // Отправляем событие для обновления эмоционального состояния
    this.eventEmitter.emit('emotional_state.frustration_update', {
      characterId,
      frustrationModifiers: {
        irritability: totalIrritability,
        anxiety: totalAnxiety,
        depression: totalDepression,
        volatility: totalVolatility,
      },
      description: emotionalDescription,
    });

    this.logInfo(
      `Модифицировано эмоциональное состояние персонажа ${characterId}: раздражительность ${totalIrritability}%, тревожность ${totalAnxiety}%`,
    );
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
    const descriptions: string[] = [];

    if (irritability > 70) {
      descriptions.push('крайне раздражителен');
    } else if (irritability > 40) {
      descriptions.push('раздражен');
    }

    if (anxiety > 70) {
      descriptions.push('сильно тревожен');
    } else if (anxiety > 40) {
      descriptions.push('беспокоен');
    }

    if (depression > 60) {
      descriptions.push('подавлен');
    } else if (depression > 30) {
      descriptions.push('грустен');
    }

    if (volatility > 60) {
      descriptions.push('эмоционально нестабилен');
    }

    return descriptions.length > 0
      ? `Персонаж ${descriptions.join(', ')} из-за фрустрации`
      : 'Персонаж испытывает легкое напряжение';
  }

  /**
   * Удаление эффектов фрустрации
   */
  private removeFrustrationEffects(characterId: number): void {
    this.activeFrustrationPatterns.delete(characterId);

    const timer = this.frustrationDebuffTimers.get(characterId);
    if (timer) {
      clearTimeout(timer);
      this.frustrationDebuffTimers.delete(characterId);
    }

    this.logInfo(`Удалены эффекты фрустрации для персонажа ${characterId}`);
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
    if (patterns.length === 0) {
      return baseSuccessRate;
    }

    // Находим максимальное снижение успешности
    const maxReduction = Math.max(...patterns.map(p => p.temporaryDebuffs.actionSuccessReduction));

    const modifiedRate = baseSuccessRate * (1 - maxReduction / 100);

    this.logDebug(
      `Применена фрустрация к действию персонажа ${characterId}: ${baseSuccessRate}% -> ${modifiedRate.toFixed(1)}%`,
    );

    return Math.max(modifiedRate, 0.1); // Минимум 10% шанс успеха
  }

  /**
   * Очистка всех состояний фрустрации (для тестов)
   */
  clearAllFrustrationStates(): void {
    // Очищаем все таймеры
    for (const timer of this.frustrationDebuffTimers.values()) {
      clearTimeout(timer);
    }

    this.characterFrustrationLevels.clear();
    this.characterFrustrationTypes.clear();
    this.activeFrustrationPatterns.clear();
    this.frustrationDebuffTimers.clear();

    this.logInfo('Очищены все состояния фрустрации');
  }
}
