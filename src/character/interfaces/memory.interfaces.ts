/**
 * Параметры для поиска воспоминаний
 */
export interface MemorySearchParams {
  /** Поисковый запрос */
  query?: string;

  /** Тип воспоминания */
  type?: MemoryType;

  /** Лимит результатов */
  limit?: number;

  /** Минимальная важность */
  minImportance?: number;

  /** Дата начала периода */
  dateFrom?: Date;

  /** Дата окончания периода */
  dateTo?: Date;
}

/**
 * Параметры для создания воспоминания
 */
export interface CreateMemoryParams {
  /** Содержание воспоминания */
  content: string;

  /** Тип воспоминания */
  type: MemoryType;

  /** Важность от 0 до 10 */
  importance: number;

  /** Связанные эмоции */
  emotions?: string[];

  /** Метаданные */
  metadata?: Record<string, any>;
}

/**
 * Типы воспоминаний персонажа
 */
export enum MemoryType {
  CONVERSATION = 'conversation',
  EVENT = 'event',
  EMOTION = 'emotion',
  LEARNING = 'learning',
  RELATIONSHIP = 'relationship',
  GOAL = 'goal',
  PREFERENCE = 'preference',
}
