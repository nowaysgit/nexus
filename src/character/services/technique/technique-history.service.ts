import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { TechniqueExecution } from '../../entities/manipulation-technique.entity';
import { UserManipulationProfile } from '../../entities/manipulation-technique.entity';
import { ManipulativeTechniqueType, ITechniqueResult } from '../../interfaces/technique.interfaces';

/**
 * Сервис для управления историей выполнения техник влияния
 * Обеспечивает персистентность, аналитику и адаптацию на основе истории
 */
@Injectable()
export class TechniqueHistoryService extends BaseService {
  constructor(
    protected readonly logService: LogService,
    @InjectRepository(TechniqueExecution)
    private readonly techniqueExecutionRepository: Repository<TechniqueExecution>,
    @InjectRepository(UserManipulationProfile)
    private readonly userProfileRepository: Repository<UserManipulationProfile>,
  ) {
    super(logService);
  }

  /**
   * Записывает выполнение техники в базу данных
   */
  async recordTechniqueExecution(
    data: ITechniqueResult & {
      characterId: number;
      userId: number;
      executionContext?: any;
    },
  ): Promise<void> {
    return this.withErrorHandling('записи выполнения техники', async () => {
      const execution = this.techniqueExecutionRepository.create({
        techniqueType: data.techniqueType,
        intensity: data.intensity,
        phase: data.phase,
        characterId: data.characterId,
        userId: data.userId,
        generatedResponse: data.message,
        effectiveness: data.effectiveness || 0,
        ethicalScore: data.ethicalScore || 50,
        sideEffects: data.sideEffects || [],
        startTime: new Date(),
        endTime: new Date(),
        executionContext: data.executionContext,
      });

      await this.techniqueExecutionRepository.save(execution);

      // Обновляем профиль пользователя
      await this.updateUserProfile(data.characterId, data.userId, data);

      this.logInfo(
        `Записано выполнение техники ${data.techniqueType} для персонажа ${data.characterId}`,
      );
    });
  }

  /**
   * Записывает результат выполнения техники
   */
  async recordExecution(
    result: ITechniqueResult & {
      characterId?: number;
      userId?: number;
    },
  ): Promise<void> {
    if (!result.characterId || !result.userId) {
      this.logWarning('Не удалось записать выполнение техники: отсутствуют characterId или userId');
      return;
    }

    await this.recordTechniqueExecution({
      ...result,
      characterId: result.characterId,
      userId: result.userId,
    });
  }

  /**
   * Получает историю выполнения техник для персонажа
   */
  async getHistory(characterId: string, limit: number = 10): Promise<ITechniqueResult[]> {
    return this.withErrorHandling('получения истории техник', async () => {
      const executions = await this.techniqueExecutionRepository.find({
        where: { characterId: parseInt(characterId) },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return executions.map(execution => ({
        success: execution.effectiveness > 0,
        message: execution.generatedResponse,
        techniqueType: execution.techniqueType,
        intensity: execution.intensity,
        phase: execution.phase,
        effectiveness: execution.effectiveness,
        ethicalScore: execution.ethicalScore,
        sideEffects: execution.sideEffects || [],
      }));
    });
  }

  /**
   * Получает статистику по технике
   */
  async getTechniqueStatistics(
    characterId: string,
    techniqueType?: ManipulativeTechniqueType,
  ): Promise<{
    totalExecutions: number;
    averageEffectiveness: number;
    averageEthicalScore: number;
    commonSideEffects: string[];
    successRate: number;
    lastUsed?: Date;
    trendsData?: {
      effectivenessOverTime: Array<{ date: Date; effectiveness: number }>;
      usageFrequency: Array<{ period: string; count: number }>;
    };
  }> {
    return this.withErrorHandling('получения статистики техник', async () => {
      const whereCondition: any = { characterId: parseInt(characterId) };
      if (techniqueType) {
        whereCondition.techniqueType = techniqueType;
      }

      const executions = await this.techniqueExecutionRepository.find({
        where: whereCondition,
        order: { createdAt: 'DESC' },
      });

      if (executions.length === 0) {
        return {
          totalExecutions: 0,
          averageEffectiveness: 0,
          averageEthicalScore: 0,
          commonSideEffects: [],
          successRate: 0,
        };
      }

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.effectiveness > 50).length;
      const averageEffectiveness =
        executions.reduce((sum, e) => sum + e.effectiveness, 0) / totalExecutions;
      const averageEthicalScore =
        executions.reduce((sum, e) => sum + e.ethicalScore, 0) / totalExecutions;
      const successRate = (successfulExecutions / totalExecutions) * 100;

      // Анализ побочных эффектов
      const sideEffectsCount = new Map<string, number>();
      executions.forEach(e => {
        (e.sideEffects || []).forEach(effect => {
          sideEffectsCount.set(effect, (sideEffectsCount.get(effect) || 0) + 1);
        });
      });

      const commonSideEffects = Array.from(sideEffectsCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

      // Анализ трендов
      const trendsData = this.analyzeTrends(executions);

      return {
        totalExecutions,
        averageEffectiveness,
        averageEthicalScore,
        commonSideEffects,
        successRate,
        lastUsed: executions[0]?.createdAt,
        trendsData,
      };
    });
  }

  /**
   * Получает историю техник для персонажа
   */
  async getTechniqueHistory(characterId: string, limit: number = 10): Promise<ITechniqueResult[]> {
    return this.getHistory(characterId, limit);
  }

  /**
   * Получает рекомендации по технике на основе истории
   */
  async getTechniqueRecommendations(
    characterId: number,
    userId: number,
    context?: any,
  ): Promise<{
    recommendedTechnique: ManipulativeTechniqueType;
    confidence: number;
    reasoning: string;
    alternativeTechniques: ManipulativeTechniqueType[];
  }> {
    return this.withErrorHandling('получения рекомендаций по технике', async () => {
      // Получаем профиль пользователя
      const profile = await this.userProfileRepository.findOne({
        where: { characterId, userId },
      });

      if (!profile) {
        return {
          recommendedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          confidence: 0.3,
          reasoning: 'Нет данных о профиле пользователя, используется техника по умолчанию',
          alternativeTechniques: [
            ManipulativeTechniqueType.VALIDATION,
            ManipulativeTechniqueType.PUSH_PULL,
          ],
        };
      }

      // Анализируем эффективность техник
      const effectivenessHistory = profile.effectivenessHistory || [];
      if (effectivenessHistory.length === 0) {
        return {
          recommendedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          confidence: 0.4,
          reasoning: 'Нет истории использования техник, используется безопасная техника',
          alternativeTechniques: [
            ManipulativeTechniqueType.VALIDATION,
            ManipulativeTechniqueType.CONSTANT_VALIDATION,
          ],
        };
      }

      // Находим самую эффективную технику
      const bestTechnique = effectivenessHistory.reduce((best, current) =>
        current.avgEffectiveness > best.avgEffectiveness ? current : best,
      );

      // Проверяем, не использовалась ли техника недавно
      const recentlyUsed =
        new Date(bestTechnique.lastUsed).getTime() > Date.now() - 24 * 60 * 60 * 1000;

      if (recentlyUsed && bestTechnique.attempts > 3) {
        // Ищем альтернативную технику
        const alternatives = effectivenessHistory
          .filter(h => h.techniqueType !== bestTechnique.techniqueType)
          .sort((a, b) => b.avgEffectiveness - a.avgEffectiveness)
          .slice(0, 3);

        if (alternatives.length > 0) {
          return {
            recommendedTechnique: alternatives[0].techniqueType,
            confidence: 0.7,
            reasoning: `Лучшая техника ${bestTechnique.techniqueType} использовалась недавно, рекомендуется альтернатива`,
            alternativeTechniques: alternatives.slice(1).map(a => a.techniqueType),
          };
        }
      }

      return {
        recommendedTechnique: bestTechnique.techniqueType,
        confidence: Math.min(0.9, bestTechnique.avgEffectiveness / 100),
        reasoning: `Техника показала среднюю эффективность ${bestTechnique.avgEffectiveness.toFixed(1)}% за ${bestTechnique.attempts} применений`,
        alternativeTechniques: effectivenessHistory
          .filter(h => h.techniqueType !== bestTechnique.techniqueType)
          .sort((a, b) => b.avgEffectiveness - a.avgEffectiveness)
          .slice(0, 2)
          .map(h => h.techniqueType),
      };
    });
  }

  /**
   * Обновляет профиль пользователя на основе результата выполнения техники
   */
  private async updateUserProfile(
    characterId: number,
    userId: number,
    result: ITechniqueResult,
  ): Promise<void> {
    let profile = await this.userProfileRepository.findOne({
      where: { characterId, userId },
    });

    if (!profile) {
      profile = this.userProfileRepository.create({
        characterId,
        userId,
        susceptibilityScore: 50,
        vulnerabilities: [],
        successfulTechniques: [],
        resistedTechniques: [],
        emotionalTriggers: [],
        susceptibilityRatings: {},
        effectivenessHistory: [],
        immuneTechniques: [],
      });
    }

    // Обновляем рейтинг восприимчивости
    if (result.techniqueType) {
      profile.susceptibilityRatings = profile.susceptibilityRatings || {} as Record<ManipulativeTechniqueType, number>;
      profile.susceptibilityRatings[result.techniqueType] = result.effectiveness || 0;

      // Обновляем историю эффективности
      profile.effectivenessHistory = profile.effectivenessHistory || [];
      const existingHistory = profile.effectivenessHistory.find(
        h => h.techniqueType === result.techniqueType,
      );

      if (existingHistory) {
        const newAvg =
          (existingHistory.avgEffectiveness * existingHistory.attempts +
            (result.effectiveness || 0)) /
          (existingHistory.attempts + 1);
        existingHistory.avgEffectiveness = newAvg;
        existingHistory.attempts += 1;
        existingHistory.lastUsed = new Date();
      } else {
        profile.effectivenessHistory.push({
          techniqueType: result.techniqueType,
          attempts: 1,
          avgEffectiveness: result.effectiveness || 0,
          lastUsed: new Date(),
        });
      }

      // Обновляем списки успешных/неуспешных техник
      if ((result.effectiveness || 0) > 70) {
        if (!profile.successfulTechniques.includes(result.techniqueType)) {
          profile.successfulTechniques.push(result.techniqueType);
        }
      } else if ((result.effectiveness || 0) < 30) {
        if (!profile.resistedTechniques.includes(result.techniqueType)) {
          profile.resistedTechniques.push(result.techniqueType);
        }
      }
    }

    // Обновляем общий рейтинг восприимчивости
    const ratings = Object.values(profile.susceptibilityRatings || {});
    if (ratings.length > 0) {
      profile.susceptibilityScore =
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    }

    profile.lastUpdate = new Date();
    await this.userProfileRepository.save(profile);
  }

  /**
   * Анализирует тренды использования техник
   */
  private analyzeTrends(executions: TechniqueExecution[]): {
    effectivenessOverTime: Array<{ date: Date; effectiveness: number }>;
    usageFrequency: Array<{ period: string; count: number }>;
  } {
    // Анализ эффективности во времени
    const effectivenessOverTime = executions
      .slice(0, 30) // Последние 30 записей
      .map(e => ({
        date: e.createdAt,
        effectiveness: e.effectiveness,
      }))
      .reverse();

    // Анализ частоты использования по периодам
    const usageByDay = new Map<string, number>();
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    executions
      .filter(e => e.createdAt >= last7Days)
      .forEach(e => {
        const day = e.createdAt.toISOString().split('T')[0];
        usageByDay.set(day, (usageByDay.get(day) || 0) + 1);
      });

    const usageFrequency = Array.from(usageByDay.entries())
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      effectivenessOverTime,
      usageFrequency,
    };
  }

  /**
   * Получает аналитику по всем техникам персонажа
   */
  async getCharacterTechniqueAnalytics(characterId: number): Promise<{
    totalTechniques: number;
    mostUsedTechnique: ManipulativeTechniqueType;
    mostEffectiveTechnique: ManipulativeTechniqueType;
    averageEthicalScore: number;
    trendsAnalysis: {
      improvingTechniques: ManipulativeTechniqueType[];
      decliningTechniques: ManipulativeTechniqueType[];
    };
  }> {
    return this.withErrorHandling('получения аналитики по технике персонажа', async () => {
      const executions = await this.techniqueExecutionRepository.find({
        where: { characterId },
        order: { createdAt: 'DESC' },
        take: 100,
      });

      if (executions.length === 0) {
        return {
          totalTechniques: 0,
          mostUsedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          mostEffectiveTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          averageEthicalScore: 50,
          trendsAnalysis: {
            improvingTechniques: [],
            decliningTechniques: [],
          },
        };
      }

      // Подсчет использования техник
      const usageCount = new Map<ManipulativeTechniqueType, number>();
      const effectivenessSum = new Map<ManipulativeTechniqueType, number>();

      executions.forEach(e => {
        usageCount.set(e.techniqueType, (usageCount.get(e.techniqueType) || 0) + 1);
        effectivenessSum.set(
          e.techniqueType,
          (effectivenessSum.get(e.techniqueType) || 0) + e.effectiveness,
        );
      });

      // Находим самую используемую технику
      const mostUsedTechnique = Array.from(usageCount.entries()).sort((a, b) => b[1] - a[1])[0][0];

      // Находим самую эффективную технику
      const avgEffectiveness = new Map<ManipulativeTechniqueType, number>();
      effectivenessSum.forEach((sum, technique) => {
        avgEffectiveness.set(technique, sum / usageCount.get(technique));
      });

      const mostEffectiveTechnique = Array.from(avgEffectiveness.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0][0];

      // Средний этический рейтинг
      const averageEthicalScore =
        executions.reduce((sum, e) => sum + e.ethicalScore, 0) / executions.length;

      // Анализ трендов (сравнение первой и второй половины данных)
      const midpoint = Math.floor(executions.length / 2);
      const recentExecutions = executions.slice(0, midpoint);
      const olderExecutions = executions.slice(midpoint);

      const trendsAnalysis = this.analyzeTechniquesTrends(recentExecutions, olderExecutions);

      return {
        totalTechniques: usageCount.size,
        mostUsedTechnique,
        mostEffectiveTechnique,
        averageEthicalScore,
        trendsAnalysis,
      };
    });
  }

  /**
   * Анализирует тренды техник (улучшение/ухудшение)
   */
  private analyzeTechniquesTrends(
    recentExecutions: TechniqueExecution[],
    olderExecutions: TechniqueExecution[],
  ): {
    improvingTechniques: ManipulativeTechniqueType[];
    decliningTechniques: ManipulativeTechniqueType[];
  } {
    const recentAvg = this.calculateAverageEffectiveness(recentExecutions);
    const olderAvg = this.calculateAverageEffectiveness(olderExecutions);

    const improvingTechniques: ManipulativeTechniqueType[] = [];
    const decliningTechniques: ManipulativeTechniqueType[] = [];

    // Сравниваем эффективность техник
    for (const technique of Object.values(ManipulativeTechniqueType)) {
      const recentEff = recentAvg.get(technique) || 0;
      const olderEff = olderAvg.get(technique) || 0;

      if (recentEff > 0 && olderEff > 0) {
        const improvement = recentEff - olderEff;
        if (improvement > 10) {
          improvingTechniques.push(technique);
        } else if (improvement < -10) {
          decliningTechniques.push(technique);
        }
      }
    }

    return {
      improvingTechniques,
      decliningTechniques,
    };
  }

  /**
   * Вычисляет среднюю эффективность техник
   */
  private calculateAverageEffectiveness(
    executions: TechniqueExecution[],
  ): Map<ManipulativeTechniqueType, number> {
    const effectivenessSum = new Map<ManipulativeTechniqueType, number>();
    const usageCount = new Map<ManipulativeTechniqueType, number>();

    executions.forEach(e => {
      effectivenessSum.set(
        e.techniqueType,
        (effectivenessSum.get(e.techniqueType) || 0) + e.effectiveness,
      );
      usageCount.set(e.techniqueType, (usageCount.get(e.techniqueType) || 0) + 1);
    });

    const avgEffectiveness = new Map<ManipulativeTechniqueType, number>();
    effectivenessSum.forEach((sum, technique) => {
      avgEffectiveness.set(technique, sum / usageCount.get(technique));
    });

    return avgEffectiveness;
  }
}
