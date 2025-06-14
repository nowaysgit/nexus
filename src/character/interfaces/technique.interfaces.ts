import { ManipulativeTechniqueType, TechniqueIntensity, TechniquePhase } from '../enums/technique.enums';
import { Character } from '../entities/character.entity';
import { User } from '../../user/entities/user.entity';
import { EmotionalState } from '../interfaces/emotional-state.interface';

/**
 * Интерфейс для результата выполнения манипулятивной техники
 */
export interface ITechniqueResult {
  success: boolean;
  message: string;
  appliedTechnique?: ManipulativeTechniqueType | {
    type: ManipulativeTechniqueType;
    priority: TechniqueIntensity;
    phase: TechniquePhase;
  };
  intensity?: TechniqueIntensity;
  affectedParameters?: string[];
  phase?: TechniquePhase;
  effectiveness?: number;
  ethicalScore?: number;
  
  // Свойства, используемые в тестах
  techniqueType?: ManipulativeTechniqueType; // Дублирует appliedTechnique для обратной совместимости
  generatedResponse?: string; // Сгенерированный ответ
  responseText?: string; // Текст ответа, используемый в тестах
  sideEffects?: string[]; // Побочные эффекты применения техники
}

/**
 * Интерфейс для контекста выполнения манипулятивной техники
 */
export interface ITechniqueContext {
  // Поля основного приложения
  user?: User;
  character?: Character;
  messageContent: string;
  currentPhase?: TechniquePhase;
  previousResults?: ITechniqueResult[];
  emotionalState?: EmotionalState;
  needsState?: Record<string, number>;
  previousInteractions?: number;
  conversationHistory?: string[];
  relationshipLevel: number;
  
  // Дополнительные поля для тестов
  characterId?: number;
  userId?: number; // Используем только числовой ID для соответствия с базой данных
  previousTechniques?: any[];
  timeOfDay?: string;
  sessionDuration?: number;
}

/**
 * Интерфейс для контекста манипуляции
 */
export interface IManipulationContext {
  userId: string | number; // Поддерживаем оба типа для совместимости с тестами
  characterId: number;
  targetEmotion?: string;
  targetNeed?: string;
  messageContent?: string; // Делаем необязательным для совместимости с тестами
  userMessage?: string; // Альтернативное имя для messageContent, используемое в тестах
  context?: string; // Контекст разговора, используемый в тестах
  intensityLevel?: TechniqueIntensity; // Делаем необязательным для совместимости с тестами
  techniqueType?: ManipulativeTechniqueType; // Делаем необязательным для совместимости с тестами
  excludeTechniques?: ManipulativeTechniqueType[]; // Техники, которые не следует использовать
  phase?: TechniquePhase; // Фаза техники
  additionalParameters?: Record<string, any>;
} 