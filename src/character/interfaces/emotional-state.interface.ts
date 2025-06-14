/**
 * Интерфейс для определения эмоционального состояния персонажа
 */
export interface EmotionalState {
  /** Основная эмоция */
  primary: string;

  /** Вторичная эмоция */
  secondary: string;

  /** Интенсивность эмоционального состояния (0-100) */
  intensity: number;

  /** Текстовое описание эмоционального состояния */
  description: string;
}
