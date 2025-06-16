import { CharacterNeedType } from '../enums/character-need-type.enum';
import { ActionType } from '../enums/action-type.enum';
import { IMotivation } from '../interfaces/needs.interfaces';

/**
 * Интерфейс для действия персонажа
 */
export interface CharacterAction {
  /** Уникальный идентификатор действия */
  id?: string;

  /** Тип действия */
  type: ActionType;

  /** Название действия */
  name?: string;

  /** Описание действия */
  description: string;

  /** Время начала действия */
  startTime?: Date;

  /** Предполагаемое время окончания */
  estimatedEndTime?: Date;

  /** Фактическое время окончания */
  actualEndTime?: Date;

  /** Время окончания */
  endTime?: Date;

  /** Продолжительность в миллисекундах */
  duration?: number;

  /** Статус действия */
  status?: 'planned' | 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

  /** Приоритет действия (1-10) */
  priority?: number;

  /** Можно ли прервать действие */
  isInterruptible?: boolean;

  /** Связанные потребности */
  relatedNeeds?: CharacterNeedType[];

  /** Содержимое действия (для сообщений и т.д.) */
  content?: string;

  /** Метаданные действия */
  metadata?: Record<string, unknown>;

  /** Ресурсная стоимость выполнения действия */
  resourceCost?: number;
}

/**
 * Интерфейс для обработчика действий персонажа
 */
export interface ActionHandler {
  /** Может ли обработчик выполнить данное действие */
  canHandle(action: CharacterAction): boolean;

  /** Выполнить действие */
  execute(action: CharacterAction): Promise<ActionResult>;

  /** Прервать выполнение действия */
  interrupt(actionId: string): Promise<void>;

  /** Получить статус выполнения действия */
  getStatus(actionId: string): Promise<string>;
}

/**
 * Результат выполнения действия
 */
export interface ActionResult {
  /** Успешно ли выполнено действие */
  success: boolean;

  /** Сообщение о результате */
  message?: string;

  /** Влияние на потребности */
  needsImpact?: {
    [needType in CharacterNeedType]?: number;
  };

  /** Влияние на эмоциональное состояние */
  emotionalImpact?: {
    emotion: string;
    intensity: number;
  };

  /** Дополнительные данные */
  data?: Record<string, unknown>;
}

/**
 * Контекст триггера действий
 */
export interface ActionTriggerContext {
  /** ID персонажа */
  characterId: number;

  /** ID пользователя (может быть числовым или UUID строкой) */
  userId: string | number;

  /** Тип триггера */
  triggerType: string;

  /** Данные триггера */
  triggerData?: Record<string, unknown>;

  /** Время создания триггера */
  timestamp?: Date;

  /** Мотивации персонажа */
  motivations?: IMotivation[];

  /** Выражение потребности персонажа */
  needsExpression?: string;

  /** Эмоциональный ответ персонажа */
  emotionalResponse?: string;

  /** Промпт для сообщения персонажа */
  messagePrompt?: string;
}
