import { EmotionCategory, EmotionalReactionType } from '../entities/emotional-state';

/**
 * Базовый интерфейс для эмоционального состояния
 */
export interface IEmotionalState {
  /**
   * Текущая эмоция (для совместимости с technique-executor.service.test.ts)
   */
  current?: string;

  /**
   * Основная эмоция (формат основного приложения)
   */
  primary?: string;

  /**
   * Вторичная эмоция (формат основного приложения)
   */
  secondary?: string;

  /**
   * Интенсивность эмоции от 0 до 10 (формат основного приложения)
   */
  intensity?: number;

  /**
   * Описание эмоционального состояния (формат основного приложения)
   */
  description?: string;

  /**
   * Эмоциональная категория (опционально)
   */
  category?: EmotionCategory;

  /**
   * Тип эмоциональной реакции (опционально)
   */
  reactionType?: EmotionalReactionType;
}

/**
 * Интерфейс для обновления эмоционального состояния
 */
export interface IEmotionalStateUpdate {
  /**
   * Карта эмоций и их интенсивности (0-1)
   */
  emotions: Record<string, number>;

  /**
   * Источник эмоционального обновления
   */
  source: string;

  /**
   * Описание эмоционального обновления
   */
  description: string;
}

/**
 * Интерфейс для контекста эмоционального состояния
 */
export interface IEmotionalContext {
  /**
   * Социальная обстановка
   */
  socialSetting: 'private' | 'public' | 'group' | 'intimate';

  /**
   * Уровень близости отношений (0-100%)
   */
  relationshipLevel: number;

  /**
   * Время суток
   */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';

  /**
   * Уровень энергии персонажа (0-100%)
   */
  characterEnergy: number;

  /**
   * Недавние события, влияющие на эмоции
   */
  recentEvents: string[];

  /**
   * Факторы окружения
   */
  environmentalFactors: string[];
}

/**
 * Проявление эмоций
 */
export interface IEmotionalManifestation {
  emotionType: string;
  intensityRange: [number, number];
  manifestations: string[];
  behavioralChanges: string[];
  communicationStyle: string;
}

/**
 * Унифицированный интерфейс EmotionalState для использования во всех частях приложения
 * включая тесты
 */
export type EmotionalState = IEmotionalState;
