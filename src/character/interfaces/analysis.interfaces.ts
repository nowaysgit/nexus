/**
 * Интерфейс для анализа сообщения пользователя
 * Включает все аспекты, необходимые для различных компонентов системы
 */
export interface MessageAnalysis {
  /**
   * Анализ для системы потребностей
   */
  needsImpact: Record<string, number>;

  /**
   * Анализ для эмоциональной системы
   */
  emotionalAnalysis: {
    userMood: 'positive' | 'negative' | 'neutral' | 'mixed';
    emotionalIntensity: number; // 0-1
    triggerEmotions: string[];
    expectedEmotionalResponse: string;
  };

  /**
   * Анализ для системы манипулятивных техник
   */
  manipulationAnalysis: {
    userVulnerability: number; // 0-1
    applicableTechniques: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendedIntensity: number; // 0-1
  };

  /**
   * Анализ для системы специализации
   */
  specializationAnalysis: {
    topicsRelevantToCharacter: string[];
    knowledgeGapDetected: boolean;
    responseComplexityLevel: 'simple' | 'intermediate' | 'advanced';
    suggestedTopicRedirection?: string;
  };

  /**
   * Анализ для системы поведения
   */
  behaviorAnalysis: {
    interactionType: 'casual' | 'intimate' | 'conflict' | 'support' | 'playful';
    responseTone: string;
    initiativeLevel: number; // 0-1, насколько персонаж должен быть инициативным
    conversationDirection: 'continue' | 'redirect' | 'deepen' | 'lighten';
  };

  /**
   * Общие свойства сообщения
   */
  urgency: number; // 0-1
  sentiment: string;
  keywords: string[];
  topics: string[];

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
    currentEmotionalState: string;
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
