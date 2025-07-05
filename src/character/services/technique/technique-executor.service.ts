import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import {
  ITechniqueContext,
  ITechniqueResult,
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../interfaces/technique.interfaces';
import { TechniqueHistoryService } from './technique-history.service';
import {
  TechniqueStrategyService,
  ITechniqueExecutionStrategy,
} from './technique-strategy.service';

/**
 * Координирующий сервис для выполнения манипулятивных техник
 */
@Injectable()
export class TechniqueExecutorService extends BaseService {
  // Система охлаждения техник (characterId -> techniqueType -> lastUsed)
  private readonly techniqueCooldowns = new Map<string, Map<ManipulativeTechniqueType, Date>>();

  // Система мониторинга использования (characterId -> hourlyUsage)
  private readonly hourlyUsage = new Map<string, Map<ManipulativeTechniqueType, number>>();

  // Этические ограничения по персонажам
  private readonly ethicalLimits = new Map<
    string,
    {
      maxIntensity: TechniqueIntensity;
      bannedTechniques: ManipulativeTechniqueType[];
      dailyLimit: number;
    }
  >();

  constructor(
    protected readonly logService: LogService,
    private readonly historyService: TechniqueHistoryService,
    private readonly strategyService: TechniqueStrategyService,
  ) {
    super(logService);
    this.initializeEthicalLimits();
  }

  async executeTechnique(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    context: ITechniqueContext,
    phase: TechniquePhase = TechniquePhase.EXECUTION,
  ): Promise<ITechniqueResult> {
    const characterId = context.characterId.toString();

    // 1. Проверка этических ограничений
    const ethicalCheck = await this.checkEthicalConstraints(characterId, techniqueType, intensity);
    if (!ethicalCheck.allowed) {
      return {
        success: false,
        techniqueType,
        intensity,
        message: `Техника заблокирована: ${ethicalCheck.reason}`,
        effectiveness: 0,
        ethicalScore: 0,
        sideEffects: ['ethical_violation'],
        phase,
      };
    }

    // 2. Проверка охлаждения
    const cooldownCheck = this.checkCooldown(characterId, techniqueType);
    if (!cooldownCheck.ready) {
      return {
        success: false,
        techniqueType,
        intensity,
        message: `Техника на охлаждении еще ${cooldownCheck.remainingMinutes} минут`,
        effectiveness: 0,
        ethicalScore: 100,
        sideEffects: ['cooldown_active'],
        phase,
      };
    }

    // 3. Получение стратегии выполнения
    const strategy = this.strategyService.getStrategy(techniqueType);
    if (!strategy) {
      return {
        success: false,
        techniqueType,
        intensity,
        message: 'Стратегия выполнения не найдена',
        effectiveness: 0,
        ethicalScore: 50,
        sideEffects: ['strategy_not_found'],
        phase,
      };
    }

    // 4. Проверка контекстных требований
    const contextCheck = this.checkContextRequirements(strategy, context);
    if (!contextCheck.valid) {
      return {
        success: false,
        techniqueType,
        intensity,
        message: `Контекст не подходит: ${contextCheck.reason}`,
        effectiveness: 0,
        ethicalScore: 75,
        sideEffects: ['invalid_context'],
        phase,
      };
    }

    // 5. Выполнение техники
    try {
      const intensityModifier = strategy.intensityModifiers[intensity] || 0.5;
      const baseEffectiveness = this.calculateBaseEffectiveness(context, strategy);
      const effectiveness = Math.min(100, baseEffectiveness * intensityModifier * 100);

      // Адаптивный выбор на основе психологического профиля
      const adaptedEffectiveness = await this.adaptToUserProfile(context, effectiveness);

      // Расчет этического рейтинга
      const ethicalScore = this.calculateEthicalScore(techniqueType, intensity, context);

      // Определение побочных эффектов
      const sideEffects = this.determineSideEffects(techniqueType, intensity, adaptedEffectiveness);

      // Регистрация использования
      this.registerUsage(characterId, techniqueType);

      // Сохранение в историю
      const result: ITechniqueResult = {
        success: true,
        techniqueType,
        intensity,
        message: strategy.promptTemplate.replace('{{intensity}}', intensity),
        effectiveness: adaptedEffectiveness,
        ethicalScore,
        sideEffects,
        phase,
      };

      await this.historyService.recordExecution(result);

      this.logInfo(`Техника ${techniqueType} выполнена для персонажа ${characterId}`, {
        characterId,
        techniqueType,
        intensity,
        effectiveness: adaptedEffectiveness,
        ethicalScore,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logError(`Ошибка выполнения техники ${techniqueType}`, { error: errorMessage });
      return {
        success: false,
        techniqueType,
        intensity,
        message: 'Ошибка выполнения техники',
        effectiveness: 0,
        ethicalScore: 50,
        sideEffects: ['execution_error'],
        phase,
      };
    }
  }

  async canExecuteTechnique(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    context: ITechniqueContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const characterId = context.characterId.toString();

    // Проверка этических ограничений
    const ethicalCheck = await this.checkEthicalConstraints(characterId, techniqueType, intensity);
    if (!ethicalCheck.allowed) {
      return { allowed: false, reason: ethicalCheck.reason };
    }

    // Проверка охлаждения
    const cooldownCheck = this.checkCooldown(characterId, techniqueType);
    if (!cooldownCheck.ready) {
      return {
        allowed: false,
        reason: `Техника на охлаждении еще ${cooldownCheck.remainingMinutes} минут`,
      };
    }

    // Проверка стратегии
    const strategy = this.strategyService.getStrategy(techniqueType);
    if (!strategy) {
      return { allowed: false, reason: 'Стратегия выполнения не найдена' };
    }

    // Проверка контекста
    const contextCheck = this.checkContextRequirements(strategy, context);
    if (!contextCheck.valid) {
      return { allowed: false, reason: contextCheck.reason };
    }

    return { allowed: true };
  }

  /**
   * Адаптивный выбор техники на основе психологического профиля пользователя
   */
  async selectAdaptiveTechnique(context: ITechniqueContext): Promise<{
    techniqueType: ManipulativeTechniqueType;
    intensity: TechniqueIntensity;
    confidence: number;
  } | null> {
    const _characterId = context.characterId?.toString();
    const availableStrategies = this.strategyService.getAllStrategies();
    const candidates: Array<{
      techniqueType: ManipulativeTechniqueType;
      intensity: TechniqueIntensity;
      score: number;
    }> = [];

    if (!availableStrategies || availableStrategies.size === 0) {
      return null;
    }

    for (const [techniqueType, strategy] of availableStrategies.entries()) {
      // Проверяем каждую интенсивность
      for (const intensity of Object.values(TechniqueIntensity)) {
        const canExecute = await this.canExecuteTechnique(techniqueType, intensity, context);
        if (canExecute.allowed) {
          const score = await this.calculateTechniqueScore(
            techniqueType,
            intensity,
            context,
            strategy,
          );
          candidates.push({ techniqueType, intensity, score });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Сортируем по рейтингу и выбираем лучший
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    return {
      techniqueType: best.techniqueType,
      intensity: best.intensity,
      confidence: best.score / 100,
    };
  }

  async getTechniqueStatistics(
    characterId: string,
    techniqueType?: ManipulativeTechniqueType,
  ): Promise<{
    totalExecutions: number;
    averageEffectiveness: number;
    averageEthicalScore: number;
    commonSideEffects: string[];
    successRate: number;
    mostEffectiveTechnique?: ManipulativeTechniqueType;
  }> {
    const history = await this.historyService.getHistory(characterId, 100);

    let filteredHistory = history || [];
    if (techniqueType && filteredHistory.length > 0) {
      filteredHistory = filteredHistory.filter(
        h =>
          h.techniqueType === techniqueType ||
          (typeof h.appliedTechnique === 'object' && h.appliedTechnique?.type === techniqueType),
      );
    }

    if (!filteredHistory || filteredHistory.length === 0) {
      return {
        totalExecutions: 0,
        averageEffectiveness: 0,
        averageEthicalScore: 0,
        commonSideEffects: [],
        successRate: 0,
      };
    }

    const totalExecutions = filteredHistory.length;
    const successfulExecutions = filteredHistory.filter(h => h.success).length;
    const averageEffectiveness =
      filteredHistory.reduce((sum, h) => sum + h.effectiveness, 0) / totalExecutions;
    const averageEthicalScore =
      filteredHistory.reduce((sum, h) => sum + h.ethicalScore, 0) / totalExecutions;
    const successRate = (successfulExecutions / totalExecutions) * 100;

    // Анализ побочных эффектов
    const sideEffectsCount = new Map<string, number>();
    filteredHistory.forEach(h => {
      h.sideEffects.forEach(effect => {
        sideEffectsCount.set(effect, (sideEffectsCount.get(effect) || 0) + 1);
      });
    });

    const commonSideEffects = Array.from(sideEffectsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    // Определение самой эффективной техники
    let mostEffectiveTechnique: ManipulativeTechniqueType | undefined;
    if (!techniqueType) {
      const techniqueEffectiveness = new Map<ManipulativeTechniqueType, number>();
      filteredHistory.forEach(h => {
        const historyTechniqueType =
          h.techniqueType ||
          (typeof h.appliedTechnique === 'object' ? h.appliedTechnique?.type : h.appliedTechnique);
        if (historyTechniqueType) {
          const current = techniqueEffectiveness.get(historyTechniqueType) || 0;
          techniqueEffectiveness.set(historyTechniqueType, current + (h.effectiveness || 0));
        }
      });

      let maxEffectiveness = 0;
      for (const [technique, effectiveness] of techniqueEffectiveness) {
        if (effectiveness > maxEffectiveness) {
          maxEffectiveness = effectiveness;
          mostEffectiveTechnique = technique;
        }
      }
    }

    return {
      totalExecutions,
      averageEffectiveness,
      averageEthicalScore,
      commonSideEffects,
      successRate,
      mostEffectiveTechnique,
    };
  }

  async getTechniqueHistory(characterId: string, limit: number = 10): Promise<ITechniqueResult[]> {
    return this.historyService.getHistory(characterId, limit);
  }

  // === PRIVATE METHODS ===

  private initializeEthicalLimits(): void {
    // Устанавливаем базовые этические ограничения
    // В реальном приложении это должно загружаться из конфигурации
  }

  private async checkEthicalConstraints(
    characterId: string,
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = this.ethicalLimits.get(characterId);

    // Проверка запрещенных техник
    if (limits?.bannedTechniques.includes(techniqueType)) {
      return { allowed: false, reason: 'Техника запрещена для данного персонажа' };
    }

    // Проверка максимальной интенсивности
    const intensityLevels = {
      [TechniqueIntensity.SUBTLE]: 1,
      [TechniqueIntensity.MODERATE]: 2,
      [TechniqueIntensity.MEDIUM]: 3,
      [TechniqueIntensity.AGGRESSIVE]: 4,
    };

    if (limits && intensityLevels[intensity] > intensityLevels[limits.maxIntensity]) {
      return { allowed: false, reason: 'Интенсивность превышает разрешенную для персонажа' };
    }

    // Проверка дневного лимита
    const hourlyUsageMap = this.hourlyUsage.get(characterId);
    if (hourlyUsageMap && limits) {
      const totalUsage = Array.from(hourlyUsageMap.values()).reduce((sum, count) => sum + count, 0);
      if (totalUsage >= limits.dailyLimit) {
        return { allowed: false, reason: 'Превышен дневной лимит использования техник' };
      }
    }

    return { allowed: true };
  }

  private checkCooldown(
    characterId: string,
    techniqueType: ManipulativeTechniqueType,
  ): {
    ready: boolean;
    remainingMinutes?: number;
  } {
    const cooldowns = this.techniqueCooldowns.get(characterId);
    if (!cooldowns) {
      return { ready: true };
    }

    const lastUsed = cooldowns.get(techniqueType);
    if (!lastUsed) {
      return { ready: true };
    }

    const strategy = this.strategyService.getStrategy(techniqueType);
    if (!strategy) {
      return { ready: true };
    }

    const cooldownMinutes = strategy.ethicalConstraints.cooldownMinutes;
    const timeSinceLastUse = Date.now() - lastUsed.getTime();
    const remainingCooldown = cooldownMinutes * 60 * 1000 - timeSinceLastUse;

    if (remainingCooldown > 0) {
      return {
        ready: false,
        remainingMinutes: Math.ceil(remainingCooldown / (60 * 1000)),
      };
    }

    return { ready: true };
  }

  private checkContextRequirements(
    strategy: ITechniqueExecutionStrategy,
    context: ITechniqueContext,
  ): {
    valid: boolean;
    reason?: string;
  } {
    // Проверка уровня отношений
    const relationshipLevel = context.relationshipLevel || 0;
    if (relationshipLevel < strategy.contextRequirements.minRelationshipLevel) {
      return {
        valid: false,
        reason: `Недостаточный уровень отношений (требуется ${strategy.contextRequirements.minRelationshipLevel})`,
      };
    }

    // Проверка эмоционального состояния
    const characterEmotion = context.emotionalState?.primary || 'neutral';
    const requiredStates = strategy.contextRequirements.requiredEmotionalStates || [];
    const forbiddenStates = strategy.contextRequirements.forbiddenStates || [];

    if (forbiddenStates.includes(characterEmotion)) {
      return {
        valid: false,
        reason: `Неподходящее эмоциональное состояние: ${characterEmotion}`,
      };
    }

    if (requiredStates.length > 0 && !requiredStates.includes(characterEmotion)) {
      return {
        valid: false,
        reason: `Требуется одно из состояний: ${requiredStates.join(', ')}`,
      };
    }

    return { valid: true };
  }

  private calculateBaseEffectiveness(
    context: ITechniqueContext,
    strategy: ITechniqueExecutionStrategy,
  ): number {
    // Базовая эффективность зависит от соответствия контекста требованиям стратегии
    let effectiveness = 0.5; // Базовая эффективность 50%

    // Бонус за уровень отношений
    const relationshipLevel = context.relationshipLevel || 0;
    const minRequired = strategy.contextRequirements.minRelationshipLevel;
    if (relationshipLevel > minRequired) {
      effectiveness += Math.min(0.3, (relationshipLevel - minRequired) / 100);
    }

    // Бонус за подходящее эмоциональное состояние
    const characterEmotion = context.emotionalState?.primary || 'neutral';
    const requiredStates = strategy.contextRequirements.requiredEmotionalStates || [];
    if (requiredStates.includes(characterEmotion)) {
      effectiveness += 0.2;
    }

    return Math.min(1.0, effectiveness);
  }

  private async adaptToUserProfile(
    context: ITechniqueContext,
    baseEffectiveness: number,
  ): Promise<number> {
    // Адаптация на основе истории успешности техник для данного пользователя
    const userId = context.userId?.toString();
    if (!userId) {
      return baseEffectiveness;
    }

    // Здесь можно добавить логику анализа профиля пользователя
    // Пока возвращаем базовую эффективность
    return baseEffectiveness;
  }

  private calculateEthicalScore(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    _context: ITechniqueContext,
  ): number {
    let score = 100; // Начинаем с максимального этического рейтинга

    // Снижаем рейтинг в зависимости от типа техники
    const techniqueEthicalPenalty = {
      [ManipulativeTechniqueType.VALIDATION]: 0,
      [ManipulativeTechniqueType.CONSTANT_VALIDATION]: 10,
      [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: 15,
      [ManipulativeTechniqueType.PUSH_PULL]: 25,
      [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: 30,
      [ManipulativeTechniqueType.TROJAN_HORSE]: 35,
      [ManipulativeTechniqueType.SNOWBALL]: 40,
      [ManipulativeTechniqueType.TRIANGULATION]: 45,
      [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: 50,
      [ManipulativeTechniqueType.LOVE_BOMBING]: 55,
      [ManipulativeTechniqueType.ISOLATION]: 70,
      [ManipulativeTechniqueType.GASLIGHTING]: 80,
    };

    score -= techniqueEthicalPenalty[techniqueType] || 30;

    // Снижаем рейтинг в зависимости от интенсивности
    const intensityPenalty = {
      [TechniqueIntensity.SUBTLE]: 0,
      [TechniqueIntensity.MODERATE]: 10,
      [TechniqueIntensity.MEDIUM]: 20,
      [TechniqueIntensity.AGGRESSIVE]: 40,
    };

    score -= intensityPenalty[intensity];

    return Math.max(0, score);
  }

  private determineSideEffects(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    effectiveness: number,
  ): string[] {
    const sideEffects: string[] = [];

    // Побочные эффекты в зависимости от типа техники
    if (techniqueType === ManipulativeTechniqueType.GASLIGHTING) {
      sideEffects.push('confusion', 'self_doubt');
    }

    if (techniqueType === ManipulativeTechniqueType.ISOLATION) {
      sideEffects.push('social_withdrawal', 'dependency');
    }

    if (techniqueType === ManipulativeTechniqueType.LOVE_BOMBING) {
      sideEffects.push('emotional_overwhelm', 'unrealistic_expectations');
    }

    // Побочные эффекты в зависимости от интенсивности
    if (intensity === TechniqueIntensity.AGGRESSIVE) {
      sideEffects.push('resistance', 'suspicion');
    }

    // Побочные эффекты при высокой эффективности
    if (effectiveness > 80) {
      sideEffects.push('strong_influence');
    }

    return sideEffects;
  }

  private registerUsage(characterId: string, techniqueType: ManipulativeTechniqueType): void {
    // Регистрируем использование для системы охлаждения
    let cooldowns = this.techniqueCooldowns.get(characterId);
    if (!cooldowns) {
      cooldowns = new Map();
      this.techniqueCooldowns.set(characterId, cooldowns);
    }
    cooldowns.set(techniqueType, new Date());

    // Регистрируем для почасовой статистики
    let hourlyUsageMap = this.hourlyUsage.get(characterId);
    if (!hourlyUsageMap) {
      hourlyUsageMap = new Map();
      this.hourlyUsage.set(characterId, hourlyUsageMap);
    }

    const currentUsage = hourlyUsageMap.get(techniqueType) || 0;
    hourlyUsageMap.set(techniqueType, currentUsage + 1);

    // Очистка старых данных (упрощенная версия)
    setTimeout(
      () => {
        const usage = this.hourlyUsage.get(characterId);
        if (usage) {
          const current = usage.get(techniqueType) || 0;
          if (current > 0) {
            usage.set(techniqueType, current - 1);
          }
        }
      },
      60 * 60 * 1000,
    ); // Очищаем через час
  }

  private async calculateTechniqueScore(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    context: ITechniqueContext,
    strategy: ITechniqueExecutionStrategy,
  ): Promise<number> {
    let score = 50; // Базовый рейтинг

    // Бонус за соответствие контексту
    const contextCheck = this.checkContextRequirements(strategy, context);
    if (contextCheck.valid) {
      score += 30;
    }

    // Бонус за историческую эффективность
    const characterId = context.characterId.toString();
    const stats = await this.getTechniqueStatistics(characterId, techniqueType);
    if (stats.totalExecutions > 0) {
      score += (stats.averageEffectiveness / 100) * 20;
    }

    // Штраф за этические нарушения
    const ethicalScore = this.calculateEthicalScore(techniqueType, intensity, context);
    score += (ethicalScore / 100) * 20;

    return Math.min(100, Math.max(0, score));
  }
}
