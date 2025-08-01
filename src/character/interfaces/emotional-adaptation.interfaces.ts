/**
 * Интерфейсы для системы эмоциональной адаптации персонажей
 */

export enum EmotionalAdaptationType {
  NO_ADAPTATION = 'no_adaptation',
  INTENSITY_ADJUSTMENT = 'intensity_adjustment',
  RESPONSE_STYLE_ADJUSTMENT = 'response_style_adjustment',
  EMOTIONAL_TYPE_SHIFT = 'emotional_type_shift',
  CONTEXTUAL_ADJUSTMENT = 'contextual_adjustment',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  EMOTIONAL_SUPPORT = 'emotional_support',
  LEARNING_OPTIMIZATION = 'learning_optimization',
  PERSONALIZATION = 'personalization',
}

export enum EmotionalResponseType {
  IMMEDIATE = 'immediate',
  DELAYED = 'delayed',
  BALANCED = 'balanced',
  THOUGHTFUL = 'thoughtful',
}

export enum EmotionalSensitivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ADAPTIVE = 'adaptive',
}

export enum EmotionalAdaptationScope {
  GLOBAL = 'global',
  CHARACTER_SPECIFIC = 'character_specific',
  EMOTION_SPECIFIC = 'emotion_specific',
  CONTEXT_SPECIFIC = 'context_specific',
}

/**
 * Профиль эмоциональной адаптации для персонажа
 */
export interface IEmotionalAdaptationProfile {
  characterId: number;
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
  interactionCount: number;
  adaptationLevel: number; // 0-1, уровень адаптации от базовой модели
  responsePreferences: IEmotionalResponsePreference;
  boundaryPreferences: IEmotionalBoundaryPreference;
  adaptationHistory: IEmotionalAdaptationHistoryItem[];
  learningRate: number; // Скорость обучения модели
  effectivenessScore: number; // Оценка эффективности адаптации
}

/**
 * Предпочтения пользователя относительно эмоциональных реакций
 */
export interface IEmotionalResponsePreference {
  preferredIntensityRange: { min: number; max: number }; // 1-10
  preferredEmotionalTypes: string[]; // Предпочитаемые типы эмоций
  avoidedEmotionalTypes: string[]; // Нежелательные типы эмоций
  responseTimePreference: EmotionalResponseType;
  sensitivityLevel: EmotionalSensitivityLevel;
  contextualAdaptation: boolean; // Адаптация на основе контекста
}

/**
 * Границы адаптации для предотвращения чрезмерных изменений
 */
export interface IEmotionalBoundaryPreference {
  maxIntensityDeviation: number; // Максимальное отклонение интенсивности
  allowedEmotionalRange: string[]; // Разрешенный диапазон эмоций
  restrictedEmotions: string[]; // Ограниченные эмоции
  adaptationLimits: {
    maxPositiveShift: number; // Максимальный сдвиг в положительную сторону
    maxNegativeShift: number; // Максимальный сдвиг в отрицательную сторону
    preserveCoreTrait: boolean; // Сохранять основные черты характера
  };
}

/**
 * Элемент истории адаптации
 */
export interface IEmotionalAdaptationHistoryItem {
  timestamp: Date;
  adaptationType: EmotionalAdaptationType;
  parameters: Record<string, any>;
  effectivenessScore: number; // Оценка эффективности после применения
}

/**
 * Паттерн эмоциональной адаптации
 */
export interface IEmotionalAdaptationPattern {
  id: string;
  triggerId: string; // ID триггера, вызвавшего паттерн
  userId: string;
  characterId: number;
  patternType: string; // Тип паттерна (например, 'positive_reinforcement')
  frequency: number; // Частота встречаемости
  lastSeen: Date;
  effectivenessScore: number; // Эффективность паттерна
  contextFactors: string[]; // Факторы контекста, влияющие на паттерн
  adaptationScope: EmotionalAdaptationScope;
}

/**
 * Триггер для эмоциональной адаптации
 */
export interface IEmotionalAdaptationTrigger {
  id: string;
  name: string;
  description: string;
  triggerType: EmotionalAdaptationType;
  conditions: Record<string, any>; // Условия активации триггера
  priority: number; // Приоритет триггера (0-1)
  cooldownPeriod: number; // Период ожидания между активациями (мс)
  lastTriggered?: Date;
}

/**
 * Правило эмоциональной адаптации
 */
export interface IEmotionalAdaptationRule {
  id: string;
  name: string;
  description: string;
  condition: {
    triggerType: EmotionalAdaptationType;
    emotionalContext: string; // Контекст эмоции
    userContext: string; // Контекст пользователя
  };
  adaptation: {
    type: EmotionalAdaptationType;
    parameters: Record<string, any>;
    strength: number; // Сила адаптации (0-1)
    scope: EmotionalAdaptationScope;
  };
  priority: number; // Приоритет правила (0-1)
  confidence: number; // Уверенность в правиле (0-1)
}

/**
 * Событие эмоциональной адаптации
 */
export interface IEmotionalAdaptationEvent {
  timestamp: Date;
  characterId: number;
  userId: string;
  triggerEmotion: any; // EmotionalState from emotional-state entity
  userResponse: any; // Реакция пользователя
  adaptationType: EmotionalAdaptationType;
  adaptationStrength: number;
  contextData?: Record<string, any>;
  success: boolean; // Была ли адаптация успешно применена
}

/**
 * Анализ эмоциональной адаптации
 */
export interface IEmotionalAdaptationAnalysis {
  userEmotionalResponse: any;
  adaptationRecommendations: IEmotionalAdaptationRule[];
  adaptationResult: {
    type: EmotionalAdaptationType;
    strength: number;
    applied: boolean;
  };
  adaptationEvent: IEmotionalAdaptationEvent;
  updatedProfile: IEmotionalAdaptationProfile;
}

/**
 * Конфигурация системы адаптации
 */
export interface IEmotionalAdaptationConfig {
  adaptationSpeed: number; // Скорость адаптации (0-1)
  sensitivityThreshold: number; // Порог чувствительности
  memoryDecayRate: number; // Скорость забывания паттернов
  minInteractionsForAdaptation: number; // Минимум взаимодействий
  maxAdaptationDistance: number; // Максимальное отклонение от базовой модели
  reinforcementFactor: number; // Фактор усиления при повторении
  diversityPenalty: number; // Штраф за однообразие
}

/**
 * Долгосрочный эмоциональный тренд
 */
export interface ILongTermEmotionalTrend {
  characterId: number;
  userId: string;
  trendType: string; // Тип тренда
  startDate: Date;
  endDate?: Date;
  strength: number; // Сила тренда
  confidence: number; // Уверенность в тренде
  dataPoints: {
    timestamp: Date;
    value: number;
    context?: string;
  }[];
}

/**
 * Метрики эффективности адаптации
 */
export interface IAdaptationEffectivenessMetrics {
  overallSatisfaction: number; // Общая удовлетворенность пользователя
  adaptationAccuracy: number; // Точность адаптации
  responseRelevance: number; // Релевантность ответов
  emotionalCoherence: number; // Эмоциональная согласованность
  learningProgress: number; // Прогресс обучения
  userEngagement: number; // Уровень вовлеченности пользователя
}

/**
 * Контекст для эмоциональной адаптации
 */
export interface IEmotionalAdaptationContext {
  conversationHistory: any[]; // История диалога
  currentTopic: string; // Текущая тема
  userMood: string; // Настроение пользователя
  timeOfDay: string; // Время дня
  previousInteractions: number; // Количество предыдущих взаимодействий
  sessionDuration: number; // Длительность текущей сессии
  environmentalFactors?: Record<string, any>; // Факторы окружения
}
