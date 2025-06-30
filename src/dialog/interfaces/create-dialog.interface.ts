import { Character } from '../../character/entities/character.entity';

/**
 * Интерфейс для данных создания диалога
 */
export interface CreateDialogData {
  /**
   * Telegram ID пользователя
   */
  telegramId: string;

  /**
   * ID персонажа
   */
  characterId: number;

  /**
   * ID пользователя
   */
  userId: string;

  /**
   * Заголовок диалога (опционально)
   */
  title?: string;

  /**
   * Персонаж (опционально)
   */
  character?: Character;

  /**
   * Активен ли диалог (опционально)
   */
  isActive?: boolean;

  /**
   * Дата последнего взаимодействия (опционально)
   */
  lastInteractionDate?: Date;

  /**
   * Дополнительные поля
   */
  [key: string]: unknown;
}
