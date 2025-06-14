import { EmotionalState } from '../entities/emotional-state';
import { IMotivation } from './needs.interfaces';
import { CharacterMemory } from '../entities/character-memory.entity';

/**
 * Интерфейс предоставляющий контекст поведения персонажа для генерации ответов
 */
export interface CharacterBehaviorContext {
  /** Эмоциональное состояние персонажа */
  emotionalState: EmotionalState | null;

  /** Текущие мотивации персонажа */
  motivations: IMotivation[];

  /** Информация о текущем действии персонажа */
  currentAction: {
    type: string;
    description: string;
    startTime: Date;
    endTime: Date;
    isCompletable: boolean;
  } | null;

  /** Последние воспоминания персонажа */
  recentMemories: CharacterMemory[];
}

/**
 * Интерфейс для передачи данных между модулями с информацией
 * о потребностях персонажа
 */
export interface CharacterNeedsUpdate {
  /** Тип потребности */
  needType: string;

  /** Новое значение потребности */
  value: number;

  /** Причина изменения */
  reason: string;
}

/**
 * Интерфейс для хранения конфигурации системы персонажей
 */
export interface CharacterSystemConfig {
  /** Частота обновления потребностей (в миллисекундах) */
  needsUpdateInterval: number;

  /** Частота проверки мотиваций (в миллисекундах) */
  motivationCheckInterval: number;

  /** Пороговое значение для генерации мотивации */
  motivationThreshold: number;

  /** Максимальное количество хранимых воспоминаний */
  maxMemoryCount: number;
}
