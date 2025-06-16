import { Injectable } from '@nestjs/common';
import { Character } from '../entities/character.entity';
import { MessageAnalysisService } from './message-analysis.service';
import { NeedsService } from './needs.service';
import { CharacterBehaviorService } from './character-behavior.service';
import { CharacterResponseService } from './character-response.service';
import { EmotionalStateService } from './emotional-state.service';
import { ManipulationService } from './manipulation.service';
import { LogService } from '../../logging/log.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { MessageAnalysis } from '../interfaces/analysis.interfaces';
import { CharacterNeedType } from '../enums/character-need-type.enum';

/**
 * Координатор обработки сообщений - центральная точка для обработки входящих сообщений пользователя
 * Выполняет единый анализ и координирует обновление всех систем персонажа
 */
@Injectable()
export class MessageProcessingCoordinator {
  constructor(
    private readonly messageAnalysisService: MessageAnalysisService,
    private readonly needsService: NeedsService,
    private readonly characterBehaviorService: CharacterBehaviorService,
    private readonly characterResponseService: CharacterResponseService,
    private readonly emotionalStateService: EmotionalStateService,
    private readonly manipulationService: ManipulationService,
    private readonly logService: LogService,
  ) {}

  /**
   * Основной метод координации обработки сообщения пользователя
   * Выполняет единый анализ и координирует все системы персонажа
   */
  async processUserMessage(
    character: Character,
    userId: number | string,
    userMessage: string,
    recentMessages: string[] = [],
  ): Promise<{
    analysis: MessageAnalysis;
    response: string;
    userMessageId?: number;
  }> {
    return withErrorHandling(
      async () => {
        // Преобразуем userId в number для внутреннего использования
        const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

        this.logService.log('Начинается обработка сообщения пользователя', {
          characterId: character.id,
          userId: numericUserId,
          messageLength: userMessage.length,
        });

        // ЭТАП 1: ЕДИНЫЙ АНАЛИЗ СООБЩЕНИЯ
        const analysis = await this.messageAnalysisService.analyzeUserMessage(
          character,
          numericUserId,
          userMessage,
          recentMessages,
        );

        this.logService.debug('Анализ сообщения завершен', {
          analysisTimestamp: analysis.analysisMetadata.timestamp,
          needsUpdateCount: Object.keys(analysis.needsImpact).length,
        });

        // ЭТАП 2: ПАРАЛЛЕЛЬНОЕ ОБНОВЛЕНИЕ СИСТЕМ ПЕРСОНАЖА
        const updatePromises = [
          // Обновление потребностей
          this.updateCharacterNeeds(character.id, analysis),
          // Обновление эмоционального состояния
          this.updateEmotionalState(character.id, analysis),
          // Обновление поведенческих паттернов
          this.updateBehaviorPatterns(character.id, userId, userMessage, analysis),
          // Применение манипулятивных техник (если применимо)
          this.applyManipulativeTechniques(character.id, userId, userMessage, analysis),
        ];

        await Promise.allSettled(updatePromises);

        // ЭТАП 3: ГЕНЕРАЦИЯ ОТВЕТА ПЕРСОНАЖА
        const response = await this.generateCharacterResponse(character, userMessage, analysis);

        this.logService.log('Обработка сообщения пользователя завершена', {
          characterId: character.id,
          userId,
          responseLength: response.length,
        });

        return {
          analysis,
          response,
          userMessageId: null,
        };
      },
      'обработке сообщения пользователя через координатор',
      this.logService,
      { characterId: character.id, userId },
    );
  }

  /**
   * Обновляет потребности персонажа на основе анализа
   */
  private async updateCharacterNeeds(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Обновляем потребности на основе анализа
      for (const [needType, impact] of Object.entries(analysis.needsImpact)) {
        if (impact > 0) {
          await this.needsService.updateNeed(characterId, {
            type: needType as CharacterNeedType,
            change: impact,
            reason: 'Анализ сообщения пользователя',
          });
        }
      }
      this.logService.debug('Потребности персонажа обновлены', { characterId });
    } catch (error) {
      this.logService.error('Ошибка обновления потребностей персонажа', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
    }
  }

  /**
   * Обновляет эмоциональное состояние персонажа на основе анализа
   */
  private async updateEmotionalState(
    characterId: number,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      const emotionalImpact = {
        emotionalType: analysis.emotionalAnalysis.expectedEmotionalResponse,
        intensity: analysis.emotionalAnalysis.emotionalIntensity,
        duration: 60, // минуты
        triggers: analysis.emotionalAnalysis.triggerEmotions,
      };

      // Удаляем неиспользуемый контекст

      // Используем EmotionalStateService для обновления состояния
      await this.emotionalStateService.updateEmotionalState(characterId, analysis);

      this.logService.debug('Эмоциональное состояние персонажа обновлено', {
        characterId,
        emotionalType: emotionalImpact.emotionalType,
        intensity: emotionalImpact.intensity,
      });
    } catch (error) {
      this.logService.error('Ошибка обновления эмоционального состояния персонажа', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
    }
  }

  /**
   * Обновляет поведенческие паттерны персонажа на основе анализа
   */
  private async updateBehaviorPatterns(
    characterId: number,
    userId: number | string,
    userMessage: string,
    analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Преобразуем userId в number для внутреннего использования
      const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Передаем анализ в CharacterBehaviorService
      await this.characterBehaviorService.processUserMessageWithAnalysis(
        characterId,
        numericUserId,
        userMessage,
        analysis,
      );
      this.logService.debug('Поведенческие паттерны персонажа обновлены', { characterId });
    } catch (error) {
      this.logService.error('Ошибка обновления поведенческих паттернов персонажа', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
    }
  }

  /**
   * Применяет манипулятивные техники на основе анализа
   */
  private async applyManipulativeTechniques(
    characterId: number,
    userId: number | string,
    userMessage: string,
    _analysis: MessageAnalysis,
  ): Promise<void> {
    try {
      // Преобразуем userId в number для внутреннего использования
      const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Анализируем ситуацию и выбираем подходящую технику
      const chosenTechnique = await this.manipulationService.analyzeSituationAndChooseTechnique(
        characterId,
        numericUserId,
        userMessage,
      );

      if (chosenTechnique) {
        this.logService.debug('Выбрана манипулятивная техника', {
          characterId,
          userId: numericUserId,
          technique: chosenTechnique,
        });

        // Техника будет применена при генерации ответа
        // Сохраняем информацию о выбранной технике в контексте
      } else {
        this.logService.debug('Манипулятивные техники не применимы в данной ситуации', {
          characterId,
          userId: numericUserId,
        });
      }
    } catch (error) {
      this.logService.error('Ошибка применения манипулятивных техник', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
    }
  }

  /**
   * Генерирует ответ персонажа с использованием результатов анализа
   */
  private async generateCharacterResponse(
    character: Character,
    userMessage: string,
    analysis: MessageAnalysis,
  ): Promise<string> {
    try {
      const dialogHistory: Array<{ role: string; content: string }> = [
        { role: 'user', content: userMessage },
      ];

      const emotionalState = {
        primary: analysis.emotionalAnalysis.expectedEmotionalResponse,
        secondary: '',
        intensity: Math.round(analysis.emotionalAnalysis.emotionalIntensity * 10),
        description: `Эмоциональная реакция на сообщение пользователя: ${analysis.emotionalAnalysis.expectedEmotionalResponse}`,
      };

      const additionalContext = [
        `Анализ поведения: ${JSON.stringify(analysis.behaviorAnalysis)}`,
        `Специализация: ${JSON.stringify(analysis.specializationAnalysis)}`,
        `Манипулятивные техники: ${JSON.stringify(analysis.manipulationAnalysis)}`,
      ].join('\n');

      return await this.characterResponseService.generateResponse(
        character,
        userMessage,
        dialogHistory,
        emotionalState,
        additionalContext,
      );
    } catch (error) {
      this.logService.error('Ошибка генерации ответа персонажа', {
        error: error instanceof Error ? error.message : String(error),
        characterId: character.id,
      });
      // Возвращаем резервный ответ
      return `Привет! Я ${character.name}. Извини, что-то я задумалась. О чём ты говорил?`;
    }
  }
}
