import { Injectable } from '@nestjs/common';
import { Character } from '../entities/character.entity';
import { LLMService } from '../../llm/services/llm.service';
import { LogService } from '../../logging/log.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { LLMMessageRole, ILLMMessage } from '../../common/interfaces/llm-provider.interface';
import {
  MessageAnalysis,
  EmotionalAnalysis,
  ManipulationAnalysis,
  SpecializationAnalysis,
  BehaviorAnalysis,
} from '../interfaces/analysis.interfaces';
import { BaseService } from '../../common/base/base.service';
import { ManipulativeTechniqueType } from '../enums/technique.enums';

@Injectable()
export class MessageAnalysisService extends BaseService {
  private readonly ANALYSIS_VERSION = '2.2.0';

  constructor(
    private readonly llmService: LLMService,
    private readonly promptTemplateService: PromptTemplateService,
    logService: LogService,
  ) {
    super(logService);
  }

  async analyzeUserMessage(
    character: Character,
    message: string,
    recentMessages: string[] = [],
  ): Promise<MessageAnalysis> {
    try {
      this.logInfo('Начинаем анализ сообщения', {
        characterId: character.id,
        messageLength: message.length,
        version: this.ANALYSIS_VERSION,
      });

      const analysis = await this.performAnalysis(character, message, recentMessages);
      return analysis;
    } catch (error) {
      this.logError('Ошибка при анализе сообщения', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character.id,
      });
      return this.getDefaultAnalysis(message);
    }
  }

  private async performAnalysis(
    character: Character,
    message: string,
    recentMessages: string[],
  ): Promise<MessageAnalysis> {
    try {
      const availableTechniques = Object.values(ManipulativeTechniqueType).join(', ');

      const systemPrompt = this.promptTemplateService.createPrompt(
        'message-analysis',
        {
          characterName: character.name,
          characterPersonality: JSON.stringify(character.personality),
          userMessage: message,
          recentMessages: recentMessages.slice(-3).join('\n'),
          availableTechniques,
        },
        '2.2.0',
      );

      const llmMessages: ILLMMessage[] = [
        {
          role: LLMMessageRole.SYSTEM,
          content: systemPrompt,
        },
      ];

      const llmResponse = await this.llmService.generateJSON(llmMessages, {
        temperature: 0.1,
        maxTokens: 500,
      });

      const parsedAnalysis = this.parseAnalysisFromLLM(llmResponse);

      return {
        ...parsedAnalysis,
        analysisMetadata: {
          confidence: 0.9,
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

  private parseAnalysisFromLLM(llmResponse: unknown): Omit<MessageAnalysis, 'analysisMetadata'> {
    try {
      const parsed = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Некорректный формат ответа от LLM');
      }

      const response = parsed as Record<string, any>;

      const needsImpact = this.parseObject(response.needs, {}) as Record<string, number>;
      const emotionalAnalysis = this.parseObject(response.emotion, {});
      const manipulationAnalysis = this.parseObject(response.manipulation, {});
      const behaviorAnalysis = this.parseObject(response.behavior, {});
      const specializationAnalysis = this.parseObject(response.specialization, {});

      return {
        needsImpact,
        emotionalAnalysis: {
          userMood: this.parseString(
            emotionalAnalysis?.mood,
            'neutral',
          ) as EmotionalAnalysis['userMood'],
          emotionalIntensity: this.parseNumber(emotionalAnalysis?.intensity, 0.5),
          triggerEmotions: this.parseStringArray(emotionalAnalysis?.triggers, []),
          expectedEmotionalResponse: this.parseString(
            emotionalAnalysis?.expectedResponse,
            'neutral',
          ),
        },
        manipulationAnalysis: {
          userVulnerability: this.parseNumber(manipulationAnalysis?.vulnerability, 0.1),
          applicableTechniques: this.parseStringArray(manipulationAnalysis?.technique, []),
          riskLevel: this.parseString(
            manipulationAnalysis?.risk,
            'low',
          ) as ManipulationAnalysis['riskLevel'],
          recommendedIntensity: this.parseNumber(manipulationAnalysis?.intensity, 0.1),
        },
        specializationAnalysis: {
          responseComplexityLevel: this.parseString(
            specializationAnalysis?.complexity,
            'simple',
          ) as SpecializationAnalysis['responseComplexityLevel'],
          requiredKnowledge: this.parseStringArray(specializationAnalysis?.knowledge, []),
          domain: this.parseString(specializationAnalysis?.domain, 'general'),
        },
        behaviorAnalysis: {
          interactionType: this.parseString(
            behaviorAnalysis?.interaction,
            'casual',
          ) as BehaviorAnalysis['interactionType'],
          conversationDirection: this.parseString(
            behaviorAnalysis?.direction,
            'continue',
          ) as BehaviorAnalysis['conversationDirection'],
          userIntent: this.parseString(behaviorAnalysis?.intent, 'unknown'),
          keyTopics: this.parseStringArray(behaviorAnalysis?.topics, []),
        },
      };
    } catch (error) {
      this.logError('Ошибка парсинга ответа от LLM', {
        error: error instanceof Error ? error.message : String(error),
        llmResponse,
      });
      return this.getDefaultAnalysis('') as Omit<MessageAnalysis, 'analysisMetadata'>;
    }
  }

  private parseString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value ? value : fallback;
  }

  private parseNumber(value: unknown, fallback: number): number {
    const num = Number(value);
    return !isNaN(num) ? num : fallback;
  }

  private parseStringArray(value: unknown, fallback: string[]): string[] {
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      return value;
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    return fallback;
  }

  private parseObject<T>(value: unknown, fallback: T): T {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : fallback;
  }

  private getDefaultAnalysis(message: string): MessageAnalysis {
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
        responseComplexityLevel: 'simple',
        requiredKnowledge: [],
        domain: 'general',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        conversationDirection: 'continue',
        userIntent: 'unknown',
        keyTopics: [message.substring(0, 50)],
      },
      analysisMetadata: {
        confidence: 0.1,
        processingTime: Date.now(),
        llmProvider: 'fallback',
        analysisVersion: this.ANALYSIS_VERSION,
        timestamp: new Date(),
      },
    };
  }
}
