import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { CacheService } from '../../../cache/cache.service';
import { Dialog } from '../../../dialog/entities/dialog.entity';
import { Message } from '../../../dialog/entities/message.entity';
import { FeedbackSignal, FeedbackSignalType } from '../../interfaces/learning.interfaces';

/**
 * Интерфейс для контекста диалога
 */
interface DialogContext {
  dialogId: number;
  messages: Message[];
  lastUserMessage?: string;
  lastCharacterMessage?: string;
  lastUserMessageTime?: Date;
  lastCharacterMessageTime?: Date;
  messageCount: number;
  characterEmotionalState?: string;
  lastTechnique?: string;
}

/**
 * Сервис для неявного сбора обратной связи от пользователей
 * Анализирует паттерны взаимодействия без прямых вопросов пользователю
 */
@Injectable()
export class UserFeedbackService extends BaseService {
  private readonly CACHE_TTL = 3600; // 1 час
  private readonly ANALYSIS_VERSION = '1.0.0';

  // Пороговые значения для определения сигналов
  private readonly DELAY_THRESHOLD_SECONDS = 30;
  private readonly SHORT_RESPONSE_THRESHOLD = 10;
  private readonly LONG_RESPONSE_THRESHOLD = 100;
  private readonly TOPIC_SWITCH_SIMILARITY_THRESHOLD = 0.3;

  constructor(
    @InjectRepository(Dialog)
    private readonly dialogRepository: Repository<Dialog>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly cacheService: CacheService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Анализирует новое сообщение пользователя на предмет неявных сигналов feedback
   */
  async analyzeUserMessage(
    dialogId: number,
    userMessage: string,
    userId: number,
    characterId: number,
  ): Promise<FeedbackSignal[]> {
    return this.withErrorHandling('анализе сообщения пользователя', async () => {
      const signals: FeedbackSignal[] = [];

      // Получаем контекст диалога
      const dialogContext = await this.getDialogContext(dialogId);

      if (!dialogContext) {
        return signals;
      }

      // 1. Анализ задержки ответа
      const delaySignal = await this.analyzeResponseDelay(dialogContext, userMessage);
      if (delaySignal) signals.push(delaySignal);

      // 2. Анализ длины ответа
      const lengthSignal = this.analyzeResponseLength(userMessage, dialogContext);
      if (lengthSignal) signals.push(lengthSignal);

      // 3. Анализ повторений
      const repetitionSignal = await this.analyzeRepetitions(userMessage, dialogContext);
      if (repetitionSignal) signals.push(repetitionSignal);

      // 4. Анализ смены темы
      const topicSwitchSignal = await this.analyzeTopicSwitch(userMessage, dialogContext);
      if (topicSwitchSignal) signals.push(topicSwitchSignal);

      // 5. Анализ эмоциональных маркеров
      const emotionalSignal = this.analyzeEmotionalMarkers(userMessage, dialogContext);
      if (emotionalSignal) signals.push(emotionalSignal);

      // Логируем найденные сигналы
      if (signals.length > 0) {
        this.logInfo('Обнаружены сигналы обратной связи', {
          dialogId,
          userId,
          characterId,
          signalTypes: signals.map(s => s.type),
          signalCount: signals.length,
        });
      }

      return signals;
    });
  }

  /**
   * Анализирует окончание диалога на предмет резкого завершения
   */
  async analyzeDialogEnd(
    dialogId: number,
    isAbrupt: boolean = false,
  ): Promise<FeedbackSignal | null> {
    return this.withErrorHandling('анализе завершения диалога', async () => {
      if (!isAbrupt) return null;

      const dialogContext = await this.getDialogContext(dialogId);
      if (!dialogContext) return null;

      return {
        type: FeedbackSignalType.ABRUPT_EXIT,
        intensity: 0.8,
        timestamp: new Date(),
        dialogId,
        context: {
          characterResponse: dialogContext.lastCharacterMessage,
          technique: dialogContext.lastTechnique,
          emotionalState: dialogContext.characterEmotionalState,
        },
        valence: 'negative',
      };
    });
  }

  /**
   * Анализирует возвращение пользователя к тому же персонажу
   */
  async analyzeReturnInteraction(
    _userId: number,
    _characterId: number,
    timeSinceLastInteraction: number,
  ): Promise<FeedbackSignal | null> {
    return this.withErrorHandling('анализе повторного взаимодействия', async () => {
      // Если пользователь вернулся в течение 24 часов - положительный сигнал
      if (timeSinceLastInteraction <= 24 * 60 * 60 * 1000) {
        const intensity = Math.max(0.3, 1 - timeSinceLastInteraction / (24 * 60 * 60 * 1000));

        return {
          type: FeedbackSignalType.RETURN_INTERACTION,
          intensity,
          timestamp: new Date(),
          dialogId: 0, // Новый диалог
          context: {
            metadata: {
              timeSinceLastInteraction,
              hoursSinceLastInteraction: timeSinceLastInteraction / (60 * 60 * 1000),
            },
          },
          valence: 'positive',
        };
      }

      return null;
    });
  }

  /**
   * Получает контекст диалога для анализа
   */
  private async getDialogContext(dialogId: number): Promise<DialogContext | null> {
    const cacheKey = `dialog_context:${dialogId}`;

    let context = await this.cacheService.get<DialogContext>(cacheKey);
    if (context) {
      return context;
    }

    // Получаем последние сообщения диалога
    const messages = await this.messageRepository.find({
      where: { dialogId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (messages.length === 0) return null;

    const lastUserMessage = messages.find(m => m.isFromUser);
    const lastCharacterMessage = messages.find(m => !m.isFromUser);

    context = {
      dialogId,
      messages: messages.reverse(), // Возвращаем в хронологическом порядке
      lastUserMessage: lastUserMessage?.content,
      lastCharacterMessage: lastCharacterMessage?.content,
      lastUserMessageTime: lastUserMessage?.createdAt,
      lastCharacterMessageTime: lastCharacterMessage?.createdAt,
      messageCount: messages.length,
      characterEmotionalState: lastCharacterMessage?.metadata?.emotionalState as string,
      lastTechnique: lastCharacterMessage?.metadata?.technique as string,
    };

    await this.cacheService.set(cacheKey, context, this.CACHE_TTL);
    return context;
  }

  /**
   * Анализирует задержку в ответе пользователя
   */
  private async analyzeResponseDelay(
    context: DialogContext,
    _userMessage: string,
  ): Promise<FeedbackSignal | null> {
    if (!context.lastCharacterMessageTime) return null;

    const delay = Date.now() - new Date(context.lastCharacterMessageTime).getTime();
    const delaySeconds = delay / 1000;

    if (delaySeconds > this.DELAY_THRESHOLD_SECONDS) {
      const intensity = Math.min(1, delaySeconds / 120); // Максимум 2 минуты для полной интенсивности

      return {
        type: FeedbackSignalType.USER_RESPONSE_DELAY,
        intensity,
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: { delaySeconds },
        },
        valence: delaySeconds > 60 ? 'negative' : 'neutral', // Более минуты - негативный сигнал
      };
    }

    return null;
  }

  /**
   * Анализирует длину ответа пользователя
   */
  private analyzeResponseLength(
    userMessage: string,
    context: DialogContext,
  ): FeedbackSignal | null {
    const length = userMessage.length;

    if (length <= this.SHORT_RESPONSE_THRESHOLD) {
      return {
        type: FeedbackSignalType.SHORT_RESPONSES,
        intensity: Math.max(0.3, 1 - length / this.SHORT_RESPONSE_THRESHOLD),
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: { messageLength: length },
        },
        valence: 'negative',
      };
    }

    if (length >= this.LONG_RESPONSE_THRESHOLD) {
      return {
        type: FeedbackSignalType.LONG_RESPONSES,
        intensity: Math.min(1, length / 200), // Максимум при 200 символах
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: { messageLength: length },
        },
        valence: 'positive',
      };
    }

    return null;
  }

  /**
   * Анализирует повторения в сообщениях пользователя
   */
  private async analyzeRepetitions(
    userMessage: string,
    context: DialogContext,
  ): Promise<FeedbackSignal | null> {
    if (!context.messages || context.messages.length < 3) return null;

    const userMessages = context.messages
      .filter(m => m.isFromUser)
      .map(m => m.content.toLowerCase())
      .slice(-3); // Последние 3 сообщения пользователя

    const currentMessage = userMessage.toLowerCase();
    const similarity = this.calculateMessageSimilarity(currentMessage, userMessages);

    if (similarity > 0.7) {
      // Высокая схожесть с предыдущими сообщениями
      return {
        type: FeedbackSignalType.REPEATED_REQUEST,
        intensity: similarity,
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: { similarity, repeatedContent: currentMessage },
        },
        valence: 'negative',
      };
    }

    return null;
  }

  /**
   * Анализирует смену темы в диалоге
   */
  private async analyzeTopicSwitch(
    userMessage: string,
    context: DialogContext,
  ): Promise<FeedbackSignal | null> {
    if (!context.lastUserMessage) return null;

    const topicSimilarity = this.calculateTopicSimilarity(userMessage, context.lastUserMessage);

    if (topicSimilarity < this.TOPIC_SWITCH_SIMILARITY_THRESHOLD) {
      return {
        type: FeedbackSignalType.TOPIC_SWITCH,
        intensity: 1 - topicSimilarity,
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: {
            topicSimilarity,
            previousTopic: context.lastUserMessage,
            newTopic: userMessage,
          },
        },
        valence: 'neutral', // Смена темы может быть и положительной, и отрицательной
      };
    }

    return null;
  }

  /**
   * Анализирует эмоциональные маркеры в сообщении
   */
  private analyzeEmotionalMarkers(
    userMessage: string,
    context: DialogContext,
  ): FeedbackSignal | null {
    const positiveMarkers = ['спасибо', 'отлично', 'здорово', 'хорошо', '😊', '😄', '👍', '❤️'];
    const negativeMarkers = [
      'плохо',
      'не нравится',
      'скучно',
      'не понимаю',
      '😞',
      '😠',
      '👎',
      '💔',
    ];

    const message = userMessage.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    positiveMarkers.forEach(marker => {
      if (message.includes(marker)) positiveCount++;
    });

    negativeMarkers.forEach(marker => {
      if (message.includes(marker)) negativeCount++;
    });

    if (positiveCount > 0 || negativeCount > 0) {
      const intensity = Math.min(1, (positiveCount + negativeCount) / 3);
      const valence = positiveCount > negativeCount ? 'positive' : 'negative';

      return {
        type: FeedbackSignalType.EMOTIONAL_MARKERS,
        intensity,
        timestamp: new Date(),
        dialogId: context.dialogId,
        context: {
          characterResponse: context.lastCharacterMessage,
          technique: context.lastTechnique,
          metadata: { positiveCount, negativeCount },
        },
        valence,
      };
    }

    return null;
  }

  /**
   * Вычисляет схожесть сообщений (простая реализация)
   */
  private calculateMessageSimilarity(message: string, previousMessages: string[]): number {
    if (previousMessages.length === 0) return 0;

    const words = message.split(' ');
    let maxSimilarity = 0;

    previousMessages.forEach(prevMessage => {
      const prevWords = prevMessage.split(' ');
      const commonWords = words.filter(word => prevWords.includes(word));
      const similarity = commonWords.length / Math.max(words.length, prevWords.length);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });

    return maxSimilarity;
  }

  /**
   * Вычисляет схожесть тем (упрощенная реализация)
   */
  private calculateTopicSimilarity(message1: string, message2: string): number {
    // Простой алгоритм на основе общих слов
    const words1 = message1
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 3);
    const words2 = message2
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 3);

    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length, 1);
  }
}
