import { CharacterNeedType } from '../enums/character-need-type.enum';

/**
 * Интерфейс для потребности персонажа
 */
export interface CharacterNeed {
  /** Тип потребности */
  type: CharacterNeedType;

  /** Текущее значение потребности (0-100) */
  value: number;

  /** Приоритет потребности (1-10) */
  priority: number;

  /** Время последнего обновления */
  lastUpdated: Date;

  /** Скорость изменения потребности */
  decayRate: number;
}

/**
 * Данные для обновления потребностей
 */
export interface NeedsUpdateData {
  /** Изменения потребностей */
  changes: {
    [needType in CharacterNeedType]?: number;
  };

  /** Причина изменения */
  reason: string;

  /** Источник изменения */
  source: string;
}

/**
 * Интерфейс для потребности персонажа
 */
export interface INeed {
  id?: number;
  characterId: number;
  type: CharacterNeedType;
  currentValue: number;
  maxValue: number;
  growthRate: number;
  decayRate: number;
  priority: number;
  threshold: number;
  lastUpdated?: Date;
  isActive?: boolean;
}

/**
 * Интерфейс для обновления потребностей персонажа
 */
export interface INeedUpdate {
  /** Тип потребности */
  type: CharacterNeedType;

  /** Величина изменения */
  change: number;

  /** Причина изменения (опционально) */
  reason?: string;
}

/**
 * Интерфейс сервиса для работы с потребностями персонажа
 */
export interface INeedsService {
  getNeeds(characterId: number): Promise<INeed[]>;
  getNeedsByType(characterId: number, type: CharacterNeedType): Promise<INeed>;
  updateNeed(characterId: number, update: INeedUpdate): Promise<INeed>;
  calculateNeedsGrowth(characterId: number): Promise<INeed[]>;
  getUnfulfilledNeeds(characterId: number): Promise<INeed[]>;
}

/**
 * Интерфейс для мотивации персонажа
 */
export interface IMotivation {
  id?: number;
  characterId: number;
  needType: CharacterNeedType;
  intensity: number;
  status: string;
  createdAt?: Date;
  /** Приоритет мотивации (1-10) */
  priority?: number;
}

/**
 * Интерфейс сервиса для работы с мотивациями персонажа
 */
export interface IMotivationService {
  generateMotivations(characterId: number): Promise<IMotivation[]>;
  getActiveMotivations(characterId: number): Promise<IMotivation[]>;
  completeMotivation(motivationId: number): Promise<IMotivation>;
}
