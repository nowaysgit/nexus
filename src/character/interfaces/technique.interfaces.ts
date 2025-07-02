import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../enums/technique.enums';
import { Character } from '../entities/character.entity';
import { User } from '../../user/entities/user.entity';
import { EmotionalState } from '../entities/emotional-state';

/**
 * Интерфейс для результата выполнения манипулятивной техники
 */
export interface ITechniqueResult {
  success: boolean;
  message: string;
  appliedTechnique?:
    | ManipulativeTechniqueType
    | {
        type: ManipulativeTechniqueType;
        priority: TechniqueIntensity;
        phase: TechniquePhase;
      };
  intensity?: TechniqueIntensity;
  affectedParameters?: string[];
  phase?: TechniquePhase;
  effectiveness?: number;
  ethicalScore?: number;
  techniqueType?: ManipulativeTechniqueType;
  generatedResponse?: string;
  responseText?: string;
  sideEffects?: string[];
  adaptationNotes?: string[];
  vulnerabilityScore?: number;
  nextRecommendedTechnique?: ManipulativeTechniqueType;
  executionNotes?: string[];
}

/**
 * Интерфейс для контекста выполнения манипулятивной техники
 */
export interface ITechniqueContext {
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
  characterId?: number;
  userId?: number;
  previousTechniques?: any[];
  timeOfDay?: string;
  sessionDuration?: number;
  intensity?: TechniqueIntensity;
  conversationId?: string;
}

/**
 * Интерфейс для контекста манипуляции
 */
export interface IManipulationContext {
  userId: string | number;
  characterId: number;
  targetEmotion?: string;
  targetNeed?: string;
  messageContent?: string;
  userMessage?: string;
  context?: string;
  intensityLevel?: TechniqueIntensity;
  techniqueType?: ManipulativeTechniqueType;
  excludeTechniques?: ManipulativeTechniqueType[];
  phase?: TechniquePhase;
  additionalParameters?: Record<string, any>;
}
export { ManipulativeTechniqueType, TechniqueIntensity, TechniquePhase };
