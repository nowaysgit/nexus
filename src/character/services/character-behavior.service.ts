import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { NeedsService } from './needs.service';
import { ActionService } from './action.service';
import { EmotionalState } from '../entities/emotional-state';
import { IMotivation } from '../interfaces/needs.interfaces';
import { LLMService } from '../../llm/services/llm.service';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { MessageAnalysis } from '../interfaces/analysis.interfaces';
import { MemoryService } from './memory.service';
import { MemoryType } from '../interfaces/memory.interfaces';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CharacterService } from './character.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { MessageAnalysisService } from './message-analysis.service';
import { ManipulationService } from './manipulation.service';
import { EmotionalStateService } from './emotional-state.service';
import { LogService } from '../../logging/log.service';
import {
  CharacterAction,
  ActionResult,
  ActionTriggerContext,
} from '../interfaces/behavior.interfaces';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { ActionType } from '../enums/action-type.enum';

/**
 * Типы фрустрации согласно ТЗ ВОЛЯ
 */
export enum FrustrationType {
  NEED_DEPRIVATION = 'need_deprivation', // Лишение потребности
  FAILED_ACTIONS = 'failed_actions', // Неудачные действия
  SOCIAL_REJECTION = 'social_rejection', // Социальное отвержение
  GOAL_BLOCKING = 'goal_blocking', // Блокировка целей
  RESOURCE_SHORTAGE = 'resource_shortage', // Нехватка ресурсов
}

/**
 * Уровни фрустрации согласно ТЗ ВОЛЯ
 */
export enum FrustrationLevel {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

/**
 * Поведенческие паттерны при фрустрации согласно ТЗ ВОЛЯ
 */
export interface FrustrationBehaviorPattern {
  type: FrustrationType;
  level: FrustrationLevel;
  behaviorModifiers: {
    aggressionIncrease: number; // Увеличение агрессивности (0-100%)
    withdrawalTendency: number; // Склонность к замкнутости (0-100%)
    impulsivityBoost: number; // Повышение импульсивности (0-100%)
    riskTaking: number; // Склонность к риску (0-100%)
    socialAvoidance: number; // Избегание социальных контактов (0-100%)
  };
  emotionalModifiers: {
    irritabilityLevel: number; // Уровень раздражительности (0-100%)
    anxietyLevel: number; // Уровень тревожности (0-100%)
    depressionRisk: number; // Риск депрессии (0-100%)
    emotionalVolatility: number; // Эмоциональная нестабильность (0-100%)
  };
  temporaryDebuffs: {
    actionSuccessReduction: number; // Снижение успешности действий (0-50%)
    resourceEfficiencyLoss: number; // Потеря эффективности ресурсов (0-30%)
    socialSkillPenalty: number; // Штраф к социальным навыкам (0-40%)
    decisionMakingImpairment: number; // Ухудшение принятия решений (0-60%)
    duration: number; // Продолжительность в минутах
  };
}

/**
 * Сервис для координации поведения персонажей
 * Объединяет логику потребностей, мотиваций, действий и памяти персонажа
 * Является центральным сервисом, управляющим всеми жизненными циклами персонажей
 */
@Injectable()
export class CharacterBehaviorService {
  private readonly logService: LogService;

  // Конфигурационные параметры из настроек
  private readonly updateInterval: number;
  private readonly motivationThreshold: number;
  private readonly actionChance: number;
  private readonly maxMemoryCount: number;
  private readonly defaultMemoryImportance: number;

  // Карта последних времен обработки для каждого персонажа
  private lastProcessTimes: Map<number, Date> = new Map();

  // Интервал для фоновых процессов (для возможности очистки в тестах)
  private behaviorInterval?: NodeJS.Timeout;

  // Система отслеживания фрустрации согласно ТЗ ВОЛЯ
  private characterFrustrationLevels: Map<number, FrustrationLevel> = new Map();
  private characterFrustrationTypes: Map<number, Set<FrustrationType>> = new Map();
  private activeFrustrationPatterns: Map<number, FrustrationBehaviorPattern[]> = new Map();
  private frustrationDebuffTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    private readonly llmService: LLMService,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    private readonly needsService: NeedsService,
    private readonly actionService: ActionService,
    private readonly memoryService: MemoryService,
    private readonly characterService: CharacterService,
    private readonly messageAnalysisService: MessageAnalysisService,
    private readonly manipulationService: ManipulationService,
    private readonly emotionalStateService: EmotionalStateService,
    private readonly configService: ConfigService,
    logService: LogService,
  ) {
    this.logService = logService.setContext(CharacterBehaviorService.name);
    // Получаем конфигурацию через ConfigService
    this.updateInterval = this.configService.get<number>('character.behavior.updateInterval', 300);
    this.motivationThreshold = this.configService.get<number>(
      'character.behavior.motivationThreshold',
      70,
    );
    this.actionChance = this.configService.get<number>('character.behavior.actionChance', 0.3);
    this.maxMemoryCount = this.configService.get<number>('character.maxMemorySize', 100);
    this.defaultMemoryImportance = this.configService.get<number>(
      'character.behavior.defaultMemoryImportance',
      5,
    );

    // Запускаем цикл обработки поведения персонажей только если не в тестовом режиме
    if (process.env.NODE_ENV !== 'test') {
      this.startBehaviorCycle();
    }
  }

  /**
   * Остановка фоновых процессов (для тестов)
   */
  public stopBehaviorCycle(): void {
    if (this.behaviorInterval) {
      clearInterval(this.behaviorInterval);
      this.behaviorInterval = undefined;
    }

    // Очищаем все таймеры фрустрации
    for (const timer of this.frustrationDebuffTimers.values()) {
      clearTimeout(timer);
    }
    this.frustrationDebuffTimers.clear();
  }

  /**
   * Запуск цикла обработки поведения персонажей
   */
  private startBehaviorCycle(): void {
    this.logService.log('Запуск цикла обработки поведения персонажей');

    // Используем функцию-обертку для безопасного вызова processCharacterCycle
    const safeProcessBehaviorCycle = () => {
      void this.processBehaviorCycle().catch(error => {
        this.logService.error(
          `Ошибка в цикле обработки поведения: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    };

    // Запускаем цикл с правильным интервалом из конфигурации
    this.behaviorInterval = setInterval(safeProcessBehaviorCycle, this.updateInterval * 1000);
  }

  /**
   * Плановое обновление поведения персонажей через cron
   * Запускается каждые 30 минут и обеспечивает дополнительную надежность
   * @returns Promise<void>
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateBehaviorCycle(): Promise<void> {
    this.logService.log('Выполняется плановое обновление поведения персонажей');
    return withErrorHandling(
      async () => {
        await this.processBehaviorCycle();
      },
      'плановом обновлении поведения персонажей',
      this.logService,
    );
  }

  /**
   * Цикл обработки поведения персонажей
   * Проверяет всех персонажей и обрабатывает их поведение при необходимости
   */
  private async processBehaviorCycle(): Promise<void> {
    // Получаем всех активных персонажей
    const characters = await this.characterRepository.find({
      relations: ['needs'],
    });

    const now = new Date();
    this.logService.debug(`Обработка поведения ${characters.length} персонажей`);

    for (const character of characters) {
      // Получаем время последней обработки персонажа
      const lastProcessTime = this.lastProcessTimes.get(character.id) || new Date(0);

      // Проверяем, прошло ли достаточно времени с последней обработки
      const timeSinceLastProcess = now.getTime() - lastProcessTime.getTime();
      const behaviorCycleInterval = this.BEHAVIOR_CYCLE_INTERVAL || this.updateInterval * 1000;

      if (timeSinceLastProcess >= behaviorCycleInterval) {
        try {
          // Обрабатываем поведение персонажа
          await this.processCharacterBehavior(character.id);

          // Обновляем время последней обработки
          this.lastProcessTimes.set(character.id, now);
        } catch (error) {
          this.logService.error(
            `Ошибка при обработке персонажа ${character.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Продолжаем с другими персонажами
        }
      }
    }
  }

  // Интервал между циклами обработки персонажа (в миллисекундах)
  private get BEHAVIOR_CYCLE_INTERVAL(): number {
    return this.updateInterval * 1000; // Конвертируем секунды в миллисекунды
  }

  /**
   * Обработка поведения конкретного персонажа
   * @param characterId ID персонажа
   */
  public async processCharacterBehavior(characterId: number): Promise<void> {
    // 1. Обновляем потребности персонажа через фоновый процесс
    await this.needsService.processNeedsGrowth(characterId);

    // 2. Анализируем фрустрацию согласно ТЗ ВОЛЯ
    await this.analyzeFrustration(characterId);

    // 3. Получаем текущие мотивации - это важно для принятия решений
    // Заменим на получение активных потребностей, так как мотивации управляются отдельно
    const activeNeeds = await this.needsService.getActiveNeeds(characterId);
    const motivations = activeNeeds
      .filter(need => need.currentValue >= need.threshold)
      .map(need => ({
        id: need.id,
        characterId,
        needType: need.type,
        intensity: need.currentValue / 10,
        status: 'active',
        createdAt: need.lastUpdated,
      }));

    // 3. Проверяем, выполняет ли персонаж действие в данный момент
    const isPerformingAction = this.actionService.isPerformingAction(characterId.toString());

    // 4. Если персонаж не занят и у него есть мотивации, определяем новое действие
    if (!isPerformingAction && motivations.length > 0) {
      // Используем случайный фактор из конфигурации для вероятности действия
      if (Math.random() < this.actionChance) {
        try {
          // Получаем объект персонажа для ActionService
          const character = await this.characterRepository.findOne({
            where: { id: characterId },
          });

          if (character) {
            // Используем ActionService для определения и выполнения действия
            const action = await this.actionService.determineAndPerformAction(character, {
              characterId: character.id,
              userId: character.userId,
              triggerType: 'motivation_based',
              triggerData: { autoGenerated: true },
              timestamp: new Date(),
              motivations,
            });

            if (action) {
              this.logService.debug(
                `Персонаж ${characterId} начал новое действие: ${action.type} - ${action.description}`,
              );

              // Добавляем запись в журнал о новом действии для отладки
              this.logService.log(
                `Персонаж ${characterId} начал действие ${action.type} - интенсивность ${motivations[0]?.intensity || 'неизвестна'}`,
              );
            }
          }
        } catch (error) {
          this.logService.error(
            `Ошибка при инициации действия для персонажа ${characterId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else if (isPerformingAction) {
      // Если персонаж занят, логируем его текущее действие для отладки
      const currentAction = this.actionService.getCurrentAction(characterId.toString());
      if (currentAction) {
        this.logService.debug(
          `Персонаж ${characterId} занят действием: ${currentAction.type} - ${currentAction.description}`,
        );
      }
    }
  }

  /**
   * Обработка входящего сообщения от пользователя
   * Анализирует сообщение и обновляет потребности и мотивации персонажа
   * @param characterId ID персонажа
   * @param userId ID пользователя
   * @param messageText Текст сообщения пользователя
   * @param messageId ID сообщения (опционально)
   */

  /**
   * Метод для обработки сообщения с готовым анализом от координатора
   */
  public async processUserMessageWithAnalysis(
    characterId: number,
    userId: number,
    messageText: string,
    analysis: MessageAnalysis,
    messageId?: number,
  ): Promise<void> {
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
      relations: ['needs'],
    });

    if (!character) {
      this.logService.error(`Персонаж с ID ${characterId} не найден`);
      return;
    }

    // Обновляем потребности на основе анализа
    await this.updateNeedsBasedOnMessage(characterId, analysis);

    // Сохраняем сообщение в памяти
    await this.saveMessageMemory(
      characterId,
      userId,
      messageText,
      analysis.urgency * 10,
      messageId,
    );

    // Проверяем необходимость изменения действия
    await this.considerActionChangeBasedOnMessage(characterId, analysis);

    // Анализируем возможность применения манипулятивных техник
    await this.considerManipulativeTechniques(characterId, userId, messageText);
  }

  /**
   * Получение контекста поведения персонажа для формирования ответа
   * Включает эмоциональное состояние, мотивации, текущее действие и недавние воспоминания
   * @param characterId ID персонажа
   * @returns Контекст поведения персонажа
   */
  public async getBehaviorContextForResponse(characterId: number): Promise<{
    emotionalState: EmotionalState | null;
    motivations: IMotivation[];
    currentAction: CharacterAction | null;
    recentMemories: CharacterMemory[];
  }> {
    try {
      // Получаем эмоциональное состояние через EmotionalStateService
      const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

      // Получаем мотивации через активные потребности
      const activeNeeds = await this.needsService.getActiveNeeds(characterId);
      const motivations = activeNeeds
        .filter(need => need.currentValue >= need.threshold)
        .map(need => ({
          id: need.id,
          characterId,
          needType: need.type,
          intensity: need.currentValue / 10,
          status: 'active',
          createdAt: need.lastUpdated,
        }));

      // Получаем текущее действие
      const currentAction: CharacterAction | null = this.actionService.getCurrentAction(
        characterId.toString(),
      );

      // Получаем недавние важные воспоминания
      const recentMemories = await this.memoryRepository.find({
        where: { characterId },
        order: { createdAt: 'DESC' },
        take: 5,
      });

      return {
        emotionalState,
        motivations,
        currentAction,
        recentMemories,
      };
    } catch (error) {
      this.logService.error('Ошибка при получении контекста поведения', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
      return {
        emotionalState: null,
        motivations: [],
        currentAction: null,
        recentMemories: [],
      };
    }
  }

  /**
   * Обновление потребностей персонажа на основе сообщения пользователя
   * @param characterId ID персонажа
   * @param analysis Результат анализа сообщения
   * @returns Promise<void>
   */
  private async updateNeedsBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Получаем массив затронутых потребностей
      const needsImpact = analysis?.needsImpact || {};
      const needsImpacted = Object.entries(needsImpact).map(([type, impact]) => ({
        type,
        impact: typeof impact === 'number' ? impact : 0,
      }));

      // Если нет потребностей для обновления, выходим
      if (!needsImpacted || needsImpacted.length === 0) {
        return;
      }

      // Используем NeedsService для обновления потребностей
      for (const impactedNeed of needsImpacted) {
        const needType = impactedNeed.type;
        const impact = impactedNeed.impact;

        // Проверяем, является ли тип потребности допустимым
        if (Object.values(CharacterNeedType).includes(needType as CharacterNeedType)) {
          // Обновляем потребность через NeedsService
          await this.needsService.updateNeed(characterId, {
            type: needType as CharacterNeedType,
            change: -impact, // Отрицательное значение для уменьшения потребности
            reason: `Влияние сообщения пользователя: ${impact}`,
          });
        }
      }
    } catch (error) {
      this.logService.error('Ошибка при обновлении потребностей на основе сообщения', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
    }
  }

  /**
   * Рассмотрение необходимости изменения текущего действия на основе сообщения
   */
  private async considerActionChangeBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    // Сохраняем ссылку на метод перед использованием withErrorHandling
    const createMemoryMethod = this.memoryService?.createMemory?.bind(this.memoryService) as (
      characterId: number,
      description: string,
      type: MemoryType,
      importance: number,
    ) => Promise<void>;
    const hasMemoryService = !!createMemoryMethod;

    return withErrorHandling(
      async () => {
        // Если важность сообщения высокая и персонаж выполняет действие
        const isPerforming = this.actionService.isPerformingAction(characterId.toString());
        const messageImportance = typeof analysis?.urgency === 'number' ? analysis.urgency : 0;

        if (messageImportance > 0.7 && isPerforming) {
          const currentAction = this.actionService.getCurrentAction(characterId.toString());

          // Если текущее действие не критично (не сон или важная задача)
          if (currentAction && !['SLEEP', 'WORK'].includes(currentAction.type)) {
            // Есть 50% шанс прервать текущее действие
            if (Math.random() < 0.5) {
              await this.actionService.interruptAction(characterId.toString());

              // Создаем память о том, что действие было прервано
              if (hasMemoryService) {
                try {
                  await createMemoryMethod(
                    characterId,
                    `Я прервал(а) занятие "${currentAction.description}" из-за важного сообщения от пользователя.`,
                    MemoryType.EVENT,
                    2, // MEDIUM importance
                  );
                } catch (error) {
                  this.logService.error('Ошибка при создании памяти о прерванном действии', {
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }

              this.logService.debug(
                `Персонаж ${characterId} прервал(а) действие "${currentAction.description}" из-за важного сообщения от пользователя.`,
              );
            }
          }
        }
      },
      'рассмотрении необходимости изменения действия',
      this.logService,
      {
        characterId,
        importanceLevel: typeof analysis?.urgency === 'number' ? analysis.urgency : 0,
      },
    );
  }

  /**
   * Сохранение значимой информации о сообщении в память персонажа
   * ОТЛИЧИЕ ОТ DialogService: здесь сохраняется только ВАЖНАЯ информация
   * для формирования личности, а не полная история диалогов
   */
  private async saveMessageMemory(
    characterId: number,
    userId: number,
    messageText: string,
    importance: number,
    messageId?: number,
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        // Сохраняем в память только значимые сообщения (importance > 3)
        // DialogService автоматически сохранит ВСЕ сообщения для контекста
        if (importance > 3 && this.memoryService) {
          try {
            await this.memoryService.createMessageMemory({
              characterId,
              userId,
              messageText,
              importance,
              messageId,
              isFromCharacter: false,
            });

            this.logService.debug(
              `Создана событийная память о важном сообщении (важность: ${importance})`,
              {
                characterId,
                userId,
                messageId,
              },
            );
          } catch (error) {
            this.logService.error('Ошибка при сохранении событийной памяти о сообщении', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else if (importance <= 3) {
          this.logService.debug(
            `Сообщение не сохранено в память (низкая важность: ${importance})`,
            {
              characterId,
              userId,
              messageId,
            },
          );
        } else {
          this.logService.warn('MemoryService недоступен для сохранения событийной памяти');
        }
      },
      'сохранении событийной памяти о сообщении',
      this.logService,
      { characterId, userId, messageText, importance },
    );
  }

  /**
   * Анализ возможности применения манипулятивных техник
   */
  private async considerManipulativeTechniques(
    characterId: number,
    userId: number,
    messageText: string,
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        // Анализируем ситуацию и выбираем подходящую технику
        const chosenTechnique = await this.manipulationService.analyzeSituationAndChooseTechnique(
          characterId,
          userId,
          messageText,
        );

        if (chosenTechnique) {
          this.logService.debug(
            `Выбрана манипулятивная техника ${chosenTechnique} для персонажа ${characterId}`,
          );

          // Техника будет применена при генерации ответа через CharacterResponseService
          // Здесь мы только фиксируем выбор техники
        }
      },
      'анализе манипулятивных техник',
      this.logService,
      { characterId, userId },
    );
  }

  /**
   * Анализирует и обновляет уровень фрустрации персонажа согласно ТЗ ВОЛЯ
   */
  async analyzeFrustration(characterId: number): Promise<FrustrationLevel> {
    return withErrorHandling(
      async () => {
        const character = await this.characterRepository.findOne({
          where: { id: characterId },
          relations: ['needs'],
        });

        if (!character || !character.needs) {
          return FrustrationLevel.NONE;
        }

        let frustrationScore = 0;
        const frustrationTypes = new Set<FrustrationType>();

        // Анализ неудовлетворенных потребностей
        const criticalNeeds = character.needs.filter(need => need.currentValue > 80);
        if (criticalNeeds.length > 0) {
          frustrationScore += criticalNeeds.length * 15;
          frustrationTypes.add(FrustrationType.NEED_DEPRIVATION);
        }

        // Анализ неудачных действий (упрощенная версия)
        const currentAction = this.actionService.getCurrentAction(characterId.toString());
        if (currentAction && currentAction.status === 'failed') {
          frustrationScore += 20;
          frustrationTypes.add(FrustrationType.FAILED_ACTIONS);
        }

        // Анализ социального отвержения (на основе памяти)
        const recentMemories = await this.memoryRepository.find({
          where: { characterId },
          order: { createdAt: 'DESC' },
          take: 10,
        });

        const negativeInteractions = recentMemories.filter(
          memory =>
            memory.content.includes('отказ') ||
            memory.content.includes('игнор') ||
            memory.content.includes('отвержение'),
        );

        if (negativeInteractions.length > 2) {
          frustrationScore += negativeInteractions.length * 10;
          frustrationTypes.add(FrustrationType.SOCIAL_REJECTION);
        }

        // Определяем уровень фрустрации
        let level: FrustrationLevel;
        if (frustrationScore >= 80) level = FrustrationLevel.CRITICAL;
        else if (frustrationScore >= 60) level = FrustrationLevel.SEVERE;
        else if (frustrationScore >= 40) level = FrustrationLevel.MODERATE;
        else if (frustrationScore >= 20) level = FrustrationLevel.MILD;
        else level = FrustrationLevel.NONE;

        // Обновляем состояние фрустрации
        this.characterFrustrationLevels.set(characterId, level);
        this.characterFrustrationTypes.set(characterId, frustrationTypes);

        // Применяем поведенческие паттерны если фрустрация значительная
        if (level !== FrustrationLevel.NONE) {
          await this.applyFrustrationBehaviorPatterns(characterId, level, frustrationTypes);
        }

        this.logService.debug(
          `Персонаж ${characterId}: уровень фрустрации ${level}, типы: ${Array.from(frustrationTypes).join(', ')}`,
        );

        return level;
      },
      'анализе фрустрации персонажа',
      this.logService,
      { characterId },
      FrustrationLevel.NONE,
    );
  }

  /**
   * Применяет поведенческие паттерны при фрустрации согласно ТЗ ВОЛЯ
   */
  private async applyFrustrationBehaviorPatterns(
    characterId: number,
    level: FrustrationLevel,
    types: Set<FrustrationType>,
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        const patterns: FrustrationBehaviorPattern[] = [];

        // Создаем паттерны для каждого типа фрустрации
        for (const type of types) {
          const pattern = this.createFrustrationPattern(type, level);
          patterns.push(pattern);
        }

        // Сохраняем активные паттерны
        this.activeFrustrationPatterns.set(characterId, patterns);

        // Применяем временные дебаффы
        await this.applyTemporaryDebuffs(characterId, patterns);

        // Модифицируем эмоциональное состояние
        await this.modifyEmotionalState(characterId, patterns);

        this.logService.log(
          `Применены паттерны фрустрации для персонажа ${characterId}: ${patterns.length} паттернов уровня ${level}`,
        );
      },
      'применении поведенческих паттернов фрустрации',
      this.logService,
      { characterId, level, typesCount: types.size },
    );
  }

  /**
   * Создает паттерн поведения для конкретного типа и уровня фрустрации
   */
  private createFrustrationPattern(
    type: FrustrationType,
    level: FrustrationLevel,
  ): FrustrationBehaviorPattern {
    const intensity = this.getFrustrationIntensity(level);

    const basePattern: FrustrationBehaviorPattern = {
      type,
      level,
      behaviorModifiers: {
        aggressionIncrease: 0,
        withdrawalTendency: 0,
        impulsivityBoost: 0,
        riskTaking: 0,
        socialAvoidance: 0,
      },
      emotionalModifiers: {
        irritabilityLevel: 0,
        anxietyLevel: 0,
        depressionRisk: 0,
        emotionalVolatility: 0,
      },
      temporaryDebuffs: {
        actionSuccessReduction: 0,
        resourceEfficiencyLoss: 0,
        socialSkillPenalty: 0,
        decisionMakingImpairment: 0,
        duration: 30, // Базовая продолжительность 30 минут
      },
    };

    // Настраиваем паттерн в зависимости от типа фрустрации
    switch (type) {
      case FrustrationType.NEED_DEPRIVATION:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.6;
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.8;
        basePattern.emotionalModifiers.irritabilityLevel = intensity * 0.9;
        basePattern.temporaryDebuffs.decisionMakingImpairment = intensity * 0.4;
        break;

      case FrustrationType.FAILED_ACTIONS:
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.7;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.3;
        basePattern.emotionalModifiers.depressionRisk = intensity * 0.5;
        basePattern.temporaryDebuffs.actionSuccessReduction = intensity * 0.3;
        break;

      case FrustrationType.SOCIAL_REJECTION:
        basePattern.behaviorModifiers.socialAvoidance = intensity * 0.9;
        basePattern.behaviorModifiers.withdrawalTendency = intensity * 0.8;
        basePattern.emotionalModifiers.anxietyLevel = intensity * 0.7;
        basePattern.temporaryDebuffs.socialSkillPenalty = intensity * 0.4;
        break;

      case FrustrationType.GOAL_BLOCKING:
        basePattern.behaviorModifiers.aggressionIncrease = intensity * 0.8;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.6;
        basePattern.emotionalModifiers.emotionalVolatility = intensity * 0.7;
        basePattern.temporaryDebuffs.decisionMakingImpairment = intensity * 0.5;
        break;

      case FrustrationType.RESOURCE_SHORTAGE:
        basePattern.behaviorModifiers.impulsivityBoost = intensity * 0.5;
        basePattern.behaviorModifiers.riskTaking = intensity * 0.7;
        basePattern.emotionalModifiers.anxietyLevel = intensity * 0.8;
        basePattern.temporaryDebuffs.resourceEfficiencyLoss = intensity * 0.3;
        break;
    }

    // Увеличиваем продолжительность для более высоких уровней
    basePattern.temporaryDebuffs.duration = 30 + intensity * 60; // От 30 до 90 минут

    return basePattern;
  }

  /**
   * Получает интенсивность фрустрации как число от 0 до 1
   */
  private getFrustrationIntensity(level: FrustrationLevel): number {
    switch (level) {
      case FrustrationLevel.MILD:
        return 0.2;
      case FrustrationLevel.MODERATE:
        return 0.4;
      case FrustrationLevel.SEVERE:
        return 0.7;
      case FrustrationLevel.CRITICAL:
        return 1.0;
      default:
        return 0;
    }
  }

  /**
   * Применяет временные дебаффы согласно ТЗ ВОЛЯ
   */
  private async applyTemporaryDebuffs(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    // Очищаем предыдущие таймеры
    const existingTimer = this.frustrationDebuffTimers.get(characterId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Вычисляем общую продолжительность дебаффов
    const maxDuration = Math.max(...patterns.map(p => p.temporaryDebuffs.duration));

    // Устанавливаем таймер для снятия дебаффов
    const timer = setTimeout(
      () => {
        this.removeFrustrationEffects(characterId);
      },
      maxDuration * 60 * 1000,
    ); // Конвертируем минуты в миллисекунды

    this.frustrationDebuffTimers.set(characterId, timer);

    this.logService.debug(
      `Применены временные дебаффы для персонажа ${characterId} на ${maxDuration} минут`,
    );
  }

  /**
   * Модифицирует эмоциональное состояние персонажа согласно ТЗ ВОЛЯ
   */
  private async modifyEmotionalState(
    characterId: number,
    patterns: FrustrationBehaviorPattern[],
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        // Суммируем эмоциональные модификаторы
        let totalIrritability = 0;
        let totalAnxiety = 0;
        let totalDepression = 0;
        let totalVolatility = 0;

        for (const pattern of patterns) {
          totalIrritability += pattern.emotionalModifiers.irritabilityLevel;
          totalAnxiety += pattern.emotionalModifiers.anxietyLevel;
          totalDepression += pattern.emotionalModifiers.depressionRisk;
          totalVolatility += pattern.emotionalModifiers.emotionalVolatility;
        }

        // Создаем запись в памяти о изменении эмоционального состояния
        if (this.memoryService) {
          const emotionalDescription = this.generateEmotionalStateDescription(
            totalIrritability,
            totalAnxiety,
            totalDepression,
            totalVolatility,
          );

          await this.memoryService.createMemory(
            characterId,
            `Мое эмоциональное состояние изменилось из-за фрустрации: ${emotionalDescription}`,
            MemoryType.EMOTION,
            7, // HIGH importance
          );
        }

        this.logService.debug(
          `Модифицировано эмоциональное состояние персонажа ${characterId}: раздражительность +${totalIrritability.toFixed(1)}, тревожность +${totalAnxiety.toFixed(1)}`,
        );
      },
      'модификации эмоционального состояния',
      this.logService,
      { characterId, patternsCount: patterns.length },
    );
  }

  /**
   * Генерирует описание эмоционального состояния
   */
  private generateEmotionalStateDescription(
    irritability: number,
    anxiety: number,
    depression: number,
    volatility: number,
  ): string {
    const descriptions: string[] = [];

    if (irritability > 50) descriptions.push('повышенная раздражительность');
    if (anxiety > 50) descriptions.push('тревожность');
    if (depression > 50) descriptions.push('подавленность');
    if (volatility > 50) descriptions.push('эмоциональная нестабильность');

    return descriptions.length > 0 ? descriptions.join(', ') : 'легкое беспокойство';
  }

  /**
   * Удаляет эффекты фрустрации после истечения времени
   */
  private removeFrustrationEffects(characterId: number): void {
    this.characterFrustrationLevels.set(characterId, FrustrationLevel.NONE);
    this.characterFrustrationTypes.delete(characterId);
    this.activeFrustrationPatterns.delete(characterId);
    this.frustrationDebuffTimers.delete(characterId);

    this.logService.debug(`Эффекты фрустрации сняты с персонажа ${characterId}`);
  }

  /**
   * Получает текущий уровень фрустрации персонажа
   */
  getFrustrationLevel(characterId: number): FrustrationLevel {
    return this.characterFrustrationLevels.get(characterId) || FrustrationLevel.NONE;
  }

  /**
   * Получает активные паттерны фрустрации персонажа
   */
  getActiveFrustrationPatterns(characterId: number): FrustrationBehaviorPattern[] {
    return this.activeFrustrationPatterns.get(characterId) || [];
  }

  /**
   * Проверяет, влияет ли фрустрация на действие персонажа
   */
  applyFrustrationToAction(characterId: number, baseSuccessRate: number): number {
    const patterns = this.getActiveFrustrationPatterns(characterId);
    if (patterns.length === 0) return baseSuccessRate;

    let totalReduction = 0;
    for (const pattern of patterns) {
      totalReduction += pattern.temporaryDebuffs.actionSuccessReduction;
    }

    const modifiedRate = Math.max(10, baseSuccessRate - totalReduction);

    this.logService.debug(
      `Фрустрация снизила успешность действия персонажа ${characterId} с ${baseSuccessRate}% до ${modifiedRate}%`,
    );

    return modifiedRate;
  }

  async determineBehaviorPattern(
    characterId: number,
  ): Promise<{ type: string; description: string }> {
    // Получаем текущий уровень фрустрации и активные паттерны
    const frustrationLevel = await this.analyzeFrustration(characterId);
    const frustrationPatterns = this.getActiveFrustrationPatterns(characterId);

    // Получаем эмоциональное состояние персонажа
    const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

    // Получаем активные потребности
    const activeNeeds = await this.needsService.getActiveNeeds(characterId);

    // Определяем доминирующую потребность
    let dominantNeedType = 'none';
    let maxPriority = 0;
    for (const need of activeNeeds) {
      if (need.priority > maxPriority && need.currentValue >= need.threshold) {
        maxPriority = need.priority;
        dominantNeedType = need.type;
      }
    }

    // Определяем тип поведения на основе фрустрации и потребностей
    let behaviorType = 'balanced';
    let description = 'Персонаж находится в сбалансированном состоянии';

    if (frustrationLevel !== FrustrationLevel.NONE && frustrationPatterns.length > 0) {
      // Если есть фрустрация, выбираем поведение на основе самого сильного паттерна
      const strongestPattern = frustrationPatterns.reduce((max, pattern) =>
        this.getFrustrationIntensity(pattern.level) > this.getFrustrationIntensity(max.level)
          ? pattern
          : max,
      );

      behaviorType = `frustrated_${strongestPattern.type}`;
      description = `Персонаж демонстрирует поведение, связанное с фрустрацией типа ${strongestPattern.type} на уровне ${strongestPattern.level}`;
    } else if (dominantNeedType !== 'none') {
      // Если фрустрации нет, но есть активные потребности, поведение определяется потребностью
      behaviorType = `need_driven_${dominantNeedType}`;
      description = `Персонаж стремится удовлетворить потребность в ${dominantNeedType}`;
    } else if (emotionalState) {
      // Если нет ни фрустрации, ни активных потребностей, поведение определяется эмоцией
      behaviorType = `emotion_driven_neutral`;
      description = `Персонаж действует в нейтральном эмоциональном состоянии`;
    }

    this.logService.debug(
      `Определен паттерн поведения для персонажа ${characterId}: ${behaviorType}`,
    );
    return { type: behaviorType, description };
  }

  async processIncomingMessage(characterId: number, message: string): Promise<{ text: string }> {
    // Анализируем входящее сообщение с помощью MessageAnalysisService
    const character = await this.characterRepository.findOne({ where: { id: characterId } });
    if (!character) throw new Error(`Character with ID ${characterId} not found`);
    const userId = 0; // Временное значение, так как userId отсутствует в контексте
    const analysis = await this.messageAnalysisService.analyzeUserMessage(
      character,
      userId,
      message,
    );

    // Получаем контекст поведения для формирования ответа
    const behaviorContext = await this.getBehaviorContextForResponse(characterId);

    // Определяем текущий паттерн поведения
    const behaviorPattern = await this.determineBehaviorPattern(characterId);

    // Формируем промт для LLM на основе контекста и анализа сообщения
    const prompt = this.constructResponsePrompt(
      behaviorContext,
      behaviorPattern,
      message,
      analysis,
    );

    // Генерируем ответ с помощью LLM
    const response = await this.llmService.generateText([
      { role: LLMMessageRole.USER, content: prompt },
    ]);
    const responseText = response.text;

    // Сохраняем память о сообщении и ответе
    await this.saveMessageMemory(characterId, userId, message, this.defaultMemoryImportance);
    await this.saveMessageMemory(characterId, userId, responseText, this.defaultMemoryImportance);

    return { text: responseText };
  }

  /**
   * Вспомогательный метод для создания промта для генерации ответа
   * @param behaviorContext Контекст поведения
   * @param behaviorPattern Паттерн поведения
   * @param message Сообщение пользователя
   * @param analysis Анализ сообщения
   * @returns string
   */
  private constructResponsePrompt(
    behaviorContext: {
      emotionalState: EmotionalState | null;
      motivations: IMotivation[];
      currentAction: CharacterAction | null;
      recentMemories: CharacterMemory[];
    },
    behaviorPattern: { type: string; description: string },
    message: string,
    analysis: MessageAnalysis,
  ): string {
    const emotionalStateInfo = behaviorContext.emotionalState
      ? `Текущее эмоциональное состояние: ${behaviorContext.emotionalState.primary} (интенсивность: ${behaviorContext.emotionalState.intensity})\n`
      : 'Нейтральное эмоциональное состояние\n';

    const motivationsInfo =
      behaviorContext.motivations.length > 0
        ? `Текущие мотивации:\n${behaviorContext.motivations
            .map(m => `- ${m.needType} (интенсивность: ${m.intensity})`)
            .join('\n')}\n`
        : 'Нет активных мотиваций\n';

    // Формируем описание последних воспоминаний
    const memories =
      behaviorContext.recentMemories.length > 0
        ? behaviorContext.recentMemories.map(m => m.content).join('; ')
        : 'нет недавних воспоминаний';

    // Формируем описание анализа сообщения
    const userMood = analysis.emotionalAnalysis?.userMood || 'неизвестно';
    const emotionalIntensity = analysis.emotionalAnalysis?.emotionalIntensity || 0.5;

    // Создаем промт с учетом всех факторов
    return `Ты - персонаж с искусственным интеллектом. ${emotionalStateInfo}Твои текущие мотивации: ${motivationsInfo}Твое текущее поведение: ${behaviorPattern.description}. Недавние воспоминания: ${memories}. Пользователь написал тебе сообщение: "${message}". Настроение пользователя: ${userMood} с интенсивностью ${emotionalIntensity}. Сформируй естественный и подходящий ответ, учитывая все эти факторы. Ответ должен быть кратким, не более 2-3 предложений.`;
  }

  /**
   * Обработка триггера действия
   * @param context Контекст триггера действия
   * @returns Результат выполнения действия
   */
  async processActionTrigger(context: ActionTriggerContext): Promise<ActionResult> {
    return withErrorHandling(
      async () => {
        this.logService.debug(
          `Обработка триггера действия ${context.triggerType} для персонажа ${context.characterId}`,
        );

        if (!context.motivations || context.motivations.length === 0) {
          return {
            success: false,
            message: `Нет подходящих мотиваций для триггера ${context.triggerType}`,
          };
        }

        // Выбираем основную мотивацию с наивысшей интенсивностью
        const primaryMotivation = context.motivations.sort((a, b) => b.intensity - a.intensity)[0];

        // Выбираем действие на основе мотивации
        const action = await this.selectActionForMotivation(context.characterId, primaryMotivation);

        if (!action) {
          return {
            success: false,
            message: `Не удалось выбрать действие для мотивации типа ${primaryMotivation.needType}`,
          };
        }

        // Получаем персонажа
        const character = await this.characterService.findOneById(context.characterId);
        if (!character) {
          throw new Error(`Персонаж с ID ${context.characterId} не найден`);
        }

        // Создаем полный контекст для ActionService, убедившись что triggerData существует
        const actionContext = {
          ...context,
          triggerData: context.triggerData || {},
        };

        // Выполняем действие через ActionService и преобразуем результат в ActionResult
        const actionResult = await this.actionService.determineAndPerformAction(
          character,
          actionContext as unknown as import('./action.service').ActionTriggerContext,
        );

        if (!actionResult) {
          return {
            success: false,
            message: 'Не удалось выполнить действие',
          };
        }

        return {
          success: true,
          data: {
            action: actionResult,
            result: { success: true },
          },
        };
      },
      'обработке триггера действия',
      this.logService,
      { characterId: context.characterId, triggerType: context.triggerType },
      {
        success: false,
        message: 'Произошла ошибка при обработке триггера действия',
      },
    );
  }

  /**
   * Выбор действия на основе мотивации
   * @param character Персонаж или идентификатор персонажа
   * @param motivation Мотивация
   * @returns Выбранное действие или null
   */
  private async selectActionForMotivation(
    _character: Character | number,
    motivation: IMotivation,
  ): Promise<CharacterAction | null> {
    return withErrorHandling(
      async () => {
        // Определяем тип действия на основе типа потребности
        let actionType: ActionType;
        let metadata: Record<string, unknown> = {};

        switch (motivation.needType) {
          case CharacterNeedType.ATTENTION:
            actionType = ActionType.SOCIALIZATION;
            break;
          case CharacterNeedType.COMMUNICATION:
            actionType = ActionType.INITIATE_CONVERSATION;
            break;
          case CharacterNeedType.SOCIAL_CONNECTION:
            actionType = ActionType.SEND_MESSAGE;
            break;
          case CharacterNeedType.SELF_EXPRESSION:
            actionType = ActionType.EXPRESS_EMOTION;
            metadata = { emotion: 'joy' }; // Добавляем метаданные для эмоций
            break;
          case CharacterNeedType.FUN:
            actionType = ActionType.ENTERTAINMENT;
            break;
          default:
            actionType = ActionType.SOCIALIZE;
        }

        // Создаем действие
        const action: CharacterAction = {
          type: actionType,
          description: `Действие на основе мотивации ${motivation.needType}`,
          priority:
            motivation.priority !== undefined
              ? motivation.priority
              : Math.round(motivation.intensity / 10), // Используем priority если есть, иначе на основе intensity
          relatedNeeds: [motivation.needType],
          status: 'planned',
          metadata,
        };

        return action;
      },
      'выборе действия на основе мотивации',
      this.logService,
      { motivationType: motivation.needType, characterId: motivation.characterId },
      null,
    );
  }
}
