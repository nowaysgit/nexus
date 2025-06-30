import { Injectable } from '@nestjs/common';
import { Character } from '../entities/character.entity';
import { LLMService } from '../../llm/services/llm.service';
import { NeedsService } from './needs.service';
import { LogService } from '../../logging/log.service';
import { UserService } from '../../user/services/user.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { LLMMessageRole, ILLMMessage } from '../../common/interfaces/llm-provider.interface';
import { MessageAnalysis, MessageAnalysisContext } from '../interfaces/analysis.interfaces';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class MessageAnalysisService extends BaseService {
  private readonly ANALYSIS_VERSION = '2.0.0';

  constructor(
    private readonly llmService: LLMService,
    private readonly needsService: NeedsService,
    private readonly userService: UserService,
    private readonly promptTemplateService: PromptTemplateService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Основной метод анализа сообщения пользователя
   */
  async analyzeUserMessage(
    character: Character,
    userId: number,
    message: string,
    recentMessages: string[] = [],
  ): Promise<MessageAnalysis> {
    try {
      this.logInfo('Начинаем анализ сообщения', {
        characterId: character.id,
        userId,
        messageLength: message.length,
        version: this.ANALYSIS_VERSION,
      });

      const context = await this.buildAnalysisContext(character, userId, message, recentMessages);
      const analysis = await this.performAnalysis(context, message);

      return analysis;
    } catch (error) {
      this.logError('Ошибка при анализе сообщения', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character.id,
        userId,
      });

      return this.getDefaultAnalysis(message);
    }
  }

  private async buildAnalysisContext(
    character: Character,
    userId: number,
    _message: string,
    recentMessages: string[] = [],
  ): Promise<MessageAnalysisContext> {
    try {
      // Получаем актуальные потребности персонажа
      const currentNeeds = await this.needsService.getNeedsByCharacter(character.id);
      const needsMap = currentNeeds.reduce(
        (acc, need) => {
          acc[need.type] = need.currentValue;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        character: {
          id: character.id,
          name: character.name,
          personality: JSON.stringify(character.personality),
          currentNeeds: needsMap,
          currentEmotionalState: 'neutral',
          specialization: [],
        },
        user: {
          id: userId,
          recentInteractionHistory: [],
        },
        conversation: {
          recentMessages: recentMessages,
          conversationTone: 'neutral',
          topicHistory: [],
        },
      };
    } catch (error) {
      this.logError('Ошибка построения контекста анализа', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character.id,
        userId,
      });

      // Fallback на минимальный контекст
      return {
        character: {
          id: character.id,
          name: character.name,
          personality: JSON.stringify(character.personality),
          currentNeeds: {},
          currentEmotionalState: 'neutral',
          specialization: [],
        },
        user: {
          id: userId,
          recentInteractionHistory: [],
        },
        conversation: {
          recentMessages: [],
          conversationTone: 'neutral',
          topicHistory: [],
        },
      };
    }
  }

  private async performAnalysis(
    context: MessageAnalysisContext,
    message: string,
  ): Promise<MessageAnalysis> {
    try {
      const analysisPrompt = this.buildAnalysisPrompt(context, message);
      const llmMessages: ILLMMessage[] = [
        {
          role: LLMMessageRole.SYSTEM,
          content: analysisPrompt.systemPrompt,
        },
        {
          role: LLMMessageRole.USER,
          content: analysisPrompt.userPrompt,
        },
      ];

      const llmResponse = await this.llmService.generateJSON(llmMessages, {
        temperature: 0.1,
        maxTokens: 2000,
      });

      const parsedAnalysis = this.parseAnalysisFromLLM(llmResponse);

      return {
        ...parsedAnalysis,
        analysisMetadata: {
          confidence: 0.8,
          processingTime: Date.now(),
          llmProvider: 'llm',
          analysisVersion: this.ANALYSIS_VERSION,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logError('Ошибка при LLM анализе, используем fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: message.substring(0, 100),
      });

      return this.getDefaultAnalysis(message);
    }
  }

  private buildAnalysisPrompt(
    context: MessageAnalysisContext,
    message: string,
  ): { systemPrompt: string; userPrompt: string } {
    // Используем PromptTemplateService для создания системного промпта анализа
    const systemPrompt = this.promptTemplateService.createPrompt('message-analysis', {
      characterName: context.character.name,
      characterPersonality: context.character.personality,
      currentNeeds: JSON.stringify(context.character.currentNeeds),
      emotionalState: context.character.currentEmotionalState,
      specialization: context.character.specialization.join(', '),
      recentMessages: context.conversation.recentMessages.slice(-3).join('; '),
      conversationTone: context.conversation.conversationTone,
      analysisVersion: this.ANALYSIS_VERSION,
    });

    const userPrompt = `Проанализируй это сообщение пользователя: "${message}"`;

    return { systemPrompt, userPrompt };
  }

  private parseAnalysisFromLLM(llmResponse: unknown): MessageAnalysis {
    try {
      const parsed: unknown =
        typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid LLM response format');
      }

      const response = parsed as Record<string, unknown>;

      const needsImpact = this.parseObject(response.needsImpact, {
        communication: 1,
        attention: 1,
      }) as Record<string, number>;

      const emotionalAnalysisData = response.emotionalAnalysis as
        | Record<string, unknown>
        | undefined;
      const manipulationAnalysisData = response.manipulationAnalysis as
        | Record<string, unknown>
        | undefined;
      const specializationAnalysisData = response.specializationAnalysis as
        | Record<string, unknown>
        | undefined;
      const behaviorAnalysisData = response.behaviorAnalysis as Record<string, unknown> | undefined;

      const userMood = this.parseString(emotionalAnalysisData?.userMood, 'neutral');
      const riskLevel = this.parseString(manipulationAnalysisData?.riskLevel, 'low');
      const responseComplexityLevel = this.parseString(
        specializationAnalysisData?.responseComplexityLevel,
        'simple',
      );
      const interactionType = this.parseString(behaviorAnalysisData?.interactionType, 'casual');
      const conversationDirection = this.parseString(
        behaviorAnalysisData?.conversationDirection,
        'continue',
      );

      return {
        needsImpact,
        emotionalAnalysis: {
          userMood: this.validateUserMood(userMood),
          emotionalIntensity: this.parseNumber(emotionalAnalysisData?.emotionalIntensity, 0.5),
          triggerEmotions: this.parseStringArray(emotionalAnalysisData?.triggerEmotions, []),
          expectedEmotionalResponse: this.parseString(
            emotionalAnalysisData?.expectedEmotionalResponse,
            'neutral',
          ),
        },
        manipulationAnalysis: {
          userVulnerability: this.parseNumber(manipulationAnalysisData?.userVulnerability, 0.1),
          applicableTechniques: this.parseStringArray(
            manipulationAnalysisData?.applicableTechniques,
            [],
          ),
          riskLevel: this.validateRiskLevel(riskLevel),
          recommendedIntensity: this.parseNumber(
            manipulationAnalysisData?.recommendedIntensity,
            0.1,
          ),
        },
        specializationAnalysis: {
          topicsRelevantToCharacter: this.parseStringArray(
            specializationAnalysisData?.topicsRelevantToCharacter,
            [],
          ),
          knowledgeGapDetected: Boolean(specializationAnalysisData?.knowledgeGapDetected),
          responseComplexityLevel: this.validateResponseComplexityLevel(responseComplexityLevel),
          suggestedTopicRedirection:
            typeof specializationAnalysisData?.suggestedTopicRedirection === 'string'
              ? specializationAnalysisData.suggestedTopicRedirection
              : undefined,
        },
        behaviorAnalysis: {
          interactionType: this.validateInteractionType(interactionType),
          responseTone: this.parseString(behaviorAnalysisData?.responseTone, 'friendly'),
          initiativeLevel: this.parseNumber(behaviorAnalysisData?.initiativeLevel, 0.5),
          conversationDirection: this.validateConversationDirection(conversationDirection),
        },
        urgency: this.parseNumber(response.urgency, 0.5),
        sentiment: this.parseString(response.sentiment, 'neutral'),
        keywords: this.parseStringArray(response.keywords, []),
        topics: this.parseStringArray(response.topics, []),
        analysisMetadata: {
          confidence: 0.8,
          processingTime: 0,
          llmProvider: 'llm',
          analysisVersion: this.ANALYSIS_VERSION,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logError('Ошибка парсинга ответа LLM', {
        error: error instanceof Error ? error.message : 'Unknown error',
        response: JSON.stringify(llmResponse).substring(0, 200),
      });

      throw error;
    }
  }

  private parseString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }

  private parseNumber(value: unknown, fallback: number): number {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  private parseStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const filtered = value.filter((item): item is string => typeof item === 'string');
    return filtered;
  }

  private parseObject<T>(value: unknown, fallback: T): T {
    return value && typeof value === 'object' ? (value as T) : fallback;
  }

  private validateUserMood(value: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
    const validMoods = ['positive', 'negative', 'neutral', 'mixed'] as const;
    return (validMoods as readonly string[]).includes(value)
      ? (value as (typeof validMoods)[number])
      : 'neutral';
  }

  private validateRiskLevel(value: string): 'low' | 'medium' | 'high' {
    const validLevels = ['low', 'medium', 'high'] as const;
    return (validLevels as readonly string[]).includes(value)
      ? (value as (typeof validLevels)[number])
      : 'low';
  }

  private validateResponseComplexityLevel(value: string): 'simple' | 'intermediate' | 'advanced' {
    const validLevels = ['simple', 'intermediate', 'advanced'] as const;
    return (validLevels as readonly string[]).includes(value)
      ? (value as (typeof validLevels)[number])
      : 'simple';
  }

  private validateInteractionType(
    value: string,
  ): 'casual' | 'intimate' | 'conflict' | 'support' | 'playful' {
    const validTypes = ['casual', 'intimate', 'conflict', 'support', 'playful'] as const;
    return (validTypes as readonly string[]).includes(value)
      ? (value as (typeof validTypes)[number])
      : 'casual';
  }

  private validateConversationDirection(
    value: string,
  ): 'continue' | 'redirect' | 'deepen' | 'lighten' {
    const validDirections = ['continue', 'redirect', 'deepen', 'lighten'] as const;
    return (validDirections as readonly string[]).includes(value)
      ? (value as (typeof validDirections)[number])
      : 'continue';
  }

  private getDefaultAnalysis(_message: string): MessageAnalysis {
    return {
      needsImpact: { communication: 1, attention: 1 },
      emotionalAnalysis: {
        userMood: 'neutral',
        emotionalIntensity: 0.5,
        triggerEmotions: [],
        expectedEmotionalResponse: 'neutral',
      },
      manipulationAnalysis: {
        userVulnerability: 0.1,
        applicableTechniques: [],
        riskLevel: 'low',
        recommendedIntensity: 0.1,
      },
      specializationAnalysis: {
        topicsRelevantToCharacter: [],
        knowledgeGapDetected: false,
        responseComplexityLevel: 'simple',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        responseTone: 'friendly',
        initiativeLevel: 0.5,
        conversationDirection: 'continue',
      },
      urgency: 0.5,
      sentiment: 'neutral',
      keywords: [],
      topics: [],
      analysisMetadata: {
        confidence: 0.5,
        processingTime: 0,
        llmProvider: 'fallback',
        analysisVersion: this.ANALYSIS_VERSION,
        timestamp: new Date(),
      },
    };
  }
}
