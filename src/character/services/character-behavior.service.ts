import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { NeedsService } from './needs.service';
import { ActionService } from './action.service';
import { EmotionalState } from '../entities/emotional-state';
import { IMotivation } from '../interfaces/needs.interfaces';
import { LLMService } from '../../llm/services/llm.service';
import { MessageAnalysis } from '../interfaces/analysis.interfaces';
import { MemoryService } from './memory.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CharacterService } from './character.service';
import { MessageAnalysisService } from './message-analysis.service';
import { ManipulationService } from './manipulation.service';
import { EmotionalStateService } from './emotional-state.service';
import { MessageBehaviorService } from './message-behavior.service';
import { EmotionalBehaviorService, FrustrationLevel } from './emotional-behavior.service';
import { LogService } from '../../logging/log.service';
import { CharacterAction, ActionResult } from '../interfaces/behavior.interfaces';
import { ActionTriggerContext } from './action-generator.service';
import { BaseService } from '../../common/base/base.service';

/**
 * Сервис для координации поведения персонажей
 * Объединяет логику потребностей, мотиваций, действий и памяти персонажа
 * Является центральным сервисом, управляющим всеми жизненными циклами персонажей
 */
@Injectable()
export class CharacterBehaviorService extends BaseService {
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
    private readonly messageBehaviorService: MessageBehaviorService,
    private readonly emotionalBehaviorService: EmotionalBehaviorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    logService: LogService,
  ) {
    super(logService);
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
  }

  /**
   * Запуск цикла обработки поведения персонажей
   */
  private startBehaviorCycle(): void {
    this.logInfo('Запуск цикла обработки поведения персонажей');

    // Используем функцию-обертку для безопасного вызова processCharacterCycle
    const safeProcessBehaviorCycle = () => {
      void this.processBehaviorCycle().catch(error => {
        this.logError(
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
    this.logInfo('Выполняется плановое обновление поведения персонажей');
    return this.withErrorHandling('плановое обновление поведения персонажей', async () => {
      await this.processBehaviorCycle();
    });
  }

  /**
   * Цикл обработки поведения персонажей
   * Проверяет всех персонажей и обрабатывает их поведение при необходимости
   */
  private async processBehaviorCycle(): Promise<void> {
    // Получаем всех активных персонажей
    const characters = await this.characterRepository.find({
      where: { isActive: true },
    });

    this.logDebug(`Обработка поведения для ${characters.length} активных персонажей`);

    // Обрабатываем каждого персонажа
    for (const character of characters) {
      try {
        await this.processCharacterBehavior(character.id);
      } catch (error) {
        this.logError(
          `Ошибка при обработке поведения персонажа ${character.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Интервал обработки поведения в секундах (из конфигурации)
   */
  private get BEHAVIOR_CYCLE_INTERVAL(): number {
    return this.updateInterval;
  }

  /**
   * Обработка поведения конкретного персонажа
   * @param characterId ID персонажа
   */
  public async processCharacterBehavior(characterId: number): Promise<void> {
    // 1. Обновляем потребности персонажа через фоновый процесс
    await this.needsService.processNeedsGrowth(characterId);

    // 2. Анализируем фрустрацию через EmotionalBehaviorService
    await this.emotionalBehaviorService.analyzeFrustration(characterId);

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
              this.logDebug(
                `Персонаж ${characterId} начал новое действие: ${action.type} - ${action.description}`,
              );

              // Добавляем запись в журнал о новом действии для отладки
              this.logInfo(
                `Персонаж ${characterId} начал действие ${action.type} - интенсивность ${motivations[0]?.intensity || 'неизвестна'}`,
              );
            }
          }
        } catch (error) {
          this.logError(
            `Ошибка при инициации действия для персонажа ${characterId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else if (isPerformingAction) {
      // Если персонаж занят, логируем его текущее действие для отладки
      const currentAction = this.actionService.getCurrentAction(characterId.toString());
      if (currentAction) {
        this.logDebug(
          `Персонаж ${characterId} занят действием: ${currentAction.type} - ${currentAction.description}`,
        );
      }
    }
  }

  /**
   * Обработка сообщения пользователя с готовым анализом
   * Делегирует обработку в MessageBehaviorService
   */
  public async processUserMessageWithAnalysis(
    characterId: number,
    userId: number,
    messageText: string,
    analysis: MessageAnalysis,
    messageId?: number,
  ): Promise<void> {
    return this.messageBehaviorService.processUserMessageWithAnalysis(
      characterId,
      userId,
      messageText,
      analysis,
      messageId,
    );
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
      this.logError('Ошибка при получении контекста поведения', {
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
   * Делегирует анализ фрустрации в EmotionalBehaviorService
   */
  async analyzeFrustration(characterId: number) {
    return this.emotionalBehaviorService.analyzeFrustration(characterId);
  }

  /**
   * Делегирует получение уровня фрустрации в EmotionalBehaviorService
   */
  getFrustrationLevel(characterId: number) {
    return this.emotionalBehaviorService.getFrustrationLevel(characterId);
  }

  /**
   * Делегирует получение активных паттернов фрустрации в EmotionalBehaviorService
   */
  getActiveFrustrationPatterns(characterId: number) {
    return this.emotionalBehaviorService.getActiveFrustrationPatterns(characterId);
  }

  /**
   * Делегирует применение фрустрации к действию в EmotionalBehaviorService
   */
  applyFrustrationToAction(characterId: number, baseSuccessRate: number): number {
    return this.emotionalBehaviorService.applyFrustrationToAction(characterId, baseSuccessRate);
  }

  /**
   * Определение поведенческого паттерна персонажа
   */
  async determineBehaviorPattern(
    characterId: number,
  ): Promise<{ type: string; description: string }> {
    return this.withErrorHandling('определение поведенческого паттерна', async () => {
      // Получаем эмоциональное состояние
      const emotionalState = await this.emotionalStateService.getEmotionalState(characterId);

      // Анализируем фрустрацию через EmotionalBehaviorService
      const frustrationLevel = await this.emotionalBehaviorService.analyzeFrustration(characterId);
      const frustrationPatterns =
        this.emotionalBehaviorService.getActiveFrustrationPatterns(characterId);

      // Базовый тип поведения на основе эмоционального состояния
      let behaviorType = 'neutral';
      let description = 'Спокойное и сбалансированное поведение';

      if (emotionalState) {
        const emotion = emotionalState.primary;
        const intensity = emotionalState.intensity;

        // Определяем тип поведения на основе эмоции
        if (emotion === 'happiness' || emotion === 'joy') {
          behaviorType = 'positive';
          description = `Радостное и оптимистичное поведение (интенсивность: ${intensity})`;
        } else if (emotion === 'sadness' || emotion === 'melancholy') {
          behaviorType = 'melancholic';
          description = `Грустное и задумчивое поведение (интенсивность: ${intensity})`;
        } else if (emotion === 'anger' || emotion === 'rage') {
          behaviorType = 'aggressive';
          description = `Агрессивное и импульсивное поведение (интенсивность: ${intensity})`;
        } else if (emotion === 'fear' || emotion === 'anxiety') {
          behaviorType = 'anxious';
          description = `Тревожное и осторожное поведение (интенсивность: ${intensity})`;
        } else if (emotion === 'surprise') {
          behaviorType = 'curious';
          description = `Любопытное и открытое поведение (интенсивность: ${intensity})`;
        }
      }

      // Модифицируем поведение на основе фрустрации
      if (frustrationLevel !== FrustrationLevel.NONE && frustrationPatterns.length > 0) {
        const pattern = frustrationPatterns[0];
        const aggressionIncrease = pattern.behaviorModifiers.aggressionIncrease;
        const withdrawalTendency = pattern.behaviorModifiers.withdrawalTendency;

        if (aggressionIncrease > 50) {
          behaviorType = 'frustrated_aggressive';
          description += ` с повышенной агрессивностью из-за фрустрации`;
        } else if (withdrawalTendency > 50) {
          behaviorType = 'frustrated_withdrawn';
          description += ` с тенденцией к замкнутости из-за фрустрации`;
        } else {
          description += ` с легким влиянием фрустрации`;
        }
      }

      return { type: behaviorType, description };
    });
  }

  /**
   * Обработка входящего сообщения
   * Делегирует обработку в MessageBehaviorService
   */
  async processIncomingMessage(characterId: number, message: string): Promise<{ text: string }> {
    return this.withErrorHandling('обработка входящего сообщения', async () => {
      // Получаем контекст поведения
      const behaviorContext = await this.getBehaviorContextForResponse(characterId);

      // Определяем поведенческий паттерн
      const behaviorPattern = await this.determineBehaviorPattern(characterId);

      // Делегируем обработку в MessageBehaviorService
      const result = await this.messageBehaviorService.processIncomingMessage(
        characterId,
        0, // userId будет определен в MessageBehaviorService
        message,
        behaviorContext,
        behaviorPattern,
      );

      return { text: result.text };
    });
  }

  /**
   * Обработка триггера действия
   * Делегирует обработку в ActionService
   */
  async processActionTrigger(context: ActionTriggerContext): Promise<ActionResult> {
    return this.withErrorHandling('обработка триггера действия', async () => {
      return this.actionService.processActionTrigger(context);
    });
  }
}
