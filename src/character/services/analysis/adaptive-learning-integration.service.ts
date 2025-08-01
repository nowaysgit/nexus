import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { UserFeedbackService } from '../analysis/user-feedback.service';
import { CharacterLearningService } from '../core/character-learning.service';
import { FeedbackSignal } from '../../interfaces/learning.interfaces';

/**
 * Интеграционный сервис для системы адаптивного обучения
 * Координирует работу сбора feedback и обучения персонажей
 */
@Injectable()
export class AdaptiveLearningIntegrationService extends BaseService {
  constructor(
    private readonly userFeedbackService: UserFeedbackService,
    private readonly characterLearningService: CharacterLearningService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Обрабатывает новое сообщение пользователя через всю цепочку обучения
   */
  async processUserMessage(
    dialogId: number,
    userMessage: string,
    userId: number,
    characterId: number,
  ): Promise<void> {
    return this.withErrorHandling('обработке сообщения для обучения', async () => {
      // 1. Анализируем сообщение на предмет сигналов обратной связи
      const signals = await this.userFeedbackService.analyzeUserMessage(
        dialogId,
        userMessage,
        userId,
        characterId,
      );

      // 2. Если сигналы найдены, обрабатываем их для обучения
      if (signals.length > 0) {
        await this.characterLearningService.processLearningSignals(characterId, userId, signals);

        this.logInfo('Обработано сообщение для адаптивного обучения', {
          dialogId,
          userId,
          characterId,
          signalsFound: signals.length,
          signalTypes: signals.map(s => s.type),
        });
      }
    });
  }

  /**
   * Обрабатывает завершение диалога
   */
  async processDialogEnd(
    dialogId: number,
    userId: number,
    characterId: number,
    isAbrupt: boolean = false,
  ): Promise<void> {
    return this.withErrorHandling('обработке завершения диалога', async () => {
      const signal = await this.userFeedbackService.analyzeDialogEnd(dialogId, isAbrupt);

      if (signal) {
        await this.characterLearningService.processLearningSignals(characterId, userId, [signal]);

        this.logInfo('Обработано завершение диалога для обучения', {
          dialogId,
          userId,
          characterId,
          isAbrupt,
          signalType: signal.type,
        });
      }
    });
  }

  /**
   * Обрабатывает возвращение пользователя к персонажу
   */
  async processReturnInteraction(
    userId: number,
    characterId: number,
    timeSinceLastInteraction: number,
  ): Promise<void> {
    return this.withErrorHandling('обработке повторного взаимодействия', async () => {
      const signal = await this.userFeedbackService.analyzeReturnInteraction(
        userId,
        characterId,
        timeSinceLastInteraction,
      );

      if (signal) {
        await this.characterLearningService.processLearningSignals(characterId, userId, [signal]);

        this.logInfo('Обработано повторное взаимодействие для обучения', {
          userId,
          characterId,
          timeSinceLastInteraction,
          signalType: signal.type,
        });
      }
    });
  }

  /**
   * Получает рекомендации по поведению для персонажа
   */
  async getBehaviorRecommendations(
    characterId: number,
    userId: number,
    currentContext: {
      emotionalState?: string;
      dialogContext?: string[];
      timeOfDay?: string;
    },
  ): Promise<{
    preferredTechniques: string[];
    avoidTechniques: string[];
    emotionalTone?: string;
    responseLength?: 'short' | 'medium' | 'long';
    confidence: number;
  }> {
    return this.characterLearningService.getBehaviorRecommendations(
      characterId,
      userId,
      currentContext,
    );
  }

  /**
   * Получает адаптацию персонажа для пользователя
   */
  async getCharacterAdaptation(characterId: number, userId: number) {
    return this.characterLearningService.getCharacterAdaptation(characterId, userId);
  }

  /**
   * Получает метрики обучения
   */
  async getLearningMetrics(characterId: number, userId?: number) {
    return this.characterLearningService.getLearningMetrics(characterId, userId);
  }

  /**
   * Проверяет, включено ли обучение для персонажа
   */
  isLearningEnabled(): boolean {
    // В реальности может проверять настройки персонажа или пользователя
    return true;
  }

  /**
   * Обрабатывает пакет сигналов обратной связи
   */
  async processFeedbackSignals(
    characterId: number,
    userId: number,
    signals: FeedbackSignal[],
  ): Promise<void> {
    return this.withErrorHandling('обработке пакета сигналов', async () => {
      if (!this.isLearningEnabled() || signals.length === 0) {
        return;
      }

      await this.characterLearningService.processLearningSignals(characterId, userId, signals);

      this.logInfo('Обработан пакет сигналов обратной связи', {
        characterId,
        userId,
        signalCount: signals.length,
        signalTypes: signals.map(s => s.type),
      });
    });
  }
}
