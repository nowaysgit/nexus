import { CharacterNeedType } from './character-need-type.enum';

/**
 * Интерфейс для определения мотивации персонажа
 */
export interface Motivation {
  /** Тип потребности, вызвавшей мотивацию */
  needType: CharacterNeedType | string;

  /** Приоритет мотивации (0-100) */
  priority: number;

  /** Пороговое значение, при котором генерируется действие */
  threshold: number;

  /** Описание действия, которое может быть предпринято */
  actionImpulse: string;
}
