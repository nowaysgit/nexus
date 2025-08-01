/**
 * Интерфейсы для системы адаптивного обучения на основе feedback пользователей
 * Реализация неявного сбора обратной связи через анализ паттернов взаимодействия
 */

/**
 * Типы неявных сигналов обратной связи от пользователей
 */
export enum FeedbackSignalType {
  /** Длительная пауза перед ответом пользователя */
  USER_RESPONSE_DELAY = 'user_response_delay',

  /** Повторение вопроса или просьбы */
  REPEATED_REQUEST = 'repeated_request',

  /** Внезапное изменение темы разговора */
  TOPIC_SWITCH = 'topic_switch',

  /** Краткие ответы (возможное недовольство) */
  SHORT_RESPONSES = 'short_responses',

  /** Долгие ответы (высокая вовлеченность) */
  LONG_RESPONSES = 'long_responses',

  /** Использование эмоциональных маркеров */
  EMOTIONAL_MARKERS = 'emotional_markers',

  /** Завершение диалога без прощания */
  ABRUPT_EXIT = 'abrupt_exit',

  /** Продолжительный диалог */
  EXTENDED_CONVERSATION = 'extended_conversation',

  /** Возврат к персонажу в течение дня */
  RETURN_INTERACTION = 'return_interaction',
}

/**
 * Сигнал обратной связи с метаданными
 */
export interface FeedbackSignal {
  /** Тип сигнала */
  type: FeedbackSignalType;

  /** Интенсивность сигнала (0-1) */
  intensity: number;

  /** Временная метка */
  timestamp: Date;

  /** ID диалога */
  dialogId: number;

  /** ID сообщения (если применимо) */
  messageId?: number;

  /** Контекст сигнала */
  context: {
    /** Предыдущее поведение персонажа */
    characterResponse?: string;

    /** Использованная техника */
    technique?: string;

    /** Эмоциональное состояние персонажа */
    emotionalState?: string;

    /** Дополнительные метаданные */
    metadata?: Record<string, any>;
  };

  /** Предполагаемая валентность (положительная/отрицательная) */
  valence: 'positive' | 'negative' | 'neutral';
}

/**
 * Паттерн поведения, выученный из feedback
 */
export interface LearnedBehaviorPattern {
  /** Уникальный ID паттерна */
  id: string;

  /** Название паттерна */
  name: string;

  /** Условия применения паттерна */
  conditions: {
    /** Эмоциональное состояние персонажа */
    emotionalState?: string[];

    /** Контекст диалога */
    dialogContext?: string[];

    /** Тип пользователя */
    userType?: string[];

    /** Время суток */
    timeOfDay?: string[];
  };

  /** Рекомендуемые действия */
  recommendations: {
    /** Техники, которые следует использовать */
    preferredTechniques: string[];

    /** Техники, которых следует избегать */
    avoidTechniques: string[];

    /** Рекомендуемый эмоциональный тон */
    emotionalTone?: string;

    /** Длина ответа */
    responseLength?: 'short' | 'medium' | 'long';
  };

  /** Статистика эффективности */
  effectiveness: {
    /** Количество применений */
    usageCount: number;

    /** Процент положительных результатов */
    successRate: number;

    /** Последнее обновление */
    lastUpdated: Date;

    /** Уверенность в паттерне (0-1) */
    confidence: number;
  };
}

/**
 * Адаптация характеристик персонажа на основе обучения
 */
export interface CharacterAdaptation {
  /** ID персонажа */
  characterId: number;

  /** ID пользователя */
  userId: number;

  /** Адаптированные характеристики */
  adaptations: {
    /** Измененные веса техник */
    techniqueWeights?: Record<string, number>;

    /** Адаптированная эмоциональная реактивность */
    emotionalReactivity?: Record<string, number>;

    /** Предпочтительные стили общения */
    communicationStyles?: string[];

    /** Персональные триггеры для избегания */
    avoidanceTriggers?: string[];

    /** Персональные предпочтения */
    preferences?: Record<string, any>;
  };

  /** Временные рамки адаптации */
  timeframe: {
    /** Начало адаптации */
    startDate: Date;

    /** Последнее обновление */
    lastUpdate: Date;

    /** Период действия адаптации */
    validUntil?: Date;
  };

  /** Статистика качества адаптации */
  quality: {
    /** Количество обрабатываемых сигналов */
    signalCount: number;

    /** Уверенность в адаптации */
    confidence: number;

    /** Наблюдаемое улучшение */
    improvement: number;
  };
}

/**
 * Метрики обучения системы
 */
export interface LearningMetrics {
  /** Общее количество обработанных сигналов */
  totalSignals: number;

  /** Количество выученных паттернов */
  learnedPatterns: number;

  /** Средняя эффективность паттернов */
  averagePatternEffectiveness: number;

  /** Количество адаптированных персонажей */
  adaptedCharacters: number;

  /** Скорость обучения */
  learningVelocity: number;

  /** Период анализа */
  period: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Конфигурация системы обучения
 */
export interface LearningConfig {
  /** Минимальное количество сигналов для формирования паттерна */
  minSignalsForPattern: number;

  /** Порог уверенности для применения паттерна */
  confidenceThreshold: number;

  /** Период хранения данных обучения (дни) */
  dataRetentionDays: number;

  /** Частота анализа паттернов (часы) */
  patternAnalysisInterval: number;

  /** Максимальное количество паттернов на персонажа */
  maxPatternsPerCharacter: number;

  /** Включить/выключить обучение */
  learningEnabled: boolean;
}
