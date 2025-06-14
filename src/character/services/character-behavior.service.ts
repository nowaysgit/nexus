import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { CharacterMemory, MemoryImportance } from '../entities/character-memory.entity';
import { NeedsService } from './needs.service';
import { ActionService, ActionType } from './action.service';
import { EmotionalState } from '../interfaces/emotional-state.interface';
import { Motivation } from '../interfaces/motivation.interface';
import { OpenaiService } from '../../openai/openai.service';
import { CharacterNeedType } from '../interfaces/character-need-type.enum';
import { MessageAnalysis } from '../interfaces/message-analysis.interface';
import { MemoryType } from '../interfaces/memory-type.enum';
import { ConfigType } from '@nestjs/config';
import { characterConfig } from '../../config';
import { MemoryService } from './memory.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CharacterService } from './character.service';

/**
 * Сервис для координации поведения персонажей
 * Объединяет логику потребностей, мотиваций и действий
 */
@Injectable()
export class CharacterBehaviorService {
  private readonly logger = new Logger(CharacterBehaviorService.name);
  private readonly updateInterval: number;
  private readonly motivationThreshold: number;
  private readonly actionChance: number;
  private readonly maxMemoryCount: number;
  private readonly defaultMemoryImportance: number;

  // Карта последних времен обработки для каждого персонажа
  private lastProcessTimes: Map<number, Date> = new Map();

  // Интервал между циклами обработки персонажа (в миллисекундах)
  private readonly BEHAVIOR_CYCLE_INTERVAL = 5 * 60 * 1000; // 5 минут

  constructor(
    @Inject(characterConfig.KEY)
    private config: ConfigType<typeof characterConfig>,
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
    private needsService: NeedsService,
    private actionService: ActionService,
    private openaiService: OpenaiService,
    private readonly characterService: CharacterService,
    private readonly memoryService: MemoryService,
  ) {
    this.updateInterval = this.config.behaviorCycleInterval;
    this.motivationThreshold = this.config.needs.motivationThreshold;
    this.actionChance = this.config.actions.actionChance;
    this.maxMemoryCount = this.config.memory.maxCount;
    this.defaultMemoryImportance = this.config.memory.defaultImportance;
    // Запускаем цикл обработки поведения персонажей
    this.startBehaviorCycle();
  }

  /**
   * Запуск цикла обработки поведения персонажей
   */
  private startBehaviorCycle(): void {
    this.logger.log('Запуск цикла обработки поведения персонажей');
    setInterval(() => this.processBehaviorCycle(), 60 * 1000); // Каждую минуту
  }

  /**
   * Цикл обработки поведения персонажей
   * Проверяет всех персонажей и обрабатывает их поведение при необходимости
   */
  private async processBehaviorCycle(): Promise<void> {
    try {
      // Получаем всех активных персонажей
      const characters = await this.characterRepository.find({
        relations: ['needs'],
      });

      const now = new Date();

      for (const character of characters) {
        // Получаем время последней обработки персонажа
        const lastProcessTime = this.lastProcessTimes.get(character.id) || new Date(0);

        // Проверяем, прошло ли достаточно времени с последней обработки
        const timeSinceLastProcess = now.getTime() - lastProcessTime.getTime();

        if (timeSinceLastProcess >= this.BEHAVIOR_CYCLE_INTERVAL) {
          // Обрабатываем поведение персонажа
          await this.processCharacterBehavior(character.id);

          // Обновляем время последней обработки
          this.lastProcessTimes.set(character.id, now);
        }
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке цикла поведения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
    }
  }

  /**
   * Обработка поведения конкретного персонажа
   * @param characterId ID персонажа
   */
  public async processCharacterBehavior(characterId: number): Promise<void> {
    try {
      // 1. Обновляем потребности персонажа
      await this.needsService.updateCharacterNeeds(characterId);

      // 2. Получаем текущее эмоциональное состояние
      const emotionalState = await this.needsService.getCharacterEmotionalState(characterId);

      // 3. Получаем текущие мотивации
      const motivations = await this.needsService.getCharacterMotivations(characterId);

      // 4. Проверяем, выполняет ли персонаж действие в данный момент
      const isPerformingAction = this.actionService.isPerformingAction(characterId);

      // 5. Если персонаж не занят и у него есть мотивации, определяем новое действие
      if (!isPerformingAction && motivations.length > 0) {
        // Используем случайный фактор, чтобы персонажи не всегда действовали по мотивациям
        if (Math.random() < 0.4) {
          // 40% шанс выполнить действие
          await this.actionService.determineAndPerformAction(characterId, motivations);
        }
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке поведения персонажа ${characterId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
    }
  }

  /**
   * Обработка входящего сообщения от пользователя
   * Анализирует сообщение и обновляет потребности и мотивации персонажа
   * @param characterId ID персонажа
   * @param message Текст сообщения пользователя
   */
  public async processUserMessage(
    characterId: number,
    userId: number,
    messageText: string,
    messageId?: number,
  ): Promise<void> {
    try {
      const character = await this.characterService.findOne(characterId);
      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Анализируем сообщение пользователя
      const analysis = await this.analyzeMessage(character.id, messageText);

      // Обновляем состояние персонажа на основе сообщения
      await this.updateNeedsBasedOnMessage(character.id, analysis);

      // Сохраняем память о сообщении
      const importance = Math.min(Math.max(Math.round(analysis.importance * 10), 1), 10);
      await this.saveMessageMemory(character.id, userId, messageText, importance);

      // Проверяем необходимость изменения действия
      await this.considerActionChangeBasedOnMessage(character.id, analysis);
    } catch (error) {
      this.logger.error(`Ошибка при обработке сообщения пользователя: ${error.message}`);
    }
  }

  /**
   * Обновление потребностей персонажа на основе сообщения пользователя
   * @param characterId ID персонажа
   * @param analysis Результат анализа сообщения
   */
  private async updateNeedsBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Получаем текущие потребности персонажа
      const needs = await this.needsService.getCharacterNeeds(characterId);

      // Обновляем каждую потребность на основе анализа
      for (const need of needs) {
        const impactValue = analysis.needsImpact[need.type] || 0;

        if (impactValue !== 0) {
          // Нормализуем значение воздействия от -10...+10 к -50...+50
          const normalizedImpact = impactValue * 5;

          // Обновляем значение потребности
          await this.needsService.updateNeedValue(
            characterId,
            need.type as CharacterNeedType,
            normalizedImpact,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при обновлении потребностей: ${error.message}`);
    }
  }

  /**
   * Анализ сообщения пользователя
   * @param characterId ID персонажа
   * @param message Текст сообщения
   * @returns Результаты анализа
   */
  private async analyzeMessage(characterId: number, messageText: string): Promise<MessageAnalysis> {
    try {
      const character = await this.characterService.findOne(characterId);
      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      const needs = await this.needsService.getCharacterNeeds(characterId);

      // Формируем запрос к нейросети для анализа
      const prompt = `
      Проанализируй сообщение пользователя и определи его влияние на потребности персонажа.
      
      Сообщение пользователя: "${messageText}"
      
      Персонаж: ${character.name}
      Архетип: ${character.archetype}
      
      Текущие потребности персонажа:
      ${needs.map(need => `- ${need.type}: ${need.value}`).join('\n')}
      
      Пожалуйста, оцени:
      1. Как сообщение влияет на каждую потребность персонажа (от -10 до +10, где -10 сильно ухудшает, +10 сильно улучшает)
      2. Какова эмоциональная реакция персонажа на сообщение
      3. Важность сообщения для персонажа (от 0 до 1, где 0 - совсем не важно, 1 - крайне важно)
      4. Требуется ли персонажу изменить своё текущее действие
      
      Ответ предоставь в JSON формате:
      {
        "needsImpact": {
          "НазваниеПотребности1": числовое_значение,
          "НазваниеПотребности2": числовое_значение,
          ...
        },
        "emotionalReaction": "описание_эмоциональной_реакции",
        "importance": числовое_значение_от_0_до_1,
        "requiresActionChange": true/false,
        "suggestedAction": "предлагаемое_действие" (если requiresActionChange = true)
      }`;

      // Получаем результат анализа от нейросети
      const result = await this.openaiService.analyzeUserMessage(prompt);

      return result;
    } catch (error) {
      this.logger.error(`Ошибка при анализе сообщения: ${error.message}`);
      // Возвращаем значения по умолчанию в случае ошибки
      return {
        needsImpact: {},
        emotionalReaction: 'нейтральная',
        importance: 0.5,
        requiresActionChange: false,
      };
    }
  }

  /**
   * Сохранение сообщения пользователя в памяти персонажа
   * @param characterId ID персонажа
   * @param message Текст сообщения
   * @param importance Важность сообщения (1-10)
   */
  private async saveMessageMemory(
    characterId: number,
    userId: number,
    messageText: string,
    importance: number,
  ): Promise<void> {
    try {
      // Проверяем количество воспоминаний
      const memories = await this.memoryService.findByCharacterId(characterId);

      // Если достигнут лимит, удаляем наименее важные воспоминания
      if (memories.length >= this.maxMemoryCount) {
        // Сортируем воспоминания по важности (по возрастанию)
        const sortedMemories = memories.sort((a, b) => a.importance - b.importance);

        // Удаляем наименее важное воспоминание
        await this.memoryService.remove(sortedMemories[0].id);
      }

      // Сохраняем новое воспоминание
      await this.memoryService.create({
        characterId,
        userId,
        content: messageText,
        type: 'USER_MESSAGE',
        importance: importance || this.defaultMemoryImportance,
      });
    } catch (error) {
      this.logger.error(`Ошибка при сохранении воспоминания: ${error.message}`);
    }
  }

  /**
   * Рассмотрение возможности изменения текущего действия персонажа
   * на основе сообщения пользователя
   * @param characterId ID персонажа
   * @param analysis Результат анализа сообщения
   */
  private async considerActionChangeBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Проверяем, требуется ли изменение действия
      if (analysis.requiresActionChange && analysis.suggestedAction) {
        // Завершаем текущее действие, если оно есть
        const currentAction = await this.actionService.getCurrentAction(characterId);
        if (currentAction) {
          await this.actionService.completeAction(currentAction.id);
        }

        // Инициируем новое действие на основе предложения
        const emotionalState = await this.needsService.calculateEmotionalState(characterId);

        // Создаем мотивацию на основе анализа сообщения
        const motivation: Motivation = {
          needType: CharacterNeedType.USER_REQUEST,
          description: `Реакция на запрос пользователя: ${analysis.suggestedAction}`,
          priority: 10, // Высокий приоритет для запросов пользователя
        };

        await this.actionService.initiateActionBasedOnMotivation(
          characterId,
          motivation,
          emotionalState,
          analysis.suggestedAction,
        );
      }
    } catch (error) {
      this.logger.error(`Ошибка при рассмотрении изменения действия: ${error.message}`);
    }
  }

  /**
   * Получение данных о поведении персонажа для генерации ответа
   * @param characterId ID персонажа
   */
  public async getBehaviorContextForResponse(characterId: number): Promise<{
    emotionalState: EmotionalState | null;
    motivations: Motivation[];
    currentAction: any;
    recentMemories: CharacterMemory[];
  }> {
    try {
      // Получаем эмоциональное состояние
      const emotionalState = await this.needsService.getCharacterEmotionalState(characterId);

      // Получаем мотивации
      const motivations = await this.needsService.getCharacterMotivations(characterId);

      // Получаем текущее действие
      const currentAction = this.actionService.getCurrentAction(characterId);

      // Получаем последние воспоминания
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
      this.logger.error(
        `Ошибка при получении контекста поведения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      return {
        emotionalState: null,
        motivations: [],
        currentAction: null,
        recentMemories: [],
      };
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateBehaviorCycle() {
    try {
      this.logger.log('Запуск цикла обновления поведения персонажей');
      const characters = await this.characterService.findAll();

      for (const character of characters) {
        // Обновляем эмоциональное состояние
        const emotionalState = await this.needsService.calculateEmotionalState(character.id);

        // Получаем мотивации на основе потребностей
        const motivations = await this.needsService.calculateMotivations(
          character.id,
          this.motivationThreshold,
        );

        // Проверяем необходимость действия
        if (motivations.length > 0 && Math.random() < this.actionChance) {
          const selectedMotivation = motivations[0]; // Берем самую приоритетную мотивацию

          try {
            await this.actionService.initiateActionBasedOnMotivation(
              character.id,
              selectedMotivation,
              emotionalState,
            );
          } catch (error) {
            this.logger.error(
              `Ошибка при инициации действия для персонажа ${character.name}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка в цикле обновления поведения: ${error.message}`);
    }
  }
}
