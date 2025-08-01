import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { CacheService } from '../../../cache/cache.service';
import { Character } from '../../entities/character.entity';
import {
  FeedbackSignal,
  FeedbackSignalType,
  LearnedBehaviorPattern,
  CharacterAdaptation,
  LearningMetrics,
  LearningConfig,
} from '../../interfaces/learning.interfaces';

interface BehaviorRecommendations {
  preferredTechniques: string[];
  avoidTechniques: string[];
  confidence: number;
  emotionalTone?: string;
  responseLength?: 'short' | 'medium' | 'long';
}

interface AdaptationData {
  techniqueWeights?: Record<string, number>;
  emotionalReactivity?: Record<string, number>;
  communicationStyles?: string[];
  avoidanceTriggers?: string[];
  preferences?: Record<string, any>;
  [key: string]: any;
}

/**
 * Сервис для адаптивного обучения персонажей на основе обратной связи
 * Анализирует собранные сигналы и адаптирует поведение персонажей
 */
@Injectable()
export class CharacterLearningService extends BaseService {
  private readonly CACHE_TTL = 7200; // 2 часа
  private readonly LEARNING_VERSION = '1.0.0';

  // Конфигурация по умолчанию
  private readonly defaultConfig: LearningConfig = {
    minSignalsForPattern: 5,
    confidenceThreshold: 0.7,
    dataRetentionDays: 30,
    patternAnalysisInterval: 24,
    maxPatternsPerCharacter: 20,
    learningEnabled: true,
  };

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly cacheService: CacheService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Обрабатывает новые сигналы обратной связи и обучает персонажа
   */
  async processLearningSignals(
    characterId: number,
    userId: number,
    signals: FeedbackSignal[],
  ): Promise<void> {
    return this.withErrorHandling('обработке сигналов обучения', async () => {
      if (!this.defaultConfig.learningEnabled || signals.length === 0) {
        return;
      }

      this.logInfo('Обработка сигналов обучения', {
        characterId,
        userId,
        signalCount: signals.length,
        signalTypes: signals.map(s => s.type),
      });

      // Сохраняем сигналы для накопления данных
      await this.storeLearningSignals(characterId, userId, signals);

      // Анализируем паттерны на основе накопленных данных
      const patterns = await this.analyzeBehaviorPatterns(characterId, userId);

      // Адаптируем персонажа на основе выученных паттернов
      if (patterns.length > 0) {
        await this.adaptCharacterBehavior(characterId, userId, patterns);
      }
    });
  }

  /**
   * Получает адаптации персонажа для конкретного пользователя
   */
  async getCharacterAdaptation(
    characterId: number,
    userId: number,
  ): Promise<CharacterAdaptation | null> {
    return this.withErrorHandling('получении адаптации персонажа', async () => {
      const cacheKey = `character_adaptation:${characterId}:${userId}`;

      const adaptation = await this.cacheService.get<CharacterAdaptation>(cacheKey);
      if (adaptation) {
        return adaptation;
      }

      // Если адаптации нет в кэше, загружаем из хранилища
      // В реальной реализации это будет база данных
      const storedAdaptation = await this.loadStoredAdaptation(characterId, userId);

      if (storedAdaptation) {
        await this.cacheService.set(cacheKey, storedAdaptation, this.CACHE_TTL);
        return storedAdaptation;
      }

      return null;
    });
  }

  /**
   * Получает рекомендации по поведению для персонажа на основе обученных паттернов
   */
  async getBehaviorRecommendations(
    characterId: number,
    userId: number,
    currentContext: {
      emotionalState?: string;
      dialogContext?: string[];
      timeOfDay?: string;
    },
  ): Promise<BehaviorRecommendations> {
    return this.withErrorHandling('получении рекомендаций поведения', async () => {
      const adaptation = await this.getCharacterAdaptation(characterId, userId);

      if (!adaptation) {
        return {
          preferredTechniques: [],
          avoidTechniques: [],
          confidence: 0,
        };
      }

      const patterns = await this.getLearnedPatterns(characterId, userId);

      // Найдем наиболее подходящие паттерны для текущего контекста
      const applicablePatterns = patterns.filter(pattern =>
        this.isPatternApplicable(pattern, currentContext),
      );

      if (applicablePatterns.length === 0) {
        return {
          preferredTechniques: [],
          avoidTechniques: [],
          confidence: 0,
        };
      }

      // Агрегируем рекомендации из всех применимых паттернов
      const recommendations = this.aggregateRecommendations(applicablePatterns);

      this.logInfo('Сгенерированы рекомендации поведения', {
        characterId,
        userId,
        applicablePatternsCount: applicablePatterns.length,
        confidence: recommendations.confidence,
      });

      return recommendations;
    });
  }

  /**
   * Получает метрики обучения для персонажа
   */
  async getLearningMetrics(characterId: number, userId?: number): Promise<LearningMetrics> {
    return this.withErrorHandling('получении метрик обучения', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Последняя неделя

      const signals = await this.getStoredSignals(characterId, userId, startDate, endDate);
      const patterns = await this.getLearnedPatterns(characterId, userId);

      const totalSignals = signals.length;
      const learnedPatterns = patterns.length;
      const averageEffectiveness =
        patterns.length > 0
          ? patterns.reduce((sum, p) => sum + p.effectiveness.successRate, 0) / patterns.length
          : 0;

      // Вычисляем скорость обучения на основе количества новых паттернов за период
      const recentPatterns = patterns.filter(p => p.effectiveness.lastUpdated >= startDate);
      const learningVelocity = recentPatterns.length / 7; // паттернов в день

      return {
        totalSignals,
        learnedPatterns,
        averagePatternEffectiveness: averageEffectiveness,
        adaptedCharacters: userId ? 1 : await this.getAdaptedCharacterCount(characterId),
        learningVelocity,
        period: { startDate, endDate },
      };
    });
  }

  /**
   * Сохраняет сигналы обучения для дальнейшего анализа
   */
  private async storeLearningSignals(
    characterId: number,
    userId: number,
    signals: FeedbackSignal[],
  ): Promise<void> {
    // В реальной реализации сохраняем в базу данных
    const storageKey = `learning_signals:${characterId}:${userId}`;

    const existingSignals = (await this.cacheService.get<FeedbackSignal[]>(storageKey)) || [];
    const updatedSignals = [...existingSignals, ...signals];

    // Ограничиваем количество хранимых сигналов
    const maxSignals = 100;
    const signalsToStore = updatedSignals.slice(-maxSignals);

    await this.cacheService.set(storageKey, signalsToStore, this.CACHE_TTL * 24); // 24 часа
  }

  /**
   * Анализирует паттерны поведения на основе накопленных сигналов
   */
  private async analyzeBehaviorPatterns(
    characterId: number,
    userId: number,
  ): Promise<LearnedBehaviorPattern[]> {
    const signals = await this.getStoredSignals(characterId, userId);

    if (signals.length < this.defaultConfig.minSignalsForPattern) {
      return [];
    }

    const patterns: LearnedBehaviorPattern[] = [];

    // Анализируем паттерны по типам сигналов
    const signalGroups = this.groupSignalsByType(signals);

    for (const [signalType, groupSignals] of Object.entries(signalGroups)) {
      if (groupSignals.length < this.defaultConfig.minSignalsForPattern) {
        continue;
      }

      const pattern = await this.extractPattern(signalType as FeedbackSignalType, groupSignals);
      if (pattern && pattern.effectiveness.confidence >= this.defaultConfig.confidenceThreshold) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Адаптирует поведение персонажа на основе выученных паттернов
   */
  private async adaptCharacterBehavior(
    characterId: number,
    userId: number,
    patterns: LearnedBehaviorPattern[],
  ): Promise<void> {
    const existingAdaptation = await this.getCharacterAdaptation(characterId, userId);

    const adaptation: CharacterAdaptation = {
      characterId,
      userId,
      adaptations: this.mergeAdaptations(existingAdaptation?.adaptations, patterns),
      timeframe: {
        startDate: existingAdaptation?.timeframe.startDate || new Date(),
        lastUpdate: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
      },
      quality: {
        signalCount: patterns.reduce((sum, p) => sum + p.effectiveness.usageCount, 0),
        confidence:
          patterns.reduce((sum, p) => sum + p.effectiveness.confidence, 0) / patterns.length,
        improvement: this.calculateImprovement(patterns),
      },
    };

    // Сохраняем адаптацию
    const cacheKey = `character_adaptation:${characterId}:${userId}`;
    await this.cacheService.set(cacheKey, adaptation, this.CACHE_TTL);

    this.logInfo('Адаптировано поведение персонажа', {
      characterId,
      userId,
      patternsCount: patterns.length,
      confidence: adaptation.quality.confidence,
    });
  }

  /**
   * Группирует сигналы по типам для анализа
   */
  private groupSignalsByType(signals: FeedbackSignal[]): Record<string, FeedbackSignal[]> {
    return signals.reduce(
      (groups, signal) => {
        const type = signal.type;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(signal);
        return groups;
      },
      {} as Record<string, FeedbackSignal[]>,
    );
  }

  /**
   * Извлекает паттерн из группы сигналов одного типа
   */
  private async extractPattern(
    signalType: FeedbackSignalType,
    signals: FeedbackSignal[],
  ): Promise<LearnedBehaviorPattern | null> {
    const positiveSignals = signals.filter(s => s.valence === 'positive');
    const negativeSignals = signals.filter(s => s.valence === 'negative');

    // Анализируем контекст сигналов для выявления условий
    const conditions = this.analyzeSignalConditions(signals);

    // Определяем рекомендации на основе положительных и отрицательных сигналов
    const recommendations = this.analyzeSignalRecommendations(positiveSignals, negativeSignals);

    const successRate = positiveSignals.length / (positiveSignals.length + negativeSignals.length);
    const confidence = Math.min(1, signals.length / this.defaultConfig.minSignalsForPattern);

    return {
      id: `pattern_${signalType}_${Date.now()}`,
      name: `Паттерн для ${signalType}`,
      conditions,
      recommendations,
      effectiveness: {
        usageCount: signals.length,
        successRate,
        lastUpdated: new Date(),
        confidence,
      },
    };
  }

  /**
   * Анализирует условия применения паттерна из сигналов
   */
  private analyzeSignalConditions(signals: FeedbackSignal[]): any {
    const emotionalStates = signals.map(s => s.context.emotionalState).filter(Boolean);

    const techniques = signals.map(s => s.context.technique).filter(Boolean);

    return {
      emotionalState: [...new Set(emotionalStates)],
      techniques: [...new Set(techniques)],
    };
  }

  /**
   * Определяет рекомендации на основе положительных и отрицательных сигналов
   */
  private analyzeSignalRecommendations(
    positiveSignals: FeedbackSignal[],
    negativeSignals: FeedbackSignal[],
  ): any {
    const positiveTechniques = positiveSignals.map(s => s.context.technique).filter(Boolean);

    const negativeTechniques = negativeSignals.map(s => s.context.technique).filter(Boolean);

    return {
      preferredTechniques: [...new Set(positiveTechniques)],
      avoidTechniques: [...new Set(negativeTechniques)],
    };
  }

  /**
   * Проверяет применимость паттерна к текущему контексту
   */
  private isPatternApplicable(pattern: LearnedBehaviorPattern, context: any): boolean {
    // Простая проверка совпадения эмоционального состояния
    if (context.emotionalState && pattern.conditions.emotionalState) {
      return pattern.conditions.emotionalState.includes(context.emotionalState);
    }

    return true;
  }

  /**
   * Агрегирует рекомендации из нескольких паттернов
   */
  private aggregateRecommendations(patterns: LearnedBehaviorPattern[]): BehaviorRecommendations {
    const allPreferred = patterns.flatMap(p => p.recommendations.preferredTechniques);
    const allAvoid = patterns.flatMap(p => p.recommendations.avoidTechniques);

    const confidence =
      patterns.reduce((sum, p) => sum + p.effectiveness.confidence, 0) / patterns.length;

    return {
      preferredTechniques: [...new Set(allPreferred)],
      avoidTechniques: [...new Set(allAvoid)],
      confidence,
    };
  }

  /**
   * Объединяет существующие адаптации с новыми паттернами
   */
  private mergeAdaptations(
    existing: AdaptationData | null | undefined,
    patterns: LearnedBehaviorPattern[],
  ): AdaptationData {
    const techniqueWeights: Record<string, number> = existing?.techniqueWeights || {};

    patterns.forEach(pattern => {
      pattern.recommendations.preferredTechniques.forEach(technique => {
        techniqueWeights[technique] = (techniqueWeights[technique] || 0) + 0.1;
      });

      pattern.recommendations.avoidTechniques.forEach(technique => {
        techniqueWeights[technique] = (techniqueWeights[technique] || 0) - 0.1;
      });
    });

    return {
      techniqueWeights,
      ...existing,
    };
  }

  /**
   * Вычисляет улучшение на основе паттернов
   */
  private calculateImprovement(patterns: LearnedBehaviorPattern[]): number {
    if (patterns.length === 0) return 0;

    return patterns.reduce((sum, p) => sum + p.effectiveness.successRate, 0) / patterns.length;
  }

  // Заглушки для методов, которые в реальности работали бы с базой данных
  private async loadStoredAdaptation(
    _characterId: number,
    _userId: number,
  ): Promise<CharacterAdaptation | null> {
    return null;
  }

  private async getStoredSignals(
    characterId: number,
    userId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<FeedbackSignal[]> {
    const storageKey = userId
      ? `learning_signals:${characterId}:${userId}`
      : `learning_signals:${characterId}`;

    const signals = (await this.cacheService.get<FeedbackSignal[]>(storageKey)) || [];

    if (startDate && endDate) {
      return signals.filter(s => s.timestamp >= startDate && s.timestamp <= endDate);
    }

    return signals;
  }

  private async getLearnedPatterns(
    _characterId: number,
    _userId?: number,
  ): Promise<LearnedBehaviorPattern[]> {
    // В реальности загружаем из базы данных
    return [];
  }

  private async getAdaptedCharacterCount(_characterId: number): Promise<number> {
    // В реальности считаем из базы данных
    return 1;
  }
}
