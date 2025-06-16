import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Character } from '../entities/character.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../entities/manipulation-technique.entity';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../enums/technique.enums';
import { NeedsService } from './needs.service';
import { EmotionalStateService } from './emotional-state.service';
import { LLMService } from '../../llm/services/llm.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { LogService } from '../../logging/log.service';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { IManipulationContext } from '../interfaces/technique.interfaces';

export interface ITechniqueExecution {
  id: string;
  techniqueType: ManipulativeTechniqueType;
  intensity: TechniqueIntensity;
  characterId: number;
  userId: number;
  startTime: Date;
  endTime?: Date;
  effectiveness: number;
}

export interface ITechniqueStrategy {
  characterId: number;
  primaryTechniques: ManipulativeTechniqueType[];
  ethicalLimits: {
    maxIntensity: TechniqueIntensity;
    bannedTechniques: ManipulativeTechniqueType[];
  };
}

@Injectable()
export class ManipulationService {
  private readonly strategies = new Map<number, ITechniqueStrategy>();
  private readonly activeExecutions = new Map<number, ITechniqueExecution[]>();

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(TechniqueExecution)
    private readonly techniqueExecutionRepository: Repository<TechniqueExecution>,
    @InjectRepository(UserManipulationProfile)
    private readonly userManipulationProfileRepository: Repository<UserManipulationProfile>,
    private readonly needsService: NeedsService,
    private readonly emotionalStateService: EmotionalStateService,
    private readonly llmService: LLMService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly logService: LogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Инициализация стратегии манипулятивных техник для персонажа
   */
  async initializeStrategy(characterId: number): Promise<ITechniqueStrategy> {
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    // Проверяем наличие personality
    if (!character.personality) {
      this.logService.warn(
        `Character ${characterId} has no personality data, using default values`,
      );
      character.personality = {
        traits: ['neutral'],
        hobbies: ['general'],
        fears: ['unknown'],
        values: ['basic'],
        musicTaste: ['various'],
        strengths: ['adaptability'],
        weaknesses: ['uncertainty'],
      };
    }

    const strategy: ITechniqueStrategy = {
      characterId,
      primaryTechniques: this.selectPrimaryTechniques(character),
      ethicalLimits: this.establishEthicalLimits(),
    };

    this.strategies.set(characterId, strategy);
    this.logService.log(`Manipulation strategy initialized for character ${characterId}`, {
      characterId,
    });

    return strategy;
  }

  /**
   * Анализ ситуации и выбор подходящей техники
   */
  async analyzeSituationAndChooseTechnique(
    characterId: number,
    userId: number,
    messageContent: string,
  ): Promise<ManipulativeTechniqueType | null> {
    let strategy = this.strategies.get(characterId);
    if (!strategy) {
      strategy = await this.initializeStrategy(characterId);
    }

    // Проверка этических ограничений
    if (!this.checkEthicalConstraints(characterId)) {
      return null;
    }

    // Получаем текущие потребности и эмоциональное состояние
    const needs = await this.needsService.getActiveNeeds(characterId);
    const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

    // Анализируем сообщение пользователя через LLM для определения контекста
    const analysisPrompt = this.promptTemplateService.createPrompt('message-analysis', {
      messageContent,
      characterNeeds: JSON.stringify(needs),
      emotionalState: JSON.stringify(emotionalState),
    });

    const analysisResponse = await this.llmService.generateJSON([
      { role: LLMMessageRole.SYSTEM, content: analysisPrompt },
    ]);

    let analysisResult;
    try {
      analysisResult = analysisResponse;
    } catch (error) {
      this.logService.error(`Failed to parse analysis response for character ${characterId}`, {
        error: error.message,
      });
      return null;
    }

    // Выбираем технику на основе анализа
    const availableTechniques = strategy.primaryTechniques.filter(
      t => !strategy.ethicalLimits.bannedTechniques.includes(t),
    );

    if (availableTechniques.length === 0) {
      return null;
    }

    // Логика выбора техники на основе потребностей и эмоций
    let chosenTechnique = availableTechniques[0];
    if (analysisResult.primaryNeed && analysisResult.primaryNeed === 'COMMUNICATION') {
      chosenTechnique = ManipulativeTechniqueType.PUSH_PULL;
    } else if (analysisResult.emotionalTone && analysisResult.emotionalTone === 'NEGATIVE') {
      chosenTechnique = ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL;
    }

    this.logService.log(`Technique chosen for character ${characterId}: ${chosenTechnique}`, {
      characterId,
      userId,
      technique: chosenTechnique,
      needs,
      emotionalState,
    });

    return chosenTechnique;
  }

  /**
   * Выбор техники для применения
   */
  async selectTechnique(context: IManipulationContext): Promise<{
    techniqueType: ManipulativeTechniqueType;
    intensity: number;
    priority: number;
    target: string;
  }> {
    // Извлекаем данные из контекста
    const { characterId, userId } = context;

    // Используем userMessage, если messageContent отсутствует
    const messageContent = context.messageContent || context.userMessage || '';

    // Используем существующий метод анализа и выбора техники
    const selectedTechnique = await this.analyzeSituationAndChooseTechnique(
      characterId,
      Number(userId),
      messageContent,
    );

    // Если не удалось выбрать технику, используем технику по умолчанию
    const techniqueType = selectedTechnique || ManipulativeTechniqueType.GRADUAL_INVOLVEMENT;

    // Определяем интенсивность техники (от 0 до 1)
    const intensity =
      context.intensityLevel === TechniqueIntensity.AGGRESSIVE
        ? 0.9
        : context.intensityLevel === TechniqueIntensity.MODERATE
          ? 0.6
          : 0.3;

    // Определяем цель воздействия
    const target = this.determineTechniqueTarget(techniqueType);

    // Добавляем поле priority равное intensity для совместимости с тестами
    const priority = intensity;

    return { techniqueType, intensity, priority, target };
  }

  /**
   * Определяет целевой параметр для техники
   */
  private determineTechniqueTarget(techniqueType: ManipulativeTechniqueType): string {
    const targets = {
      [ManipulativeTechniqueType.PUSH_PULL]: 'emotional-stability',
      [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: 'trust',
      [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: 'self-esteem',
      [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: 'guilt',
      [ManipulativeTechniqueType.ISOLATION]: 'social-connections',
      [ManipulativeTechniqueType.CONSTANT_VALIDATION]: 'approval-dependency',
      [ManipulativeTechniqueType.TROJAN_HORSE]: 'worldview',
      [ManipulativeTechniqueType.GASLIGHTING]: 'perception-confidence',
      [ManipulativeTechniqueType.SNOWBALL]: 'boundaries',
      [ManipulativeTechniqueType.TRIANGULATION]: 'jealousy',
      [ManipulativeTechniqueType.LOVE_BOMBING]: 'emotional-dependency',
      [ManipulativeTechniqueType.VALIDATION]: 'self-worth',
    };

    return targets[techniqueType] || 'emotional-state';
  }

  /**
   * Выполнение манипулятивной техники
   * @param contextOrCharacterId Контекст манипуляции или ID персонажа
   * @param userIdOrSelectedTechnique ID пользователя или выбранная техника
   * @param techniqueType Тип техники (опционально)
   * @returns Результат выполнения техники
   */
  async executeTechnique(
    contextOrCharacterId: IManipulationContext | number,
    userIdOrSelectedTechnique?:
      | number
      | { techniqueType: ManipulativeTechniqueType; intensity: number; target: string },
    techniqueType?: ManipulativeTechniqueType,
  ): Promise<string | { success: boolean; message: string }> {
    // Проверяем, какая перегрузка была вызвана
    if (typeof contextOrCharacterId === 'number') {
      // Первая перегрузка: (characterId, userId, technique)
      const characterId = contextOrCharacterId;
      const userId = userIdOrSelectedTechnique as number;
      const technique = techniqueType;

      // Создаем Entity для сохранения в БД
      const techniqueExecution = this.techniqueExecutionRepository.create({
        techniqueType: technique,
        intensity: this.calculateIntensity(characterId, technique),
        phase: TechniquePhase.EXECUTION,
        characterId,
        userId: Number(userId),
        startTime: new Date(),
        effectiveness: 0,
        ethicalScore: 50,
        generatedResponse: '', // Заполним после генерации
      });

      try {
        // Генерируем ответ с применением техники
        const manipulativeResponse = await this.generateManipulativeResponse(techniqueExecution);

        // Обновляем ответ в Entity
        techniqueExecution.generatedResponse = manipulativeResponse;

        // Сохраняем в базу данных
        const savedExecution = await this.techniqueExecutionRepository.save(techniqueExecution);

        // Добавляем в активные выполнения для мониторинга
        const characterExecutions = this.activeExecutions.get(characterId) || [];
        const memoryExecution: ITechniqueExecution = {
          id: savedExecution.id.toString(),
          techniqueType: savedExecution.techniqueType,
          intensity: savedExecution.intensity,
          characterId: savedExecution.characterId,
          userId: savedExecution.userId,
          startTime: savedExecution.startTime,
          effectiveness: savedExecution.effectiveness,
        };
        characterExecutions.push(memoryExecution);
        this.activeExecutions.set(characterId, characterExecutions);

        this.eventEmitter.emit('manipulation.technique.executed', {
          characterId,
          userId,
          technique,
          execution: savedExecution,
        });

        return manipulativeResponse;
      } catch (error) {
        this.logService.error(
          `Error executing technique ${technique} for character ${characterId}`,
          {
            error: error.message,
            characterId,
            userId,
            technique,
          },
        );
        throw error;
      }
    } else {
      // Вторая перегрузка: (context, selectedTechnique?)
      const context = contextOrCharacterId;

      // Используем userMessage, если messageContent отсутствует
      const messageContent = context.messageContent || context.userMessage;

      // Если передана выбранная техника, используем её, иначе выбираем технику автоматически
      let selectedTechnique: {
        techniqueType: ManipulativeTechniqueType;
        intensity: number;
        target: string;
      };

      if (userIdOrSelectedTechnique && typeof userIdOrSelectedTechnique !== 'number') {
        selectedTechnique = userIdOrSelectedTechnique;
      } else {
        // Если техника не передана, выбираем автоматически
        // Создаем новый контекст с правильным полем messageContent
        const updatedContext = { ...context, messageContent };
        selectedTechnique = await this.selectTechnique(updatedContext);
      }

      try {
        // Определяем интенсивность на основе переданных данных или используем значение по умолчанию
        const intensity =
          context.intensityLevel ||
          (selectedTechnique.intensity > 0.7
            ? TechniqueIntensity.AGGRESSIVE
            : selectedTechnique.intensity > 0.4
              ? TechniqueIntensity.MODERATE
              : TechniqueIntensity.SUBTLE);

        // Определяем фазу техники
        const phase = context.phase || TechniquePhase.EXECUTION;

        // Создаем Entity для сохранения в БД
        const techniqueExecution = this.techniqueExecutionRepository.create({
          techniqueType: selectedTechnique.techniqueType,
          intensity,
          phase,
          characterId: context.characterId,
          userId: Number(context.userId),
          startTime: new Date(),
          effectiveness: Math.round(selectedTechnique.intensity * 100),
          ethicalScore: 50,
          generatedResponse: '', // Заполним после генерации
        });

        // Генерируем ответ с применением техники
        const manipulativeResponse = await this.generateManipulativeResponse(techniqueExecution);

        // Обновляем ответ в Entity
        techniqueExecution.generatedResponse = manipulativeResponse;

        // Сохраняем в базу данных
        await this.techniqueExecutionRepository.save(techniqueExecution);

        return { success: true, message: manipulativeResponse };
      } catch (error) {
        this.logService.error(
          `Error executing technique ${selectedTechnique.techniqueType} for context`,
          {
            error: error.message,
            context,
            selectedTechnique,
          },
        );
        return { success: false, message: 'Техника не может быть применена в данный момент.' };
      }
    }
  }

  /**
   * Обновление профиля пользователя на основе данных
   */
  async updateUserProfile(
    characterId: number | string,
    userId: number | string,
    profileData: {
      vulnerabilities?: string[];
      successfulTechniques?: ManipulativeTechniqueType[];
      resistedTechniques?: ManipulativeTechniqueType[];
      emotionalTriggers?: string[];
    },
  ): Promise<UserManipulationProfile> {
    // Преобразуем ID к числовому типу, если они переданы как строки
    let numericUserId: number;
    let numericCharacterId: number;

    if (typeof userId === 'string') {
      // Проверяем, является ли строка UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        // Если это UUID, преобразуем его в число
        numericUserId = this.uuidToNumeric(userId);
      } else {
        numericUserId = parseInt(userId, 10);
      }
    } else {
      numericUserId = userId;
    }

    if (typeof characterId === 'string') {
      // Проверяем, является ли строка UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(characterId)) {
        // Если это UUID, преобразуем его в число
        numericCharacterId = this.uuidToNumeric(characterId);
      } else {
        numericCharacterId = parseInt(characterId, 10);
      }
    } else {
      numericCharacterId = characterId;
    }

    // Проверяем, что ID валидны
    if (isNaN(numericUserId) || isNaN(numericCharacterId)) {
      throw new Error(`Invalid ID format: userId=${userId}, characterId=${characterId}`);
    }

    try {
      // Поиск или создание профиля пользователя
      let profile = await this.userManipulationProfileRepository.findOne({
        where: { userId: numericUserId, characterId: numericCharacterId },
      });

      if (!profile) {
        profile = this.userManipulationProfileRepository.create({
          userId: numericUserId,
          characterId: numericCharacterId,
          susceptibilityScore: 50, // начальное значение
          vulnerabilities: [],
          successfulTechniques: [],
          resistedTechniques: [],
          emotionalTriggers: [],
          lastUpdate: new Date(),
        });
      }

      // Обновление профиля на основе предоставленных данных
      if (profileData.vulnerabilities) {
        profile.vulnerabilities = profileData.vulnerabilities;
      }

      if (profileData.successfulTechniques) {
        profile.successfulTechniques = profileData.successfulTechniques;
      }

      if (profileData.resistedTechniques) {
        profile.resistedTechniques = profileData.resistedTechniques;
      }

      if (profileData.emotionalTriggers) {
        profile.emotionalTriggers = profileData.emotionalTriggers;
      }

      profile.lastUpdate = new Date();
      const savedProfile = await this.userManipulationProfileRepository.save(profile);

      this.logService.log(
        `Updated manipulation profile for user ${numericUserId} with character ${numericCharacterId}`,
        {
          userId: numericUserId,
          characterId: numericCharacterId,
          profileData,
        },
      );

      return savedProfile;
    } catch (error) {
      this.logService.error(`Failed to update user manipulation profile`, {
        error: error.message,
        userId: numericUserId,
        characterId: numericCharacterId,
        profileData,
      });
      throw error;
    }
  }

  /**
   * Генерация манипулятивного ответа через LLM
   */
  private async generateManipulativeResponse(
    execution: TechniqueExecution | ITechniqueExecution,
  ): Promise<string> {
    const prompt = this.promptTemplateService.createPrompt('character-system', {
      characterName: 'Персонаж',
      characterDescription: 'Применяет манипулятивную технику',
      personalityTraits: `Использует технику ${execution.techniqueType}`,
      hobbies: 'психология',
      fears: 'отвержение',
      values: 'влияние',
      currentEmotion: execution.intensity,
      emotionalIntensity: 70,
      additionalContext: `Применить технику ${execution.techniqueType} с интенсивностью ${execution.intensity}`,
    });

    const result = await this.llmService.generateText([
      { role: LLMMessageRole.SYSTEM, content: prompt },
      { role: LLMMessageRole.USER, content: 'Сгенерируй ответ применяя указанную технику' },
    ]);

    this.logService.log(`Generated manipulative response using ${execution.techniqueType}`, {
      technique: execution.techniqueType,
      characterId: execution.characterId,
    });

    return result.text;
  }

  /**
   * Мониторинг эффективности техник
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorTechniqueEffectiveness(): Promise<void> {
    for (const [characterId, executions] of this.activeExecutions.entries()) {
      for (const execution of executions) {
        if (!execution.endTime) {
          await this.evaluateEffectiveness(execution);
        }
      }
      this.logService.log(`Effectiveness monitored for character ${characterId}`, { characterId });
    }
  }

  /**
   * Оценка эффективности выполненной техники
   */
  private async evaluateEffectiveness(execution: ITechniqueExecution): Promise<void> {
    // Получаем обновленные данные о потребностях и эмоциях
    const needs = await this.needsService.getActiveNeeds(execution.characterId);
    const emotionalState = await this.emotionalStateService.getEmotionalState(
      execution.characterId,
    );

    // Простая оценка эффективности на основе изменения потребностей и эмоций
    let effectiveness = 50; // Базовое значение
    if (needs.some(n => n.currentValue > 70)) {
      effectiveness += 20; // Увеличение эффективности, если есть высокие потребности
    }
    if (emotionalState.intensity > 50) {
      effectiveness += 10; // Увеличение эффективности при высоком эмоциональном уровне
    }

    execution.effectiveness = Math.min(effectiveness, 100);
    execution.endTime = new Date();

    // Обновляем в БД
    await this.techniqueExecutionRepository.update(
      { id: Number(execution.id) },
      { effectiveness: execution.effectiveness, endTime: execution.endTime },
    );

    this.eventEmitter.emit('manipulation.technique.evaluated', {
      characterId: execution.characterId,
      technique: execution.techniqueType,
      effectiveness: execution.effectiveness,
    });
  }

  /**
   * Выбор основных техник для персонажа
   */
  private selectPrimaryTechniques(_character: Character): ManipulativeTechniqueType[] {
    // Базовый набор техник
    return [
      ManipulativeTechniqueType.PUSH_PULL,
      ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
      ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION,
    ];
  }

  /**
   * Установка этических ограничений
   */
  private establishEthicalLimits(): {
    maxIntensity: TechniqueIntensity;
    bannedTechniques: ManipulativeTechniqueType[];
  } {
    return {
      maxIntensity: TechniqueIntensity.MODERATE,
      bannedTechniques: [
        ManipulativeTechniqueType.ISOLATION,
        ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL,
      ],
    };
  }

  /**
   * Проверка этических ограничений
   */
  private checkEthicalConstraints(characterId: number): boolean {
    const recentExecutions = this.activeExecutions.get(characterId) || [];
    const recentAggressiveCount = recentExecutions.filter(
      e =>
        e.intensity === TechniqueIntensity.AGGRESSIVE &&
        Date.now() - e.startTime.getTime() < 3600000,
    ).length;

    if (recentAggressiveCount > 2) {
      this.logService.warn(`Ethical limit exceeded for character ${characterId}`, { characterId });
      return false;
    }

    return true;
  }

  /**
   * Расчет интенсивности техники
   */
  private calculateIntensity(
    _characterId: number,
    _technique: ManipulativeTechniqueType,
  ): TechniqueIntensity {
    // Простая логика - всегда умеренная интенсивность
    return TechniqueIntensity.MODERATE;
  }

  /**
   * Экстренное отключение манипулятивных функций
   */
  async emergencyDisable(characterId: number): Promise<void> {
    const strategy = this.strategies.get(characterId);
    if (strategy) {
      strategy.ethicalLimits.maxIntensity = TechniqueIntensity.SUBTLE;
      strategy.ethicalLimits.bannedTechniques = Object.values(ManipulativeTechniqueType);
    }

    const executions = this.activeExecutions.get(characterId) || [];
    executions.forEach(e => {
      e.endTime = new Date();
    });
    this.activeExecutions.set(characterId, []);

    this.logService.warn(`Emergency disable activated for character ${characterId}`, {
      characterId,
    });
  }

  /**
   * Получение статистики применения техник
   */
  async getTechniqueStatistics(characterId: number): Promise<any> {
    const executions = this.activeExecutions.get(characterId) || [];

    return {
      totalExecutions: executions.length,
      averageEffectiveness:
        executions.reduce((sum, e) => sum + e.effectiveness, 0) / executions.length || 0,
      techniqueUsage: this.calculateTechniqueUsageStats(executions),
      ethicalViolations: executions.filter(e => e.intensity === TechniqueIntensity.AGGRESSIVE)
        .length,
    };
  }

  private calculateTechniqueUsageStats(executions: ITechniqueExecution[]): Record<string, number> {
    const usage: Record<string, number> = {};
    executions.forEach(e => {
      usage[e.techniqueType] = (usage[e.techniqueType] || 0) + 1;
    });
    return usage;
  }

  /**
   * Преобразует UUID в числовой ID
   * @param uuid UUID строка
   * @returns Числовой ID или 0, если UUID не может быть преобразован
   * @private
   */
  private uuidToNumeric(uuid: string): number {
    try {
      // Проверяем формат UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        const result = parseInt(uuid, 10) || 0;
        return result;
      }

      // Удаляем дефисы
      const cleanUuid = uuid.replace(/-/g, '');

      // Если UUID содержит только нули, возвращаем 0
      if (/^0+$/.test(cleanUuid)) {
        return 0;
      }

      // Берем первые 9 символов (чтобы избежать переполнения)
      const shortUuid = cleanUuid.substring(0, 9);

      // Преобразуем в число
      const result = parseInt(shortUuid, 10);

      return result || 0; // Возвращаем результат или 0, если не удалось преобразовать
    } catch (error) {
      console.error('Error converting UUID to numeric:', error);
      this.logService.warn('Не удалось преобразовать UUID в числовой ID', {
        uuid,
        error: error.message,
      });
      return 0;
    }
  }
}
