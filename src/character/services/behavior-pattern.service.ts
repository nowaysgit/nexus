import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { CharacterMotivation, MotivationIntensity } from '../entities/character-motivation.entity';
import { Action } from '../entities/action.entity';
import { EmotionalState } from '../entities/emotional-state';
import { LLMService } from '../../llm/services/llm.service';
import { LogService } from '../../logging/log.service';
import { EmotionalStateService } from './emotional-state.service';

export interface BehaviorPattern {
  type: string;
  description: string;
  triggers: string[];
  actions: string[];
  emotionalFactors: string[];
}

export interface BehaviorContext {
  emotionalState: EmotionalState | null;
  motivations: CharacterMotivation[];
  currentAction: Action | null;
  recentMemories: CharacterMemory[];
}

/**
 * Сервис для управления поведенческими паттернами персонажей
 * Выделен из CharacterBehaviorService для лучшей архитектуры
 */
@Injectable()
export class BehaviorPatternService extends BaseService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    private readonly llmService: LLMService,
    private readonly emotionalStateService: EmotionalStateService,
    @Inject(LogService)
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Конвертирует MotivationIntensity в числовое значение для сравнения
   */
  private getIntensityValue(intensity: MotivationIntensity): number {
    switch (intensity) {
      case MotivationIntensity.LOW:
        return 25;
      case MotivationIntensity.MODERATE:
        return 50;
      case MotivationIntensity.HIGH:
        return 75;
      case MotivationIntensity.CRITICAL:
        return 100;
      default:
        return 50;
    }
  }

  /**
   * Определяет поведенческий паттерн персонажа на основе его состояния
   */
  async determineBehaviorPattern(characterId: number): Promise<BehaviorPattern> {
    return this.withErrorHandling('определении поведенческого паттерна', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs', 'motivations'],
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      const behaviorContext = await this.getBehaviorContext(characterId);
      const emotionalPattern = this.analyzeEmotionalPattern(behaviorContext.emotionalState);
      const motivationalPattern = this.analyzeMotivationalPattern(behaviorContext.motivations);
      const memoryPattern = this.analyzeMemoryPattern(behaviorContext.recentMemories);

      const combinedPattern = this.combineBehaviorPatterns([
        emotionalPattern,
        motivationalPattern,
        memoryPattern,
      ]);

      this.logInfo(
        `Определен поведенческий паттерн для персонажа ${characterId}: ${combinedPattern.type}`,
      );

      return combinedPattern;
    });
  }

  /**
   * Получает контекст поведения персонажа
   */
  async getBehaviorContext(characterId: number): Promise<BehaviorContext> {
    return this.withErrorHandling('получении контекста поведения', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs', 'motivations'],
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      const recentMemories = await this.memoryRepository.find({
        where: { characterId },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // Получаем эмоциональное состояние через сервис
      const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

      return {
        emotionalState: emotionalState || null,
        motivations: character.motivations || [],
        currentAction: null,
        recentMemories,
      };
    });
  }

  private analyzeEmotionalPattern(emotionalState: EmotionalState | null): BehaviorPattern {
    if (!emotionalState) {
      return {
        type: 'neutral',
        description: 'Нейтральное поведение без выраженных эмоций',
        triggers: ['default'],
        actions: ['standard_response'],
        emotionalFactors: ['neutral'],
      };
    }

    const primaryEmotion = emotionalState.primary;
    const intensity = emotionalState.intensity || 50;

    if (intensity > 70) {
      return {
        type: `intense_${primaryEmotion}`,
        description: `Интенсивное поведение под влиянием сильной эмоции: ${primaryEmotion}`,
        triggers: [`high_${primaryEmotion}`, 'emotional_peak'],
        actions: [`${primaryEmotion}_driven_action`, 'emotional_response'],
        emotionalFactors: [primaryEmotion, 'high_intensity'],
      };
    } else if (intensity > 40) {
      return {
        type: `moderate_${primaryEmotion}`,
        description: `Умеренное поведение под влиянием эмоции: ${primaryEmotion}`,
        triggers: [`moderate_${primaryEmotion}`],
        actions: [`${primaryEmotion}_influenced_action`],
        emotionalFactors: [primaryEmotion, 'moderate_intensity'],
      };
    } else {
      return {
        type: `mild_${primaryEmotion}`,
        description: `Слабое влияние эмоции: ${primaryEmotion}`,
        triggers: [`mild_${primaryEmotion}`],
        actions: ['standard_response'],
        emotionalFactors: [primaryEmotion, 'low_intensity'],
      };
    }
  }

  private analyzeMotivationalPattern(motivations: CharacterMotivation[]): BehaviorPattern {
    if (!motivations || motivations.length === 0) {
      return {
        type: 'unmotivated',
        description: 'Поведение без выраженных мотиваций',
        triggers: ['no_motivation'],
        actions: ['passive_behavior'],
        emotionalFactors: ['apathy'],
      };
    }

    const strongestMotivation = motivations.reduce((prev, current) => {
      const prevValue = this.getIntensityValue(prev.intensity);
      const currentValue = this.getIntensityValue(current.intensity);
      return currentValue > prevValue ? current : prev;
    });

    const intensityValue = this.getIntensityValue(strongestMotivation.intensity);

    if (intensityValue > 80) {
      return {
        type: `driven_${strongestMotivation.relatedNeed}`,
        description: `Сильно мотивированное поведение: ${strongestMotivation.relatedNeed}`,
        triggers: [`high_${strongestMotivation.relatedNeed}`, 'strong_motivation'],
        actions: [`pursue_${strongestMotivation.relatedNeed}`, 'goal_oriented_action'],
        emotionalFactors: ['determination', 'focus'],
      };
    } else if (intensityValue > 50) {
      return {
        type: `pursuing_${strongestMotivation.relatedNeed}`,
        description: `Умеренно мотивированное поведение: ${strongestMotivation.relatedNeed}`,
        triggers: [`moderate_${strongestMotivation.relatedNeed}`],
        actions: [`work_towards_${strongestMotivation.relatedNeed}`],
        emotionalFactors: ['interest', 'engagement'],
      };
    } else {
      return {
        type: 'low_motivation',
        description: 'Слабо мотивированное поведение',
        triggers: ['low_motivation'],
        actions: ['minimal_effort'],
        emotionalFactors: ['indifference'],
      };
    }
  }

  private analyzeMemoryPattern(memories: CharacterMemory[]): BehaviorPattern {
    if (!memories || memories.length === 0) {
      return {
        type: 'fresh_start',
        description: 'Поведение без влияния прошлого опыта',
        triggers: ['no_memory'],
        actions: ['exploratory_behavior'],
        emotionalFactors: ['curiosity'],
      };
    }

    const positiveMemories = memories.filter(m => m.importance > 7).length;
    const negativeMemories = memories.filter(m => m.importance < 3).length;
    const totalMemories = memories.length;

    if (positiveMemories > totalMemories * 0.6) {
      return {
        type: 'positive_experience',
        description: 'Поведение под влиянием положительного опыта',
        triggers: ['positive_memories', 'good_experience'],
        actions: ['optimistic_response', 'positive_engagement'],
        emotionalFactors: ['happiness', 'confidence'],
      };
    } else if (negativeMemories > totalMemories * 0.6) {
      return {
        type: 'negative_experience',
        description: 'Поведение под влиянием негативного опыта',
        triggers: ['negative_memories', 'bad_experience'],
        actions: ['cautious_response', 'defensive_behavior'],
        emotionalFactors: ['wariness', 'caution'],
      };
    } else {
      return {
        type: 'mixed_experience',
        description: 'Поведение под влиянием смешанного опыта',
        triggers: ['mixed_memories'],
        actions: ['balanced_response'],
        emotionalFactors: ['neutrality', 'pragmatism'],
      };
    }
  }

  private combineBehaviorPatterns(patterns: BehaviorPattern[]): BehaviorPattern {
    const emotionalPattern = patterns[0];
    const motivationalPattern = patterns[1];
    const memoryPattern = patterns[2];

    let dominantType = emotionalPattern.type;
    let dominantDescription = emotionalPattern.description;

    if (emotionalPattern.type === 'neutral' || emotionalPattern.type.includes('mild')) {
      if (
        motivationalPattern.type !== 'unmotivated' &&
        motivationalPattern.type !== 'low_motivation'
      ) {
        dominantType = motivationalPattern.type;
        dominantDescription = motivationalPattern.description;
      } else if (memoryPattern.type !== 'fresh_start') {
        dominantType = memoryPattern.type;
        dominantDescription = memoryPattern.description;
      }
    }

    const combinedTriggers = [
      ...emotionalPattern.triggers,
      ...motivationalPattern.triggers,
      ...memoryPattern.triggers,
    ];

    const combinedActions = [
      ...emotionalPattern.actions,
      ...motivationalPattern.actions,
      ...memoryPattern.actions,
    ];

    const combinedEmotionalFactors = [
      ...emotionalPattern.emotionalFactors,
      ...motivationalPattern.emotionalFactors,
      ...memoryPattern.emotionalFactors,
    ];

    return {
      type: dominantType,
      description: dominantDescription,
      triggers: [...new Set(combinedTriggers)],
      actions: [...new Set(combinedActions)],
      emotionalFactors: [...new Set(combinedEmotionalFactors)],
    };
  }

  /**
   * Проверяет, активирован ли определенный поведенческий триггер
   */
  async isTriggeredBehavior(characterId: number, trigger: string): Promise<boolean> {
    return this.withErrorHandling('проверке поведенческого триггера', async () => {
      const pattern = await this.determineBehaviorPattern(characterId);
      return pattern.triggers.includes(trigger);
    });
  }

  /**
   * Получает рекомендуемые действия на основе поведенческого паттерна
   */
  async getRecommendedActions(characterId: number): Promise<string[]> {
    return this.withErrorHandling('получении рекомендуемых действий', async () => {
      const pattern = await this.determineBehaviorPattern(characterId);
      return pattern.actions;
    });
  }
}
