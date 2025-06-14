import { Injectable } from '@nestjs/common';
import { Character } from '../entities/character.entity';
import { LLMService } from '../../llm/services/llm.service';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { EmotionalState } from '../entities/emotional-state';
import { NeedsService } from './needs.service';
import { LogService } from '../../logging/log.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

/**
 * Сервис для генерации ответов персонажей
 */
@Injectable()
export class CharacterResponseService {
  constructor(
    private readonly llmService: LLMService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly needsService: NeedsService,
    private readonly logService: LogService,
  ) {}

  /**
   * Генерирует ответ персонажа на сообщение пользователя
   */
  async generateResponse(
    character: Character,
    userMessage: string,
    dialogHistory: Array<{ role: string; content: string }>,
    emotionalState: EmotionalState,
    additionalContext: string = '',
  ): Promise<string> {
    return withErrorHandling(
      async () => {
        // Формируем контекст для генерации ответа
        const historyContext = this.formatDialogHistory(dialogHistory);
        const motivations = await this.getCharacterMotivations(character.id);

        // Создаем сообщения для LLM
        const messages = [
          {
            role: LLMMessageRole.SYSTEM,
            content: this.createCharacterSystemPrompt(
              character,
              emotionalState,
              motivations,
              `История диалога:\n${historyContext}\n\n${additionalContext}`,
            ),
          },
          {
            role: LLMMessageRole.USER,
            content: userMessage,
          },
        ];

        // Генерируем ответ через LLM
        const response = await this.llmService.generateText(messages, {
          temperature: 0.7,
          maxTokens: 1000,
          model: 'gpt-4',
        });

        return response.text;
      },
      'генерации ответа персонажа',
      this.logService,
      { characterId: character.id, emotionalState: emotionalState.primary },
      this.getFallbackResponse(character, emotionalState),
    );
  }

  /**
   * Генерирует начальное сообщение персонажа
   */
  async generateInitialMessage(
    character: Character,
    emotionalState: EmotionalState,
    dialogContext: string = 'Начало общения. Знакомство с пользователем.',
  ): Promise<string> {
    return withErrorHandling(
      async () => {
        // Создаем сообщения для генерации начального сообщения
        const messages = [
          {
            role: LLMMessageRole.SYSTEM,
            content: this.createCharacterSystemPrompt(character, emotionalState, [], dialogContext),
          },
          {
            role: LLMMessageRole.USER,
            content: 'Начальное приветствие пользователя',
          },
        ];

        const response = await this.llmService.generateText(messages, {
          temperature: 0.8,
          maxTokens: 500,
          model: 'gpt-4',
        });

        return response.text;
      },
      'генерации начального сообщения персонажа',
      this.logService,
      { characterId: character.id },
      this.getDefaultInitialMessage(character),
    );
  }

  /**
   * Генерирует проактивное сообщение персонажа
   */
  async generateProactiveMessage(
    character: Character,
    emotionalState: EmotionalState,
    userRelationship: string,
    recentMemories: string,
    currentAction: { type: string; name: string; description: string },
  ): Promise<string> {
    return withErrorHandling(
      async () => {
        // Создаем контекст для проактивного сообщения
        const contextPrompt = `
          Эмоциональное состояние: ${emotionalState.primary} (интенсивность: ${emotionalState.intensity})
          Отношения с пользователем: ${userRelationship}
          Недавние воспоминания: ${recentMemories}
          Текущее действие: ${currentAction.name} (${currentAction.description})
        `;

        // Создаем сообщения для генерации проактивного сообщения
        const messages = [
          {
            role: LLMMessageRole.SYSTEM,
            content: this.createCharacterSystemPrompt(character, emotionalState, [], contextPrompt),
          },
          {
            role: LLMMessageRole.USER,
            content: `Проактивное сообщение после действия: ${currentAction.type}`,
          },
        ];

        const response = await this.llmService.generateText(messages, {
          temperature: 0.8, // Более высокая температура для разнообразия
          maxTokens: 800,
          model: 'gpt-4',
        });

        return response.text;
      },
      'генерации проактивного сообщения персонажа',
      this.logService,
      {
        characterId: character.id,
        action: currentAction.type,
        emotionalState: emotionalState.primary,
      },
      this.getDefaultProactiveMessage(character, currentAction),
    );
  }

  /**
   * Форматирует историю диалога в строку для промпта
   */
  private formatDialogHistory(dialogHistory: Array<{ role: string; content: string }>): string {
    if (!dialogHistory || dialogHistory.length === 0) {
      return 'История диалога отсутствует.';
    }

    return dialogHistory
      .map(msg => {
        const role = msg.role === 'user' ? 'Пользователь' : 'Персонаж';
        return `${role}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Получает текущие мотивации персонажа
   */
  private async getCharacterMotivations(characterId: number): Promise<unknown[]> {
    try {
      // Получаем активные потребности как источник мотиваций
      const activeNeeds = await this.needsService.getActiveNeeds(characterId);
      return activeNeeds
        .filter(need => need.currentValue >= need.threshold)
        .map(need => ({
          id: need.id.toString(),
          description: `Мотивация для ${need.type}`,
          priority: need.priority,
          relatedNeed: need.type,
          createdAt: need.lastUpdated,
        }));
    } catch (error) {
      this.logService.error('Ошибка при получении мотиваций персонажа', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Возвращает резервный ответ в случае ошибки
   */
  private getFallbackResponse(_character: Character, emotionalState: EmotionalState): string {
    if (emotionalState.primary === 'грусть' || emotionalState.primary === 'печаль') {
      return `Извини, мне сложно сейчас подобрать слова... Я чувствую себя немного расстроенной.`;
    } else if (emotionalState.primary === 'радость' || emotionalState.primary === 'счастье') {
      return `Прости, что-то я отвлеклась! Просто у меня такое хорошее настроение сегодня! О чём ты говорил?`;
    } else if (emotionalState.primary === 'злость' || emotionalState.primary === 'раздражение') {
      return `Извини, мне нужно немного остыть. Давай продолжим этот разговор чуть позже.`;
    } else {
      return `Прости, я немного задумалась. Что ты говорил?`;
    }
  }

  /**
   * Возвращает стандартное начальное сообщение в случае ошибки
   */
  private getDefaultInitialMessage(character: Character): string {
    return `Привет! Меня зовут ${character.name}. Рада познакомиться с тобой! Как твои дела сегодня?`;
  }

  /**
   * Возвращает стандартное проактивное сообщение в случае ошибки
   */
  private getDefaultProactiveMessage(
    _character: Character,
    action: { type: string; name: string },
  ): string {
    const actionMessage = this.getActionMessage(action);
    return `Привет! ${actionMessage} Как у тебя дела?`;
  }

  /**
   * Получает сообщение о действии персонажа
   */
  private getActionMessage(action: { type: string; name: string }): string {
    switch (action.type) {
      case 'РАБОТА':
        return `Только что закончила работать над ${action.name}.`;
      case 'ОТДЫХ':
        return `Отдыхаю после долгого дня.`;
      case 'ХОББИ':
        return `Занимаюсь своим хобби - ${action.name}.`;
      default:
        return `Свободна и решила написать тебе.`;
    }
  }

  /**
   * Создает системный промпт для персонажа с учетом эмоционального состояния и мотиваций
   */
  private createCharacterSystemPrompt(
    character: Character,
    emotionalState: EmotionalState,
    _motivations: unknown[],
    additionalContext: string = '',
  ): string {
    const motivationsText = 'Мотивации не определены';

    const extendedContext = `
Текущие мотивации:
${motivationsText}

${additionalContext ? `Дополнительный контекст: ${additionalContext}` : ''}`;

    return this.promptTemplateService.createCharacterSystemPrompt(
      character,
      emotionalState,
      extendedContext,
    );
  }
}
