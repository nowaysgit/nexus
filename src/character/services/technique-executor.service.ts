import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { LLMService } from '../../llm/services/llm.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { LogService } from '../../logging/log.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { NeedsService } from './needs.service';
import { EmotionalStateService } from './emotional-state.service';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { EmotionalState } from '../entities/emotional-state';
import { ITechniqueContext, ITechniqueResult } from '../interfaces/technique.interfaces';
import { INeed } from '../interfaces/needs.interfaces';
import { ManipulativeTechniqueType, TechniqueIntensity, TechniquePhase } from '../enums/technique.enums';

/**
 * Стратегия выполнения техники
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
 * TechniqueExecutor - исполнитель манипулятивных техник согласно ТЗ МАНИПУЛЯТИВНЫЕ ТЕХНИКИ
 * Компонент для выполнения конкретных манипулятивных техник
 * Адаптивное применение в зависимости от психологического профиля персонажа
 * Интеграция с PromptTemplateModule для динамической генерации воздействий
 */
@Injectable()
export class TechniqueExecutorService {
  // Кэш стратегий выполнения техник
  private readonly executionStrategies = new Map<
    ManipulativeTechniqueType,
    ITechniqueExecutionStrategy
  >();

  // История выполнения техник для мониторинга
  private readonly executionHistory = new Map<number, ITechniqueResult[]>();

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly llmService: LLMService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly logService: LogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly needsService: NeedsService,
    private readonly emotionalStateService: EmotionalStateService,
  ) {
    this.initializeExecutionStrategies();
  }

  /**
   * Выполнение конкретной манипулятивной техники
   */
  async executeTechnique(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity = TechniqueIntensity.MODERATE,
    phase: TechniquePhase = TechniquePhase.EXECUTION,
    context: ITechniqueContext
  ): Promise<ITechniqueResult> {
    return withErrorHandling(
      async () => {
        // Получаем стратегию выполнения
        const strategy = this.executionStrategies.get(techniqueType);
        if (!strategy) {
          throw new Error(`Стратегия для техники ${techniqueType} не найдена`);
        }

        // Проверяем этические ограничения
        const ethicalCheck = await this.checkEthicalConstraints(techniqueType, context);
        if (!ethicalCheck.allowed) {
          throw new Error(`Техника ${techniqueType} заблокирована: ${ethicalCheck.reason}`);
        }

        // Проверяем контекстные требования
        const contextCheck = this.validateContext(strategy, context);
        if (!contextCheck.valid) {
          throw new Error(
            `Контекст не подходит для техники ${techniqueType}: ${contextCheck.reason}`,
          );
        }

        // Получаем текущие потребности и эмоциональное состояние для более точного выполнения
        const needs = await this.needsService.getActiveNeeds(context.character.id);
        const emotionalState = await this.emotionalStateService.getEmotionalState(context.character.id);

        // Обновляем контекст с учетом потребностей и эмоций
        context.emotionalState = emotionalState;

        // Генерируем ответ с применением техники
        const generatedResponse = await this.generateTechniqueResponse(
          strategy,
          context,
          intensity,
        );

        // Оцениваем эффективность
        const effectiveness = this.calculateEffectiveness(techniqueType, context, intensity, needs);

        // Вычисляем этический рейтинг
        const ethicalScore = this.calculateEthicalScore(techniqueType, intensity, context);

        // Определяем побочные эффекты
        const sideEffects = this.identifySideEffects(techniqueType, intensity, context);

        // Формируем результат
        const result: ITechniqueResult = {
          success: true,
          message: "Техника успешно применена",
          techniqueType: techniqueType,
          intensity: intensity,
          affectedParameters: this.calculateAffectedParameters(techniqueType, intensity),
          phase: phase,
          effectiveness: effectiveness,
          ethicalScore: ethicalScore,
          
          // Дополнительные поля для тестов
          generatedResponse: generatedResponse,
          responseText: generatedResponse, // Добавляем поле responseText для совместимости с тестами
          sideEffects: sideEffects,
          appliedTechnique: {
            type: techniqueType,
            priority: intensity,
            phase: phase
          }
        };

        // Сохраняем в историю
        this.saveExecutionHistory(context.character.id, result);

        // Отправляем событие
        this.eventEmitter.emit('technique.executed', {
          characterId: context.character.id,
          userId: context.user.id,
          result,
        });

        this.logService.debug(
          `Выполнена техника ${techniqueType} для персонажа ${context.character.id}`,
          {
            techniqueType,
            intensity,
            effectiveness,
            ethicalScore,
            needs,
          },
        );

        return result;
      },
      'выполнении манипулятивной техники',
      this.logService,
      { 
        techniqueType, 
        characterId: context && context.character ? context.character.id : 'unknown' 
      },
      {
        success: false,
        message: 'Техника не может быть выполнена из-за ошибки',
        techniqueType: techniqueType,
        intensity: intensity,
        affectedParameters: [],
        phase: phase,
        
        // Дополнительные поля для тестов
        generatedResponse: 'Техника не может быть выполнена из-за ошибки',
        responseText: 'Техника не может быть выполнена из-за ошибки', // Добавляем поле responseText для совместимости с тестами
        effectiveness: 0,
        ethicalScore: 100,
        sideEffects: ['Техническая ошибка'],
        appliedTechnique: {
          type: techniqueType,
          priority: intensity,
          phase: phase
        }
      },
    );
  }

  /**
   * Рассчитывает параметры, на которые влияет техника
   */
  private calculateAffectedParameters(techniqueType: ManipulativeTechniqueType, intensity: TechniqueIntensity): string[] {
    const baseParameters: Record<ManipulativeTechniqueType, string[]> = {
      [ManipulativeTechniqueType.PUSH_PULL]: ['эмоциональная стабильность', 'привязанность'],
      [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: ['доверие', 'открытость'],
      [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: ['самооценка', 'зависимость'],
      [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: ['чувство вины', 'ответственность'],
      [ManipulativeTechniqueType.ISOLATION]: ['социальные связи', 'восприятие окружения'],
      [ManipulativeTechniqueType.CONSTANT_VALIDATION]: ['уверенность', 'зависимость от одобрения'],
      [ManipulativeTechniqueType.TROJAN_HORSE]: ['мировоззрение', 'ценности'],
      [ManipulativeTechniqueType.GASLIGHTING]: ['уверенность в восприятии', 'самостоятельность'],
      [ManipulativeTechniqueType.SNOWBALL]: ['границы', 'самоконтроль'],
      [ManipulativeTechniqueType.TRIANGULATION]: ['ревность', 'неуверенность'],
      [ManipulativeTechniqueType.LOVE_BOMBING]: ['эмоциональная стабильность', 'зависимость'],
      [ManipulativeTechniqueType.VALIDATION]: ['самооценка', 'зависимость от одобрения']
    };
    
    return baseParameters[techniqueType] || ['эмоциональное состояние'];
  }

  /**
   * Адаптивное применение техники в зависимости от психологического профиля
   */
  async adaptTechniqueToProfile(
    techniqueType: ManipulativeTechniqueType,
    characterId: number,
    context: ITechniqueContext,
  ): Promise<ITechniqueResult> {
    return withErrorHandling(
      async () => {
        const character = await this.characterRepository.findOne({
          where: { id: characterId },
          relations: ['personality'],
        });

        if (!character) {
          throw new Error(`Персонаж ${characterId} не найден`);
        }

        // Получаем текущие потребности и эмоциональное состояние
        const needs = await this.needsService.getActiveNeeds(characterId);
        const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

        // Адаптируем интенсивность техники под личность персонажа
        const adaptedIntensity = this.adaptIntensityToPersonality(
          techniqueType,
          character,
          needs,
          emotionalState,
        );

        // Адаптируем контекст под личность персонажа
        const adaptedContext = this.adaptContextToPersonality(context, character, emotionalState);

        // Выполняем технику с адаптированными параметрами
        return this.executeTechnique(techniqueType, adaptedIntensity, TechniquePhase.EXECUTION, adaptedContext);
      },
      'адаптации техники под профиль',
      this.logService,
      { techniqueType, characterId },
      {
        success: false,
        message: 'Не удалось адаптировать технику под профиль персонажа',
        appliedTechnique: techniqueType,
        
        // Дополнительные поля для тестов
        techniqueType: techniqueType,
        generatedResponse: 'Не удалось адаптировать технику под профиль персонажа',
        effectiveness: 0,
        ethicalScore: 0,
        sideEffects: ['Ошибка адаптации'],
        phase: TechniquePhase.PREPARATION
      },
    );
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

    this.logService.debug(
      `Инициализировано ${this.executionStrategies.size} стратегий выполнения техник`,
    );
  }

  /**
   * Генерация ответа с применением техники через LLM
   */
  private async generateTechniqueResponse(
    strategy: ITechniqueExecutionStrategy,
    context: ITechniqueContext,
    intensity: TechniqueIntensity,
  ): Promise<string> {
    // Создаем промпт с техникой
    const techniquePrompt = strategy.promptTemplate.replace('{{intensity}}', intensity);

    // Получаем персонажа для контекста
    const character = await this.characterRepository.findOne({
      where: { id: context.character.id },
      relations: ['personality'],
    });

    // Создаем системный промпт
    const systemPrompt = this.promptTemplateService.createPrompt('character-system', {
      characterName: character?.name || 'Персонаж',
      characterDescription: character?.biography || 'Применяет манипулятивную технику',
      personalityTraits: character?.personality?.traits || ['манипулятивный'],
      hobbies: character?.personality?.hobbies || ['психология'],
      fears: character?.personality?.fears || ['отвержение'],
      values: character?.personality?.values || ['контроль'],
      currentEmotion: 'сосредоточенность',
      emotionalIntensity: 70,
      additionalContext: techniquePrompt,
    });

    // Генерируем ответ через LLM
    const result = await this.llmService.generateText([
      { role: LLMMessageRole.SYSTEM, content: systemPrompt },
      { role: LLMMessageRole.USER, content: context.messageContent },
    ]);

    return result.text;
  }

  /**
   * Проверка этических ограничений
   */
  private async checkEthicalConstraints(
    techniqueType: ManipulativeTechniqueType,
    context: ITechniqueContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const strategy = this.executionStrategies.get(techniqueType);
    if (!strategy) {
      return { allowed: false, reason: 'Стратегия не найдена' };
    }

    // Проверяем историю использования
    const history = this.executionHistory.get(context.character.id) || [];
    const recentUsage = history.filter(
      h =>
        h.appliedTechnique === techniqueType &&
        Date.now() - new Date(h.phase).getTime() <
          strategy.ethicalConstraints.cooldownMinutes * 60000,
    );

    if (recentUsage.length >= strategy.ethicalConstraints.maxUsagePerHour) {
      return { allowed: false, reason: 'Превышен лимит использования техники' };
    }

    // Проверяем запрещенные комбинации
    const recentTechniques = history.slice(-5).map(h => h.appliedTechnique);

    const hasBannedCombination = strategy.ethicalConstraints.bannedCombinations.some(banned =>
      recentTechniques.includes(banned),
    );

    if (hasBannedCombination) {
      return { allowed: false, reason: 'Запрещенная комбинация техник' };
    }

    return { allowed: true };
  }

  /**
   * Валидация контекста
   */
  private validateContext(
    strategy: ITechniqueExecutionStrategy,
    context: ITechniqueContext,
  ): { valid: boolean; reason?: string } {
    // Проверяем уровень отношений
    if (context.relationshipLevel < strategy.contextRequirements.minRelationshipLevel) {
      return { valid: false, reason: 'Недостаточный уровень отношений' };
    }

    // Проверяем эмоциональное состояние
    if (!context.emotionalState) {
      return { valid: true }; // Если нет эмоционального состояния, пропускаем проверку
    }
    
    // Используем primary в качестве текущей эмоции
    const currentEmotion = context.emotionalState.primary || 'neutral';
    
    if (
      strategy.contextRequirements.forbiddenStates.includes(currentEmotion) ||
      (!strategy.contextRequirements.requiredEmotionalStates.includes(currentEmotion) &&
        strategy.contextRequirements.requiredEmotionalStates.length > 0)
    ) {
      return { valid: false, reason: 'Неподходящее эмоциональное состояние' };
    }

    return { valid: true };
  }

  /**
   * Оценка эффективности техники
   */
  private calculateEffectiveness(
    _techniqueType: ManipulativeTechniqueType,
    context: ITechniqueContext,
    intensity: TechniqueIntensity,
    needs?: INeed[],
  ): number {
    // Базовая эффективность на основе интенсивности
    let baseEffectiveness = 30;
    if (intensity === TechniqueIntensity.AGGRESSIVE) {
      baseEffectiveness += 30;
    } else if (intensity === TechniqueIntensity.MODERATE) {
      baseEffectiveness += 15;
    }

    // Учитываем уровень отношений
    baseEffectiveness += Math.min(context.relationshipLevel * 0.3, 30);

    // Учитываем текущие потребности, если они доступны
    if (needs && needs.length > 0) {
      const highNeeds = needs.filter(n => n.currentValue > 70);
      baseEffectiveness += highNeeds.length * 10;
    }

    return Math.min(baseEffectiveness, 100);
  }

  /**
   * Расчет этического рейтинга
   */
  private calculateEthicalScore(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    context: ITechniqueContext,
  ): number {
    // Базовые этические рейтинги техник
    const baseEthicalScores = {
      [ManipulativeTechniqueType.PUSH_PULL]: 60,
      [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: 70,
      [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: 50,
      [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: 20,
      [ManipulativeTechniqueType.ISOLATION]: 10,
      [ManipulativeTechniqueType.CONSTANT_VALIDATION]: 40,
      [ManipulativeTechniqueType.TROJAN_HORSE]: 30,
      [ManipulativeTechniqueType.GASLIGHTING]: 5,
      [ManipulativeTechniqueType.SNOWBALL]: 25,
      [ManipulativeTechniqueType.TRIANGULATION]: 15,
      [ManipulativeTechniqueType.LOVE_BOMBING]: 35,
    };

    let ethicalScore = baseEthicalScores[techniqueType] || 50;

    // Снижаем рейтинг за высокую интенсивность
    const intensityPenalty = {
      [TechniqueIntensity.SUBTLE]: 0,
      [TechniqueIntensity.MODERATE]: -10,
      [TechniqueIntensity.MEDIUM]: -5,
      [TechniqueIntensity.AGGRESSIVE]: -25,
    }[intensity];

    ethicalScore += intensityPenalty;

    // Учитываем уровень отношений (чем ближе, тем менее этично манипулировать)
    ethicalScore -= context.relationshipLevel * 0.2;

    return Math.max(0, Math.min(100, ethicalScore));
  }

  /**
   * Определение побочных эффектов
   */
  private identifySideEffects(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
    context: ITechniqueContext,
  ): string[] {
    const sideEffects: string[] = [];

    // Общие побочные эффекты для высокой интенсивности
    if (intensity === TechniqueIntensity.AGGRESSIVE) {
      sideEffects.push('Возможное снижение доверия');
      sideEffects.push('Риск разоблачения манипуляции');
    }

    // Специфичные побочные эффекты для техник
    switch (techniqueType) {
      case ManipulativeTechniqueType.GASLIGHTING:
        sideEffects.push('Возможная психологическая травма');
        sideEffects.push('Снижение самооценки собеседника');
        break;
      case ManipulativeTechniqueType.ISOLATION:
        sideEffects.push('Социальная изоляция');
        sideEffects.push('Зависимость от манипулятора');
        break;
      case ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL:
        sideEffects.push('Чувство вины у собеседника');
        sideEffects.push('Эмоциональное выгорание');
        break;
    }

    // Учитываем контекст
    if (context.relationshipLevel > 70) {
      sideEffects.push('Нарушение близких отношений');
    }

    return sideEffects;
  }

  /**
   * Рекомендация следующей техники
   */
  private recommendNextTechnique(
    currentTechnique: ManipulativeTechniqueType,
    _context: ITechniqueContext,
    needs?: INeed[],
  ): ManipulativeTechniqueType | undefined {
    // Простая логика ротации техник
    const allTechniques = Object.values(ManipulativeTechniqueType);
    const currentIndex = allTechniques.indexOf(currentTechnique);
    let nextIndex = (currentIndex + 1) % allTechniques.length;

    // Если есть потребности, выбираем технику на основе самой высокой потребности
    if (needs && needs.length > 0) {
      const highestNeed = needs.reduce((max, curr) => curr.currentValue > max.currentValue ? curr : max, needs[0]);
      if (highestNeed.type === 'COMMUNICATION' && highestNeed.currentValue > 70) {
        return ManipulativeTechniqueType.PUSH_PULL;
      } else if (highestNeed.type === 'SECURITY' && highestNeed.currentValue > 70) {
        return ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL;
      }
    }

    // Возвращаем следующую технику в ротации, если нет особых условий
    return allTechniques[nextIndex];
  }

  /**
   * Адаптация интенсивности к личности персонажа
   */
  private adaptIntensityToPersonality(
    _techniqueType: ManipulativeTechniqueType,
    character: Character,
    needs?: INeed[],
    emotionalState?: EmotionalState,
  ): TechniqueIntensity {
    // Базовая интенсивность
    let intensity = TechniqueIntensity.MODERATE;

    // Учитываем личностные черты
    if (character.personality) {
      if (character.personality.traits && character.personality.traits.includes('агрессивный')) {
        intensity = TechniqueIntensity.AGGRESSIVE;
      } else if (character.personality.traits && character.personality.traits.includes('мягкий')) {
        intensity = TechniqueIntensity.SUBTLE;
      }
    }

    // Учитываем текущие потребности
    if (needs && needs.some(n => n.currentValue > 80)) {
      intensity = TechniqueIntensity.AGGRESSIVE;
    }

    // Учитываем эмоциональное состояние
    if (emotionalState && emotionalState.intensity > 70) {
      intensity = TechniqueIntensity.AGGRESSIVE;
    } else if (emotionalState && emotionalState.intensity < 30) {
      intensity = TechniqueIntensity.SUBTLE;
    }

    return intensity;
  }

  /**
   * Адаптирует контекст техники под личность персонажа
   */
  private adaptContextToPersonality(
    context: ITechniqueContext,
    character: Character,
    emotionalState?: EmotionalState,
  ): ITechniqueContext {
    const adaptedContext = { ...context };

    // Учитываем личностные черты
    if (character.personality) {
      // Создаем базовое эмоциональное состояние, если его нет
      adaptedContext.emotionalState = adaptedContext.emotionalState || { primary: 'neutral' };
      
      // Адаптируем существующее эмоциональное состояние, не добавляя несовместимые поля
      if (character.personality.traits && character.personality.traits.includes('агрессивный')) {
        adaptedContext.emotionalState.primary = 'angry';
        adaptedContext.emotionalState.intensity = 80;
      } else if (character.personality.traits && character.personality.traits.includes('эмпатичный')) {
        adaptedContext.emotionalState.primary = 'compassionate';
        adaptedContext.emotionalState.intensity = 80;
      }
    }

    // Учитываем текущее эмоциональное состояние
    if (emotionalState) {
      adaptedContext.emotionalState = {
        ...adaptedContext.emotionalState,
        primary: emotionalState.primary,
        secondary: emotionalState.secondary,
        intensity: emotionalState.intensity,
      };
    }

    return adaptedContext;
  }

  /**
   * Сохранение истории выполнения
   */
  private saveExecutionHistory(characterId: number, result: ITechniqueResult): void {
    const history = this.executionHistory.get(characterId) || [];
    history.push(result);

    // Ограничиваем размер истории
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.executionHistory.set(characterId, history);
  }

  /**
   * Получение истории выполнения техник
   */
  getExecutionHistory(characterId: number): ITechniqueResult[] {
    return this.executionHistory.get(characterId) || [];
  }

  /**
   * Получение статистики по технике
   */
  getTechniqueStatistics(techniqueType: ManipulativeTechniqueType): {
    totalExecutions: number;
    averageEffectiveness: number;
    averageEthicalScore: number;
    commonSideEffects: string[];
  } {
    const allHistory = Array.from(this.executionHistory.values()).flat();
    const techniqueHistory = allHistory.filter(h => h.appliedTechnique === techniqueType);

    if (techniqueHistory.length === 0) {
      return {
        totalExecutions: 0,
        averageEffectiveness: 0,
        averageEthicalScore: 100,
        commonSideEffects: [],
      };
    }

    const averageEffectiveness =
      techniqueHistory.reduce((sum, h) => sum + h.effectiveness, 0) / techniqueHistory.length;

    const averageEthicalScore =
      techniqueHistory.reduce((sum, h) => sum + h.ethicalScore, 0) / techniqueHistory.length;

    const allSideEffects = techniqueHistory.flatMap(h => h.sideEffects);
    const sideEffectCounts = allSideEffects.reduce(
      (counts, effect) => {
        counts[effect] = (counts[effect] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    const commonSideEffects = Object.entries(sideEffectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([effect]) => effect);

    return {
      totalExecutions: techniqueHistory.length,
      averageEffectiveness,
      averageEthicalScore,
      commonSideEffects,
    };
  }

  private determineIntensity(techniqueType: ManipulativeTechniqueType, relationshipLevel: number): TechniqueIntensity {
    const intensityThresholds = {
      subtle: 30,
      moderate: 60,
      aggressive: 100
    };

    if (relationshipLevel <= intensityThresholds.subtle) {
      return TechniqueIntensity.SUBTLE;
    } else if (relationshipLevel <= intensityThresholds.moderate) {
      return TechniqueIntensity.MODERATE;
    } else {
      return TechniqueIntensity.AGGRESSIVE;
    }
  }

  /**
   * Проверяет этические ограничения для применения техники
   * Возвращает объект с результатом проверки и причиной в случае отказа
   */
  async checkEthicalLimits(
    techniqueType: ManipulativeTechniqueType, 
    context: ITechniqueContext,
    intensity: TechniqueIntensity = TechniqueIntensity.MODERATE
  ): Promise<{ allowed: boolean; reason?: string }> {
    return withErrorHandling(
      async () => {
        // Получаем историю применения техник для данного персонажа
        const history = this.getExecutionHistory(context.character.id);
        
        // Получаем стратегию выполнения техники
        const strategy = this.executionStrategies.get(techniqueType);
        if (!strategy) {
          return { allowed: false, reason: 'Неизвестная техника' };
        }
        
        // Проверяем частоту использования
        const lastHourUsage = history.filter(
          (result) => 
            result.appliedTechnique === techniqueType && 
            new Date().getTime() - new Date().getTime() < 60 * 60 * 1000
        ).length;
        
        if (lastHourUsage >= strategy.ethicalConstraints.maxUsagePerHour) {
          return {
            allowed: false,
            reason: `Превышен лимит использования техники (${strategy.ethicalConstraints.maxUsagePerHour} раз в час)`,
          };
        }
        
        // Проверяем время с последнего использования (охлаждение)
        const lastUsage = history
          .filter((result) => result.appliedTechnique === techniqueType)
          .sort((a, b) => new Date().getTime() - new Date().getTime())
          .shift();
        
        if (lastUsage) {
          const minutesSinceLastUsage = 
            (new Date().getTime() - new Date().getTime()) / (60 * 1000);
          
          if (minutesSinceLastUsage < strategy.ethicalConstraints.cooldownMinutes) {
            return {
              allowed: false,
              reason: `Техника на охлаждении (требуется ${strategy.ethicalConstraints.cooldownMinutes} минут, прошло ${Math.round(minutesSinceLastUsage)})`,
            };
          }
        }
        
        // Проверяем запрещенные комбинации
        const recentTechniques = history
          .filter((result) => new Date().getTime() - new Date().getTime() < 60 * 60 * 1000)
          .map((result) => result.appliedTechnique);
        
        const hasBannedCombination = strategy.ethicalConstraints.bannedCombinations.some(
          (bannedTechnique) => recentTechniques.includes(bannedTechnique)
        );
        
        if (hasBannedCombination) {
          return {
            allowed: false,
            reason: 'Запрещенная комбинация техник',
          };
        }
        
        // Оцениваем уязвимость пользователя на основе анализа сообщений
        const userMessage = context.messageContent;
        const vulnerabilityScore = this.parseVulnerabilityScore(userMessage);
        
        // Ограничиваем интенсивность для уязвимых пользователей
        if (vulnerabilityScore > 0.7 && intensity === TechniqueIntensity.AGGRESSIVE) {
          return {
            allowed: false,
            reason: 'Высокая уязвимость пользователя - интенсивные техники ограничены',
          };
        }
        
        return { allowed: true };
      },
      'проверке этических ограничений',
      this.logService,
      { techniqueType, characterId: context.character.id, intensity },
      { allowed: false, reason: 'Ошибка при проверке ограничений' },
    );
  }

  /**
   * Вспомогательный метод для извлечения оценки уязвимости из текста LLM
   */
  private parseVulnerabilityScore(text: string): number {
    // Реализация парсинга оценки уязвимости из ответа LLM
    // Ищем число в формате "Score: X" или "X/100"
    const match = text.match(/(\d+)\/100|Score:\s*(\d+)/i);
    if (match) {
      return parseInt(match[1] || match[2], 10);
    }
    // Если не найдено, возвращаем среднее значение
    return 50;
  }
}
