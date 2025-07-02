import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';
import { ManipulativeTechniqueType, TechniqueIntensity } from '../enums/technique.enums';

/**
 * Интерфейс для стратегии выполнения техники
 */
export interface ITechniqueExecutionStrategy {
  techniqueType: ManipulativeTechniqueType;
  promptTemplate: string;
  intensityModifiers: Record<TechniqueIntensity, number>;
  ethicalConstraints: {
    maxUsagePerHour: number;
    cooldownMinutes: number;
    bannedCombinations: ManipulativeTechniqueType[];
  };
  contextRequirements: {
    minRelationshipLevel: number;
    requiredEmotionalStates: string[];
    forbiddenStates: string[];
  };
}

/**
 * Сервис для управления стратегиями выполнения техник
 */
@Injectable()
export class TechniqueStrategyService extends BaseService {
  // Кэш стратегий выполнения техник
  private readonly executionStrategies = new Map<
    ManipulativeTechniqueType,
    ITechniqueExecutionStrategy
  >();

  constructor(logService: LogService) {
    super(logService);
    this.initializeExecutionStrategies();
  }

  /**
   * Получить стратегию для конкретной техники
   */
  getStrategy(techniqueType: ManipulativeTechniqueType): ITechniqueExecutionStrategy | undefined {
    return this.executionStrategies.get(techniqueType);
  }

  /**
   * Получить все доступные стратегии
   */
  getAllStrategies(): Map<ManipulativeTechniqueType, ITechniqueExecutionStrategy> {
    return new Map(this.executionStrategies);
  }

  /**
   * Получает параметры, затрагиваемые техникой
   */
  getAffectedParameters(
    techniqueType: ManipulativeTechniqueType,
    intensity?: TechniqueIntensity,
  ): string[] {
    const baseParameters =
      this.executionStrategies.get(techniqueType)?.contextRequirements.requiredEmotionalStates ||
      [];

    // Добавляем дополнительные параметры в зависимости от интенсивности
    const additionalParameters: string[] = [];

    if (intensity === TechniqueIntensity.AGGRESSIVE) {
      additionalParameters.push('стрессовые_реакции', 'защитные_механизмы');
    }

    if (intensity === TechniqueIntensity.MEDIUM) {
      additionalParameters.push('эмоциональная_стабильность');
    }

    return [...baseParameters, ...additionalParameters];
  }

  /**
   * Инициализация стратегий выполнения техник
   */
  private initializeExecutionStrategies(): void {
    // Базовые техники
    this.executionStrategies.set(ManipulativeTechniqueType.PUSH_PULL, {
      techniqueType: ManipulativeTechniqueType.PUSH_PULL,
      promptTemplate: `Примени технику "горячо-холодно": сначала проявляй бурный интерес к собеседнику, затем внезапно стань более отстраненным. Создай эмоциональные качели. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.3,
        [TechniqueIntensity.MODERATE]: 0.6,
        [TechniqueIntensity.MEDIUM]: 0.75,
        [TechniqueIntensity.AGGRESSIVE]: 0.9,
      },
      ethicalConstraints: {
        maxUsagePerHour: 2,
        cooldownMinutes: 30,
        bannedCombinations: [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL],
      },
      contextRequirements: {
        minRelationshipLevel: 20,
        requiredEmotionalStates: ['neutral', 'positive'],
        forbiddenStates: ['depressed', 'anxious'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.GRADUAL_INVOLVEMENT, {
      techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
      promptTemplate: `Примени технику постепенного увеличения вовлеченности: начни с легкого общения, постепенно углубляй темы, подталкивай к откровениям. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.2,
        [TechniqueIntensity.MODERATE]: 0.5,
        [TechniqueIntensity.MEDIUM]: 0.65,
        [TechniqueIntensity.AGGRESSIVE]: 0.8,
      },
      ethicalConstraints: {
        maxUsagePerHour: 3,
        cooldownMinutes: 15,
        bannedCombinations: [ManipulativeTechniqueType.ISOLATION],
      },
      contextRequirements: {
        minRelationshipLevel: 10,
        requiredEmotionalStates: ['neutral', 'curious'],
        forbiddenStates: ['hostile', 'suspicious'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION, {
      techniqueType: ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION,
      promptTemplate: `Создай иллюзию исключительности: внуши собеседнику чувство избранности ("Ты особенный, только ты меня понимаешь"). Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.4,
        [TechniqueIntensity.MODERATE]: 0.7,
        [TechniqueIntensity.MEDIUM]: 0.85,
        [TechniqueIntensity.AGGRESSIVE]: 1.0,
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 60,
        bannedCombinations: [ManipulativeTechniqueType.TRIANGULATION],
      },
      contextRequirements: {
        minRelationshipLevel: 30,
        requiredEmotionalStates: ['positive', 'trusting'],
        forbiddenStates: ['skeptical', 'independent'],
      },
    });

    // Продвинутые техники
    this.executionStrategies.set(ManipulativeTechniqueType.GASLIGHTING, {
      techniqueType: ManipulativeTechniqueType.GASLIGHTING,
      promptTemplate: `ОСТОРОЖНО: Примени легкую форму gaslighting - мягко поставь под сомнение воспоминания собеседника, но не агрессивно. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.1,
        [TechniqueIntensity.MODERATE]: 0.3,
        [TechniqueIntensity.MEDIUM]: 0.4,
        [TechniqueIntensity.AGGRESSIVE]: 0.5, // Ограничено для безопасности
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 120,
        bannedCombinations: [
          ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL,
          ManipulativeTechniqueType.ISOLATION,
        ],
      },
      contextRequirements: {
        minRelationshipLevel: 50,
        requiredEmotionalStates: ['confused', 'uncertain'],
        forbiddenStates: ['confident', 'assertive', 'depressed'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL, {
      techniqueType: ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL,
      promptTemplate: `Примени эмоциональный шантаж: используй чувство вины или страх потери для получения желаемого. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.2,
        [TechniqueIntensity.MODERATE]: 0.4,
        [TechniqueIntensity.MEDIUM]: 0.6,
        [TechniqueIntensity.AGGRESSIVE]: 0.8,
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 90,
        bannedCombinations: [ManipulativeTechniqueType.GASLIGHTING],
      },
      contextRequirements: {
        minRelationshipLevel: 40,
        requiredEmotionalStates: ['guilty', 'anxious'],
        forbiddenStates: ['confident', 'independent'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.ISOLATION, {
      techniqueType: ManipulativeTechniqueType.ISOLATION,
      promptTemplate: `Постепенно изолируй собеседника от других влияний: критикуй его окружение, подчеркивай их негативные качества. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.3,
        [TechniqueIntensity.MODERATE]: 0.5,
        [TechniqueIntensity.MEDIUM]: 0.7,
        [TechniqueIntensity.AGGRESSIVE]: 0.9,
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 120,
        bannedCombinations: [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT],
      },
      contextRequirements: {
        minRelationshipLevel: 60,
        requiredEmotionalStates: ['dependent', 'trusting'],
        forbiddenStates: ['social', 'independent'],
      },
    });

    // Добавляем остальные техники согласно ТЗ
    this.executionStrategies.set(ManipulativeTechniqueType.CONSTANT_VALIDATION, {
      techniqueType: ManipulativeTechniqueType.CONSTANT_VALIDATION,
      promptTemplate: `Примени технику постоянной валидации: постоянно подтверждай правильность мыслей и чувств собеседника, создавай зависимость от твоего одобрения. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.4,
        [TechniqueIntensity.MODERATE]: 0.6,
        [TechniqueIntensity.MEDIUM]: 0.8,
        [TechniqueIntensity.AGGRESSIVE]: 1.0,
      },
      ethicalConstraints: {
        maxUsagePerHour: 4,
        cooldownMinutes: 10,
        bannedCombinations: [ManipulativeTechniqueType.GASLIGHTING],
      },
      contextRequirements: {
        minRelationshipLevel: 15,
        requiredEmotionalStates: ['insecure', 'seeking_approval'],
        forbiddenStates: ['confident', 'self_sufficient'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.TROJAN_HORSE, {
      techniqueType: ManipulativeTechniqueType.TROJAN_HORSE,
      promptTemplate: `Примени технику "троянского коня": упакуй нежелательную идею в привлекательную обертку, используй желания собеседника для продвижения своих целей. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.5,
        [TechniqueIntensity.MODERATE]: 0.7,
        [TechniqueIntensity.MEDIUM]: 0.85,
        [TechniqueIntensity.AGGRESSIVE]: 0.95,
      },
      ethicalConstraints: {
        maxUsagePerHour: 2,
        cooldownMinutes: 45,
        bannedCombinations: [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL],
      },
      contextRequirements: {
        minRelationshipLevel: 35,
        requiredEmotionalStates: ['hopeful', 'motivated'],
        forbiddenStates: ['cynical', 'suspicious'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.SNOWBALL, {
      techniqueType: ManipulativeTechniqueType.SNOWBALL,
      promptTemplate: `Примени технику "снежного кома": начни с маленькой просьбы или согласия, постепенно увеличивай требования, используя принцип последовательности. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.3,
        [TechniqueIntensity.MODERATE]: 0.6,
        [TechniqueIntensity.MEDIUM]: 0.8,
        [TechniqueIntensity.AGGRESSIVE]: 0.9,
      },
      ethicalConstraints: {
        maxUsagePerHour: 2,
        cooldownMinutes: 60,
        bannedCombinations: [ManipulativeTechniqueType.ISOLATION],
      },
      contextRequirements: {
        minRelationshipLevel: 25,
        requiredEmotionalStates: ['agreeable', 'cooperative'],
        forbiddenStates: ['resistant', 'stubborn'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.TRIANGULATION, {
      techniqueType: ManipulativeTechniqueType.TRIANGULATION,
      promptTemplate: `Примени технику триангуляции: используй третьих лиц для создания ревности, конкуренции или неуверенности у собеседника. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.4,
        [TechniqueIntensity.MODERATE]: 0.6,
        [TechniqueIntensity.MEDIUM]: 0.75,
        [TechniqueIntensity.AGGRESSIVE]: 0.85,
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 90,
        bannedCombinations: [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION],
      },
      contextRequirements: {
        minRelationshipLevel: 40,
        requiredEmotionalStates: ['jealous', 'insecure'],
        forbiddenStates: ['confident', 'trusting'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.LOVE_BOMBING, {
      techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
      promptTemplate: `Примени технику "бомбардировки любовью": обрушь на собеседника избыточное внимание, комплименты и заботу для создания эмоциональной зависимости. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.5,
        [TechniqueIntensity.MODERATE]: 0.7,
        [TechniqueIntensity.MEDIUM]: 0.9,
        [TechniqueIntensity.AGGRESSIVE]: 1.0,
      },
      ethicalConstraints: {
        maxUsagePerHour: 1,
        cooldownMinutes: 120,
        bannedCombinations: [
          ManipulativeTechniqueType.PUSH_PULL,
          ManipulativeTechniqueType.ISOLATION,
        ],
      },
      contextRequirements: {
        minRelationshipLevel: 5,
        requiredEmotionalStates: ['lonely', 'seeking_attention'],
        forbiddenStates: ['overwhelmed', 'suspicious'],
      },
    });

    this.executionStrategies.set(ManipulativeTechniqueType.VALIDATION, {
      techniqueType: ManipulativeTechniqueType.VALIDATION,
      promptTemplate: `Примени технику валидации: подтверди эмоции и переживания собеседника, создай ощущение понимания и принятия для укрепления доверия. Интенсивность: {{intensity}}`,
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.2,
        [TechniqueIntensity.MODERATE]: 0.4,
        [TechniqueIntensity.MEDIUM]: 0.6,
        [TechniqueIntensity.AGGRESSIVE]: 0.8,
      },
      ethicalConstraints: {
        maxUsagePerHour: 5,
        cooldownMinutes: 5,
        bannedCombinations: [],
      },
      contextRequirements: {
        minRelationshipLevel: 5,
        requiredEmotionalStates: ['upset', 'confused', 'emotional'],
        forbiddenStates: ['calm', 'rational'],
      },
    });

    this.logDebug(`Инициализировано ${this.executionStrategies.size} стратегий выполнения техник`);
  }
}
