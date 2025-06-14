// Эмоциональное состояние персонажа
export interface EmotionalState {
  // Основная эмоция
  primary: string;

  // Вторичная эмоция
  secondary: string;

  // Интенсивность эмоционального состояния (0-100)
  intensity: number;

  // Текстовое описание эмоционального состояния
  description: string;
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
