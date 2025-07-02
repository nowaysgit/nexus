/**
 * Эмоциональный анализ
 */
export interface EmotionalAnalysis {
  userMood: 'positive' | 'negative' | 'neutral' | 'mixed';
  emotionalIntensity: number; // 0-1
  triggerEmotions: string[];
  expectedEmotionalResponse: string;
}

/**
 * Анализ для системы манипулятивных техник
 */
export interface ManipulationAnalysis {
  userVulnerability: number; // 0-1
  applicableTechniques: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendedIntensity: number; // 0-1
}

/**
 * Анализ для системы специализации
 */
export interface SpecializationAnalysis {
  responseComplexityLevel: 'simple' | 'intermediate' | 'advanced';
  requiredKnowledge: string[];
  domain: string;
}

/**
 * Анализ для системы поведения
 */
export interface BehaviorAnalysis {
  interactionType: 'casual' | 'intimate' | 'conflict' | 'support' | 'playful';
  conversationDirection: 'continue' | 'redirect' | 'deepen' | 'lighten';
  userIntent: string;
  keyTopics: string[];
}

/**
 * Интерфейс для анализа сообщения пользователя
 */
export interface MessageAnalysis {
  /**
   * Срочность или важность сообщения от 0.0 до 1.0
   */
  urgency: number;

  /**
   * Основное намерение пользователя
   */
  userIntent: UserIntent;

  /**
   * Анализ для системы потребностей
   */
  needsImpact: Record<string, number>;

  /**
   * Эмоциональный анализ
   */
  emotionalAnalysis: EmotionalAnalysis;

  /**
   * Анализ для системы манипулятивных техник
   */
  manipulationAnalysis: ManipulationAnalysis;

  /**
   * Анализ для системы специализации
   */
  specializationAnalysis: SpecializationAnalysis;

  /**
   * Анализ для системы поведения
   */
  behaviorAnalysis: BehaviorAnalysis;

  /**
   * Метаданные анализа
   */
  analysisMetadata: {
    confidence: number;
    processingTime: number;
    llmProvider: string;
    analysisVersion: string;
    timestamp: Date;
  };
}

/**
 * Интерфейс для контекста анализа сообщения
 */
export interface MessageAnalysisContext {
  character: {
    id: number;
    name: string;
    personality: string;
    currentNeeds: Record<string, number>;
    currentEmotionalState: 'positive' | 'negative' | 'neutral' | 'mixed';
    specialization: string[];
  };
  user: {
    id: number;
    recentInteractionHistory: string[];
    psychologicalProfile?: Record<string, any>;
  };
  conversation: {
    recentMessages: string[];
    conversationTone: string;
    topicHistory: string[];
  };
}

/**
 * Определяет возможное намерение пользователя.
 */
export type UserIntent =
  | 'question'
  | 'complaint'
  | 'compliment'
  | 'joke'
  | 'threat'
  | 'casual_talk'
  | 'request'
  | 'unknown';
