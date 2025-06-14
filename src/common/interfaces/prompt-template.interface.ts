/**
 * Интерфейс для шаблона промпта
 */
export interface PromptTemplate {
  /** Название шаблона для удобства выбора */
  name: string;
  /** Уникальный тип промпта для идентификации */
  type: string;
  /** Версия шаблона для отслеживания изменений */
  version: string;
  /** Сам шаблон с placeholders в формате {{variable}} */
  template: string;
  /** Рекомендуемое максимальное количество токенов для ответа */
  maxTokens?: number;
  /** Рекомендуемая температура для генерации */
  recommendedTemperature?: number;
  /** Описание шаблона */
  description?: string;
  /** Дата создания шаблона */
  createdAt?: Date;
  /** Дата последнего обновления */
  updatedAt?: Date;
  /** Автор шаблона */
  author?: string;
  /** Теги для категоризации */
  tags?: string[];
  /** Категория шаблона */
  category?: string;
  /** Статистика использования */
  usage?: {
    totalUses: number;
    successRate: number;
    averageTokens: number;
  };
}

/**
 * Интерфейс для категории промптов
 */
export interface PromptCategory {
  /** Название категории */
  name: string;
  /** Описание категории */
  description: string;
  /** Массив шаблонов в этой категории */
  templates: PromptTemplate[];
}

/**
 * Интерфейс с параметрами для формирования промпта
 */
export interface PromptParams {
  /**
   * Тип промпта
   */
  type: string;

  /**
   * Версия промпта (опционально)
   */
  version?: string;

  /**
   * Параметры для подстановки в шаблон
   */
  params: Record<string, unknown>;

  /**
   * Переопределение настроек модели
   */
  modelOverrides?: {
    /**
     * Название модели
     */
    model?: string;

    /**
     * Температура генерации
     */
    temperature?: number;

    /**
     * Максимальное количество токенов
     */
    maxTokens?: number;
  };
}

/**
 * Интерфейс для версии шаблона
 */
export interface TemplateVersion {
  /** Версия */
  version: string;
  /** Шаблон */
  template: PromptTemplate;
  /** Активна ли версия */
  isActive: boolean;
  /** Дата создания версии */
  createdAt: Date;
}
