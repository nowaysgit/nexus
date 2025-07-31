import {
  EmotionalState,
  EmotionalUpdate,
  EmotionalMemory,
  EmotionalTransition,
  EmotionalProfile,
  EmotionalContext,
  EmotionalEvent,
  EmotionalPattern,
  EmotionalRegulationStrategy,
} from '../entities/emotional-state';
import { MessageAnalysis } from './analysis.interfaces';
import { INeed } from './needs.interfaces';

/**
 * Интерфейс для сервиса, управляющего эмоциональным состоянием персонажа.
 */
export interface IEmotionalStateService {
  /**
   * Получает текущее эмоциональное состояние персонажа.
   * @param characterId - ID персонажа.
   * @returns Текущее эмоциональное состояние.
   */
  getEmotionalState(characterId: number): Promise<EmotionalState>;

  /**
   * Обновляет эмоциональное состояние персонажа на основе анализа сообщения или прямого обновления.
   * @param characterId - ID персонажа.
   * @param analysisOrUpdate - Контекст для обновления.
   * @returns Обновленное эмоциональное состояние.
   */
  updateEmotionalState(
    characterId: number,
    analysisOrUpdate: MessageAnalysis | EmotionalUpdate,
  ): Promise<EmotionalState>;

  /**
   * Обновляет эмоциональное состояние на основе текущих потребностей.
   * @param characterId ID персонажа
   * @param needs Список потребностей
   */
  updateEmotionalStateFromNeeds(characterId: number, needs: INeed[]): Promise<EmotionalState>;

  // Новые методы для расширенной эмоциональной системы

  /**
   * Получает эмоциональный профиль персонажа
   * @param characterId ID персонажа
   * @returns Эмоциональный профиль
   */
  getEmotionalProfile(characterId: number): Promise<EmotionalProfile>;

  /**
   * Обновляет эмоциональный профиль персонажа
   * @param characterId ID персонажа
   * @param profile Новый эмоциональный профиль
   * @returns Обновленный профиль
   */
  updateEmotionalProfile(
    characterId: number,
    profile: Partial<EmotionalProfile>,
  ): Promise<EmotionalProfile>;

  /**
   * Создает новое эмоциональное воспоминание
   * @param characterId ID персонажа
   * @param state Эмоциональное состояние
   * @param trigger Триггер эмоции
   * @param context Контекст
   * @param significance Значимость (0-100)
   * @returns Созданное воспоминание
   */
  createEmotionalMemory(
    characterId: number,
    state: EmotionalState,
    trigger: string,
    context: EmotionalContext,
    significance: number,
  ): Promise<EmotionalMemory>;

  /**
   * Получает эмоциональные воспоминания персонажа
   * @param characterId ID персонажа
   * @param filters Фильтры для поиска
   * @param limit Максимальное количество результатов
   * @returns Список воспоминаний
   */
  getEmotionalMemories(
    characterId: number,
    filters?: {
      emotions?: string[];
      timeRange?: { from: Date; to: Date };
      significance?: { min: number; max: number };
      tags?: string[];
    },
    limit?: number,
  ): Promise<EmotionalMemory[]>;

  /**
   * Создает эмоциональный переход
   * @param characterId ID персонажа
   * @param fromState Исходное состояние
   * @param toState Целевое состояние
   * @param trigger Триггер перехода
   * @param context Контекст перехода
   * @returns Информация о переходе
   */
  createEmotionalTransition(
    characterId: number,
    fromState: EmotionalState,
    toState: EmotionalState,
    trigger: string,
    context: EmotionalContext,
  ): Promise<EmotionalTransition>;

  /**
   * Получает историю эмоциональных переходов
   * @param characterId ID персонажа
   * @param timeRange Временной диапазон
   * @param limit Максимальное количество результатов
   * @returns История переходов
   */
  getEmotionalTransitions(
    characterId: number,
    timeRange?: { from: Date; to: Date },
    limit?: number,
  ): Promise<EmotionalTransition[]>;

  /**
   * Применяет стратегию эмоциональной регуляции
   * @param characterId ID персонажа
   * @param strategy Стратегия регуляции
   * @param intensity Интенсивность применения (0-100)
   * @param context Контекст применения
   * @returns Результат применения стратегии
   */
  applyEmotionalRegulation(
    characterId: number,
    strategy: EmotionalRegulationStrategy,
    intensity: number,
    context: EmotionalContext,
  ): Promise<{
    success: boolean;
    newState: EmotionalState;
    effectiveness: number;
    sideEffects: string[];
  }>;

  /**
   * Анализирует эмоциональные паттерны персонажа
   * @param characterId ID персонажа
   * @param timeRange Временной диапазон для анализа
   * @returns Найденные паттерны
   */
  analyzeEmotionalPatterns(
    characterId: number,
    timeRange: { from: Date; to: Date },
  ): Promise<EmotionalPattern[]>;

  /**
   * Предсказывает эмоциональную реакцию на событие
   * @param characterId ID персонажа
   * @param trigger Триггер события
   * @param context Контекст события
   * @returns Предсказанная реакция
   */
  predictEmotionalReaction(
    characterId: number,
    trigger: string,
    context: EmotionalContext,
  ): Promise<{
    predictedState: EmotionalState;
    confidence: number;
    alternativeStates: EmotionalState[];
    factors: string[];
  }>;

  /**
   * Создает эмоциональное событие для системы памяти
   * @param characterId ID персонажа
   * @param type Тип события
   * @param data Данные события
   * @param context Контекст события
   * @param significance Значимость события
   * @returns Созданное событие
   */
  createEmotionalEvent(
    characterId: number,
    type: EmotionalEvent['type'],
    data: Record<string, unknown>,
    context: EmotionalContext,
    significance: number,
  ): Promise<EmotionalEvent>;

  /**
   * Получает эмоциональные события персонажа
   * @param characterId ID персонажа
   * @param filters Фильтры для поиска
   * @param limit Максимальное количество результатов
   * @returns Список событий
   */
  getEmotionalEvents(
    characterId: number,
    filters?: {
      types?: EmotionalEvent['type'][];
      timeRange?: { from: Date; to: Date };
      significance?: { min: number; max: number };
    },
    limit?: number,
  ): Promise<EmotionalEvent[]>;

  /**
   * Симулирует каскадные эмоциональные эффекты
   * @param characterId ID персонажа
   * @param initialEmotion Исходная эмоция
   * @param context Контекст
   * @param maxDepth Максимальная глубина каскада
   * @returns Результаты симуляции
   */
  simulateEmotionalCascade(
    characterId: number,
    initialEmotion: string,
    context: EmotionalContext,
    maxDepth?: number,
  ): Promise<{
    cascadeSteps: EmotionalState[];
    finalState: EmotionalState;
    duration: number;
    probability: number;
  }>;

  /**
   * Анализирует эмоциональную совместимость с другим персонажем
   * @param characterId1 ID первого персонажа
   * @param characterId2 ID второго персонажа
   * @param context Контекст взаимодействия
   * @returns Анализ совместимости
   */
  analyzeEmotionalCompatibility(
    characterId1: number,
    characterId2: number,
    context: EmotionalContext,
  ): Promise<{
    overallCompatibility: number;
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    synergies: string[];
    conflicts: string[];
  }>;

  /**
   * Оптимизирует эмоциональное состояние для достижения цели
   * @param characterId ID персонажа
   * @param goal Цель оптимизации
   * @param constraints Ограничения
   * @param context Контекст
   * @returns План оптимизации
   */
  optimizeEmotionalState(
    characterId: number,
    goal: string,
    constraints: string[],
    context: EmotionalContext,
  ): Promise<{
    targetState: EmotionalState;
    strategy: EmotionalRegulationStrategy;
    steps: string[];
    expectedDuration: number;
    successProbability: number;
  }>;

  /**
   * Создает эмоциональный снимок персонажа
   * @param characterId ID персонажа
   * @returns Полный снимок эмоционального состояния
   */
  createEmotionalSnapshot(characterId: number): Promise<{
    timestamp: Date;
    state: EmotionalState;
    profile: EmotionalProfile;
    recentMemories: EmotionalMemory[];
    activePatterns: EmotionalPattern[];
    context: EmotionalContext;
    metadata: Record<string, any>;
  }>;

  /**
   * Восстанавливает эмоциональное состояние из снимка
   * @param characterId ID персонажа
   * @param snapshot Снимок для восстановления
   * @returns Результат восстановления
   */
  restoreFromSnapshot(
    characterId: number,
    snapshot: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    restoredState: EmotionalState;
    differences: string[];
  }>;
}
