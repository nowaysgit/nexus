import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { EmotionalState } from '../entities/emotional-state';
import { IMotivation } from '../interfaces/needs.interfaces';
import { MessageAnalysis } from '../interfaces/analysis.interfaces';
import { CharacterAction } from '../interfaces/behavior.interfaces';
import { LLMService } from '../../llm/services/llm.service';
import { MessageAnalysisService } from './message-analysis.service';
import { ManipulationService } from './manipulation.service';
import { MemoryService } from './memory.service';
import { LogService } from '../../logging/log.service';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { MemoryType } from '../interfaces/memory.interfaces';
import { MemoryImportance } from '../entities/character-memory.entity';

/**
 * Контекст поведения для формирования ответа
 */
export interface BehaviorContext {
  emotionalState: EmotionalState | null;
  motivations: IMotivation[];
  currentAction: CharacterAction | null;
  recentMemories: CharacterMemory[];
}

/**
 * Результат обработки сообщения
 */
export interface MessageProcessingResult {
  text: string;
  analysis: MessageAnalysis;
  contextUsed: BehaviorContext;
}

/**
 * Сервис для обработки сообщений и формирования ответов персонажей
 * Отвечает за анализ входящих сообщений, создание промптов и генерацию ответов
 * согласно ТЗ п.10 (Централизованный анализ сообщений)
 */
@Injectable()
export class MessageBehaviorService extends BaseService {
  // Конфигурационные параметры
  private readonly defaultMemoryImportance: number = 5;

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    private readonly llmService: LLMService,
    private readonly messageAnalysisService: MessageAnalysisService,
    private readonly manipulationService: ManipulationService,
    private readonly memoryService: MemoryService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(LogService) logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Обработка входящего сообщения пользователя
   */
  async processIncomingMessage(
    characterId: number,
    userId: number,
    message: string,
    behaviorContext: BehaviorContext,
    behaviorPattern: { type: string; description: string },
  ): Promise<MessageProcessingResult> {
    return this.withErrorHandling('обработка входящего сообщения', async () => {
      // Получаем персонажа
      const character = await this.characterRepository.findOne({ where: { id: characterId } });
      if (!character) {
        throw new Error(`Character with ID ${characterId} not found`);
      }

      // Анализируем входящее сообщение
      const analysis = await this.messageAnalysisService.analyzeUserMessage(
        character,
        userId,
        message,
      );

      // Формируем промт для LLM на основе контекста и анализа
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

      // Рассматриваем применение манипулятивных техник
      await this.considerManipulativeTechniques(characterId, userId, message);

      this.logDebug(
        `Обработано сообщение для персонажа ${characterId}: "${message}" -> "${responseText}"`,
      );

      return {
        text: responseText,
        analysis,
        contextUsed: behaviorContext,
      };
    });
  }

  /**
   * Обработка сообщения пользователя с готовым анализом
   */
  async processUserMessageWithAnalysis(
    characterId: number,
    userId: number,
    messageText: string,
    analysis: MessageAnalysis,
    messageId?: number,
  ): Promise<void> {
    return this.withErrorHandling('обработка сообщения с анализом', async () => {
      this.logDebug(
        `Обработка сообщения пользователя ${userId} для персонажа ${characterId}: "${messageText}"`,
      );

      // Обновляем потребности на основе анализа сообщения
      await this.updateNeedsBasedOnMessage(characterId, analysis);

      // Рассматриваем изменение действий на основе сообщения
      await this.considerActionChangeBasedOnMessage(characterId, analysis, messageText);

      // Сохраняем память о сообщении
      await this.saveMessageMemory(
        characterId,
        userId,
        messageText,
        this.defaultMemoryImportance,
        messageId,
      );

      // Рассматриваем применение манипулятивных техник
      await this.considerManipulativeTechniques(characterId, userId, messageText);
    });
  }

  /**
   * Создание промта для генерации ответа
   */
  private constructResponsePrompt(
    behaviorContext: BehaviorContext,
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
   * Обновление потребностей на основе анализа сообщения
   */
  private async updateNeedsBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    return this.withErrorHandling('обновление потребностей', async () => {
      if (!analysis.needsImpact || analysis.needsImpact.length === 0) {
        return;
      }

      // Эмитируем событие для обновления потребностей
      this.eventEmitter.emit('needs.update_from_message', {
        characterId,
        needsImpact: analysis.needsImpact,
        messageAnalysis: analysis,
        timestamp: new Date(),
      });

      this.logDebug(`Обновлены потребности персонажа ${characterId} на основе анализа сообщения`, {
        needsImpact: analysis.needsImpact,
      });
    });
  }

  /**
   * Рассмотрение изменения действий на основе сообщения
   */
  private async considerActionChangeBasedOnMessage(
    characterId: number,
    analysis: MessageAnalysis,
    messageText: string,
  ): Promise<void> {
    return this.withErrorHandling('рассмотрение изменения действий', async () => {
      // Проверяем, требует ли анализ изменения действий
      if (analysis.urgency && analysis.urgency > 0.7) {
        // Высокий приоритет - эмитируем событие для немедленного изменения действий
        this.eventEmitter.emit('action.priority_change_requested', {
          characterId,
          urgency: analysis.urgency,
          reason: 'high_priority_message',
          messageAnalysis: analysis,
          timestamp: new Date(),
        });
      }

      // Проверяем эмоциональное воздействие
      if (
        analysis.emotionalAnalysis?.emotionalIntensity &&
        analysis.emotionalAnalysis.emotionalIntensity > 0.6
      ) {
        // Сильное эмоциональное воздействие - может потребовать адаптации поведения
        this.eventEmitter.emit('behavior.emotional_adaptation_requested', {
          characterId,
          emotionalTrigger: analysis.emotionalAnalysis,
          messageContent: messageText,
          timestamp: new Date(),
        });
      }
    });
  }

  /**
   * Сохранение памяти о сообщении
   */
  private async saveMessageMemory(
    characterId: number,
    userId: number,
    messageText: string,
    importance: number,
    messageId?: number,
  ): Promise<void> {
    return this.withErrorHandling('сохранение памяти о сообщении', async () => {
      const memory = this.memoryRepository.create({
        content: messageText,
        type: MemoryType.CONVERSATION,
        importance: importance as MemoryImportance,
        characterId,
        metadata: {
          userId,
          messageId: messageId || null,
          timestamp: new Date().toISOString(),
        },
      });

      await this.memoryRepository.save(memory);

      // Проверяем лимит памяти и очищаем при необходимости
      await this.memoryService.limitMemoriesCount(characterId, 500);

      this.logDebug(`Сохранена память о сообщении для персонажа ${characterId}`, {
        importance,
        messageLength: messageText.length,
      });
    });
  }

  /**
   * Рассмотрение применения манипулятивных техник
   */
  private async considerManipulativeTechniques(
    characterId: number,
    userId: number,
    messageText: string,
  ): Promise<void> {
    return this.withErrorHandling('рассмотрение манипулятивных техник', async () => {
      try {
        // Эмитируем событие для анализа манипулятивных техник
        this.eventEmitter.emit('manipulation.analyze_message', {
          characterId,
          userId,
          messageText,
          timestamp: new Date(),
        });

        this.logDebug(`Запрошен анализ манипулятивных техник для персонажа ${characterId}`);
      } catch (error) {
        // Логируем ошибку, но не прерываем основной поток
        this.logWarning(
          `Ошибка при рассмотрении манипулятивных техник: ${error instanceof Error ? error.message : String(error)}`,
          { characterId, userId },
        );
      }
    });
  }
}
