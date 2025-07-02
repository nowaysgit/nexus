// Эмоциональное состояние персонажа
export interface EmotionalState {
  // Основная эмоция
  primary: string;

  // Вторичная эмоция
  secondary: string;

  // Интенсивность эмоционального состояния (0-100)
  intensity: number;

  // Стабильность эмоционального состояния (0-100)
  stability?: number;

  // Триггеры, вызывающие эмоцию
  triggers?: string[];

  // Продолжительность эмоции в минутах
  duration?: number;

  // Время последнего обновления
  lastUpdated?: Date;

  // Текстовое описание эмоционального состояния
  description?: string;
}

// Мотивация персонажа к действию
export interface Motivation {
  // Тип потребности, вызывающей мотивацию
  needType: string;

  // Приоритет мотивации (0-100)
  priority: number;

  // Пороговое значение для генерации действия
  threshold: number;

  // Описание импульса к действию
  actionImpulse: string;
}

// Различные категории эмоций
export enum EmotionCategory {
  // Позитивные эмоции
  POSITIVE = 'positive',

  // Негативные эмоции
  NEGATIVE = 'negative',

  // Нейтральные эмоции
  NEUTRAL = 'neutral',

  // Социальные эмоции
  SOCIAL = 'social',

  // Эмоции, связанные с потребностями
  NEED_BASED = 'need_based',
}

// Типы эмоциональных реакций
export enum EmotionalReactionType {
  // Вербальная реакция
  VERBAL = 'verbal',

  // Физическая реакция
  PHYSICAL = 'physical',

  // Изменение темы
  TOPIC_CHANGE = 'topic_change',

  // Эмоциональное раскрытие
  EMOTIONAL_DISCLOSURE = 'emotional_disclosure',

  // Избегание
  AVOIDANCE = 'avoidance',
}

/**
 * Контекстные факторы для эмоциональных проявлений согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalContext {
  socialSetting: 'private' | 'public' | 'group' | 'intimate'; // Социальная обстановка
  relationshipLevel: number; // Уровень близости отношений (0-100%)
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'; // Время суток
  characterEnergy: number; // Уровень энергии персонажа (0-100%)
  recentEvents: string[]; // Недавние события, влияющие на эмоции
  environmentalFactors: string[]; // Факторы окружения
}

/**
 * Проявления эмоций в зависимости от контекста согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalManifestation {
  context: EmotionalContext;
  behaviorChanges: {
    speechPattern: string; // Изменение речевых паттернов
    responseStyle: string; // Стиль ответов
    topicPreferences: string[]; // Предпочтения в темах
    socialBehavior: string; // Социальное поведение
  };
  physicalSigns: string[]; // Физические признаки эмоции
  cognitiveEffects: {
    attentionFocus: string; // Фокус внимания
    memoryBias: string; // Искажение памяти
    decisionMaking: string; // Влияние на принятие решений
  };
}

/**
 * Воздействие на эмоциональное состояние согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalImpact {
  intensity: number; // Интенсивность воздействия (0-100%)
  duration: number; // Продолжительность в минутах
  fadeRate: number; // Скорость затухания (0-100% в час)
  emotionalType: string; // Тип эмоции
  triggers: string[]; // Триггеры, вызвавшие эмоцию
  manifestations: EmotionalManifestation[]; // Проявления эмоции
}

/**
 * Интерфейс для прямого обновления эмоционального состояния
 */
export interface EmotionalUpdate {
  /** Карта эмоций и их интенсивности */
  emotions: Record<string, number>;
  /** Источник эмоционального обновления */
  source: string;
  /** Описание эмоционального обновления */
  description: string;
}
