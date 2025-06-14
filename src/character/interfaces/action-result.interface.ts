import { CharacterNeedType } from './character-need-type.enum';

/**
 * Интерфейс для результата выполнения действия персонажа
 */
export interface ActionResult {
  /** Успешность выполнения действия */
  success: boolean;

  /** Сообщение о результате действия */
  message: string;

  /** Влияние на потребности персонажа */
  needsImpact?: {
    [key in CharacterNeedType]?: number;
  };

  /** Генерируемый персонажем текст в результате действия */
  generatedText?: string;
}
