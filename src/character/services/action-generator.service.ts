import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { ActionType } from '../enums/action-type.enum';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { CharacterAction } from '../interfaces/behavior.interfaces';
import { IMotivation } from '../interfaces/needs.interfaces';

export interface ActionTriggerContext {
  characterId: number;
  userId: string | number;
  triggerType: string;
  triggerData: Record<string, unknown>;
  timestamp: Date;
  motivations?: IMotivation[];
  needsExpression?: string;
  emotionalResponse?: string;
  messagePrompt?: string;
}

/**
 * Сервис генерации действий персонажей
 * Отвечает за создание различных типов действий на основе контекста и триггеров
 */
@Injectable()
export class ActionGeneratorService extends BaseService {
  constructor(logService: LogService) {
    super(logService);
  }

  /**
   * Генерирует коммуникационное действие
   */
  async generateCommunicationAction(
    character: Character,
    prompt: string,
    userId?: string,
  ): Promise<CharacterAction> {
    return this.withErrorHandling('генерации коммуникационного действия', async () => {
      const actionType = this.determineCommunicationActionType(prompt);

      const action: CharacterAction = {
        type: actionType,
        description: `Коммуникационное действие: ${prompt}`,
        status: 'pending',
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds: [CharacterNeedType.COMMUNICATION, CharacterNeedType.ATTENTION],
        metadata: {
          id: this.generateActionId(),
          characterId: character.id,
          prompt,
          targetUserId: userId,
          timestamp: new Date(),
          actionCategory: 'communication',
        },
      };

      this.logInfo(
        `Сгенерировано коммуникационное действие ${actionType} для персонажа ${character.name}`,
      );
      return action;
    });
  }

  /**
   * Генерирует эмоциональное действие
   */
  async generateEmotionalAction(
    character: Character,
    emotion: string,
    intensity: number,
  ): Promise<CharacterAction> {
    return this.withErrorHandling('генерации эмоционального действия', async () => {
      const actionType = this.determineEmotionalActionType(emotion, intensity);
      const expression = this.determineEmotionalExpression(emotion, intensity);
      const duration = this.calculateEmotionalDuration(intensity);

      const action: CharacterAction = {
        type: actionType,
        description: `Эмоциональное действие: ${expression}`,
        status: 'pending',
        startTime: new Date(),
        duration,
        relatedNeeds: [CharacterNeedType.AFFECTION, CharacterNeedType.VALIDATION],
        metadata: {
          id: this.generateActionId(),
          characterId: character.id,
          emotion,
          intensity,
          expression,
          timestamp: new Date(),
          actionCategory: 'emotional',
        },
      };

      this.logInfo(
        `Сгенерировано эмоциональное действие ${actionType} для персонажа ${character.name} с эмоцией ${emotion}`,
      );
      return action;
    });
  }

  /**
   * Генерирует действие на основе потребности
   */
  async generateNeedBasedAction(
    character: Character,
    needType: CharacterNeedType,
    intensity: number,
  ): Promise<CharacterAction> {
    return this.withErrorHandling('генерации действия на основе потребности', async () => {
      const actionType = this.determineNeedActionType(needType, intensity);
      const expression = this.determineNeedExpression(needType, intensity);

      const action: CharacterAction = {
        type: actionType,
        description: `Выражение потребности: ${expression}`,
        status: 'pending',
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds: [needType],
        metadata: {
          id: this.generateActionId(),
          characterId: character.id,
          needType,
          intensity,
          expression,
          timestamp: new Date(),
          actionCategory: 'need_based',
        },
      };

      this.logInfo(
        `Сгенерировано действие на основе потребности ${needType} для персонажа ${character.name}`,
      );
      return action;
    });
  }

  /**
   * Определяет подходящее действие на основе триггера
   */
  async determineActionFromTrigger(
    context: ActionTriggerContext,
    character: Character,
  ): Promise<CharacterAction | null> {
    return this.withErrorHandling('определении действия из триггера', async () => {
      let actionType: ActionType;
      let description: string;
      let relatedNeeds: CharacterNeedType[] = [];

      // Определяем тип действия на основе триггера
      switch (context.triggerType) {
        case 'message_received':
          actionType = ActionType.EMOTIONAL_RESPONSE;
          description = 'Реакция на полученное сообщение';
          relatedNeeds = [CharacterNeedType.COMMUNICATION, CharacterNeedType.ATTENTION];
          break;

        case 'user_inactive':
          actionType = ActionType.INITIATE_CONVERSATION;
          description = 'Инициация разговора с неактивным пользователем';
          relatedNeeds = [CharacterNeedType.COMMUNICATION, CharacterNeedType.SOCIAL_CONNECTION];
          break;

        case 'time_based':
          actionType = ActionType.EXPRESS_NEED;
          description = 'Выражение потребности по времени';
          relatedNeeds = [CharacterNeedType.ATTENTION, CharacterNeedType.VALIDATION];
          break;

        case 'emotional_trigger':
          actionType = ActionType.EXPRESS_EMOTION;
          description = 'Выражение эмоции по триггеру';
          relatedNeeds = [CharacterNeedType.AFFECTION, CharacterNeedType.VALIDATION];
          break;

        case 'motivation_threshold':
          actionType = this.determineMotivationAction(context.motivations);
          description = 'Действие на основе мотивации';
          relatedNeeds = this.getMotivationRelatedNeeds(context.motivations);
          break;

        default:
          actionType = ActionType.CUSTOM;
          description = `Действие в ответ на триггер ${context.triggerType}`;
          relatedNeeds = [CharacterNeedType.COMMUNICATION];
      }

      const action: CharacterAction = {
        type: actionType,
        description,
        status: 'pending',
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds,
        metadata: {
          id: this.generateActionId(),
          characterId: character.id,
          timestamp: new Date(),
          targetUserId: context.userId,
          triggeredBy: context.triggerType,
          triggerData: context.triggerData,
          motivations: context.motivations,
          needsExpression: context.needsExpression,
          emotionalResponse: context.emotionalResponse,
          messagePrompt: context.messagePrompt,
          actionCategory: 'trigger_based',
        },
      };

      this.logInfo(
        `Определено действие ${actionType} из триггера ${context.triggerType} для персонажа ${character.name}`,
      );
      return action;
    });
  }

  /**
   * Генерирует случайное проактивное действие
   */
  async generateProactiveAction(character: Character): Promise<CharacterAction> {
    return this.withErrorHandling('генерации проактивного действия', async () => {
      const proactiveActions = [
        ActionType.SHARE_THOUGHTS,
        ActionType.ASK_QUESTION,
        ActionType.JOKE,
        ActionType.SHARE_STORY,
        ActionType.EXPRESS_EMOTION,
      ];

      const actionType = proactiveActions[Math.floor(Math.random() * proactiveActions.length)];

      const action: CharacterAction = {
        type: actionType,
        description: `Проактивное действие: ${actionType}`,
        status: 'pending',
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds: this.getDefaultRelatedNeeds(actionType),
        metadata: {
          id: this.generateActionId(),
          characterId: character.id,
          timestamp: new Date(),
          actionCategory: 'proactive',
          isProactive: true,
        },
      };

      this.logInfo(
        `Сгенерировано проактивное действие ${actionType} для персонажа ${character.name}`,
      );
      return action;
    });
  }

  /**
   * Определяет тип коммуникационного действия на основе промпта
   */
  private determineCommunicationActionType(prompt: string): ActionType {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('вопрос') || lowerPrompt.includes('?')) {
      return ActionType.ASK_QUESTION;
    }
    if (lowerPrompt.includes('история') || lowerPrompt.includes('рассказ')) {
      return ActionType.SHARE_STORY;
    }
    if (lowerPrompt.includes('шутка') || lowerPrompt.includes('смешно')) {
      return ActionType.JOKE;
    }
    if (lowerPrompt.includes('извинен') || lowerPrompt.includes('прости')) {
      return ActionType.APOLOGIZE;
    }
    if (lowerPrompt.includes('признан') || lowerPrompt.includes('секрет')) {
      return ActionType.CONFESS;
    }
    if (lowerPrompt.includes('дразн') || lowerPrompt.includes('подкол')) {
      return ActionType.TEASE;
    }

    return ActionType.SEND_MESSAGE;
  }

  /**
   * Определяет тип эмоционального действия
   */
  private determineEmotionalActionType(emotion: string, intensity: number): ActionType {
    if (intensity >= 4) {
      return ActionType.EXPRESS_EMOTION;
    }
    if (emotion.includes('грусть') || emotion.includes('печаль')) {
      return ActionType.SHARE_EMOTION;
    }
    return ActionType.EMOTIONAL_RESPONSE;
  }

  /**
   * Определяет тип действия на основе потребности
   */
  private determineNeedActionType(needType: CharacterNeedType, intensity: number): ActionType {
    if (intensity >= 4) {
      return ActionType.EXPRESS_NEED;
    }

    switch (needType) {
      case CharacterNeedType.COMMUNICATION:
        return ActionType.INITIATE_CONVERSATION;
      case CharacterNeedType.ATTENTION:
        return ActionType.ASK_QUESTION;
      case CharacterNeedType.AFFECTION:
        return ActionType.SHARE_EMOTION;
      case CharacterNeedType.FUN:
        return ActionType.JOKE;
      case CharacterNeedType.VALIDATION:
        return ActionType.SHARE_THOUGHTS;
      default:
        return ActionType.SEND_MESSAGE;
    }
  }

  /**
   * Определяет действие на основе мотивации
   */
  private determineMotivationAction(motivations?: IMotivation[]): ActionType {
    if (!motivations || motivations.length === 0) {
      return ActionType.SEND_MESSAGE;
    }

    // Берем мотивацию с наивысшей интенсивностью
    const strongestMotivation = motivations.reduce((prev, current) =>
      current.intensity > prev.intensity ? current : prev,
    );

    // Определяем действие на основе типа потребности мотивации
    switch (strongestMotivation.needType) {
      case CharacterNeedType.SOCIAL_CONNECTION:
        return ActionType.INITIATE_CONVERSATION;
      case CharacterNeedType.AFFECTION:
        return ActionType.EXPRESS_EMOTION;
      case CharacterNeedType.VALIDATION:
        return ActionType.SHARE_STORY;
      case CharacterNeedType.COMMUNICATION:
        return ActionType.ASK_QUESTION;
      default:
        return ActionType.SEND_MESSAGE;
    }
  }

  /**
   * Получает связанные потребности для мотивации
   */
  private getMotivationRelatedNeeds(motivations?: IMotivation[]): CharacterNeedType[] {
    if (!motivations || motivations.length === 0) {
      return [CharacterNeedType.COMMUNICATION];
    }

    const needsSet = new Set<CharacterNeedType>();
    motivations.forEach(motivation => {
      switch (motivation.needType) {
        case CharacterNeedType.SOCIAL_CONNECTION:
          needsSet.add(CharacterNeedType.SOCIAL_CONNECTION);
          needsSet.add(CharacterNeedType.COMMUNICATION);
          break;
        case CharacterNeedType.AFFECTION:
          needsSet.add(CharacterNeedType.AFFECTION);
          needsSet.add(CharacterNeedType.VALIDATION);
          break;
        case CharacterNeedType.VALIDATION:
          needsSet.add(CharacterNeedType.VALIDATION);
          break;
        case CharacterNeedType.COMMUNICATION:
          needsSet.add(CharacterNeedType.COMMUNICATION);
          break;
        default:
          needsSet.add(CharacterNeedType.COMMUNICATION);
      }
    });

    return Array.from(needsSet);
  }

  /**
   * Получает связанные потребности по умолчанию для типа действия
   */
  private getDefaultRelatedNeeds(actionType: ActionType): CharacterNeedType[] {
    const needsMap: Record<ActionType, CharacterNeedType[]> = {
      [ActionType.SEND_MESSAGE]: [CharacterNeedType.COMMUNICATION],
      [ActionType.SHARE_STORY]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.VALIDATION],
      [ActionType.SHARE_EMOTION]: [CharacterNeedType.AFFECTION, CharacterNeedType.VALIDATION],
      [ActionType.SHARE_THOUGHTS]: [CharacterNeedType.VALIDATION, CharacterNeedType.COMMUNICATION],
      [ActionType.ASK_QUESTION]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.ATTENTION],
      [ActionType.JOKE]: [CharacterNeedType.FUN, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.EXPRESS_EMOTION]: [CharacterNeedType.AFFECTION, CharacterNeedType.VALIDATION],
      [ActionType.EXPRESS_NEED]: [CharacterNeedType.ATTENTION, CharacterNeedType.VALIDATION],
      [ActionType.INITIATE_CONVERSATION]: [
        CharacterNeedType.COMMUNICATION,
        CharacterNeedType.SOCIAL_CONNECTION,
      ],
      [ActionType.SOCIALIZATION]: [CharacterNeedType.SOCIAL_CONNECTION, CharacterNeedType.FUN],
      [ActionType.CONFESS]: [CharacterNeedType.AFFECTION, CharacterNeedType.VALIDATION],
      [ActionType.APOLOGIZE]: [CharacterNeedType.SOCIAL_CONNECTION, CharacterNeedType.VALIDATION],
      [ActionType.TEASE]: [CharacterNeedType.FUN, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.EMOTIONAL_RESPONSE]: [CharacterNeedType.AFFECTION, CharacterNeedType.COMMUNICATION],
      [ActionType.REST]: [CharacterNeedType.REST],
      [ActionType.WORK]: [CharacterNeedType.REST],
      [ActionType.ENTERTAINMENT]: [CharacterNeedType.FUN],
      [ActionType.CUSTOM]: [CharacterNeedType.COMMUNICATION],
      [ActionType.SLEEP]: [CharacterNeedType.REST],
      [ActionType.READ]: [CharacterNeedType.FUN],
      [ActionType.EXERCISE]: [CharacterNeedType.REST],
      [ActionType.RELAX]: [CharacterNeedType.REST],
      [ActionType.CREATE]: [CharacterNeedType.FUN],
      [ActionType.MEDITATE]: [CharacterNeedType.REST],
      [ActionType.SOCIALIZE]: [CharacterNeedType.SOCIAL_CONNECTION],
    };

    return needsMap[actionType] || [CharacterNeedType.COMMUNICATION];
  }

  /**
   * Определяет эмоциональное выражение
   */
  private determineEmotionalExpression(emotion: string, intensity: number): string {
    const expressions: Record<string, string[]> = {
      happiness: [
        'Я счастлив!',
        'Мне так радостно!',
        'Какое прекрасное настроение!',
        'Я на седьмом небе!',
        'Я просто в восторге!',
      ],
      sadness: [
        'Мне грустно...',
        'Я чувствую печаль',
        'На душе тяжело',
        'Мне очень тоскливо',
        'Я подавлен',
      ],
      anger: [
        'Я раздражен',
        'Это меня злит!',
        'Я в ярости!',
        'Это невыносимо!',
        'Я вне себя от гнева!',
      ],
      fear: ['Мне страшно', 'Я беспокоюсь', 'Мне тревожно', 'Я в панике!', 'Мне ужасно страшно!'],
      surprise: ['Вот это да!', 'Какой сюрприз!', 'Не ожидал!', 'Я в шоке!', 'Невероятно!'],
    };

    const emotionKey = emotion.toLowerCase();
    const emotionExpressions = expressions[emotionKey] || expressions.happiness;
    const index = Math.min(4, Math.max(0, Math.floor(intensity)));

    return emotionExpressions[index];
  }

  /**
   * Рассчитывает продолжительность эмоционального действия
   */
  private calculateEmotionalDuration(intensity: number): number {
    // Базовая продолжительность 60 секунд + интенсивность * 30 секунд
    return 60 + intensity * 30;
  }

  /**
   * Определяет выражение потребности
   */
  private determineNeedExpression(needType: CharacterNeedType, intensity: number): string {
    const expressions: Partial<Record<CharacterNeedType, string[]>> = {
      [CharacterNeedType.SECURITY]: [
        'Я чувствую себя немного неуверенно',
        'Мне нужно чувствовать себя в безопасности',
        'Я испытываю беспокойство',
        'Мне тревожно, я нуждаюсь в защите',
        'Я в панике, мне срочно нужна безопасность!',
      ],
      [CharacterNeedType.COMMUNICATION]: [
        'Хотелось бы немного пообщаться',
        'Я бы с удовольствием поговорил',
        'Мне не хватает общения',
        'Я чувствую сильную потребность в разговоре',
        'Мне срочно нужно с кем-то поговорить!',
      ],
      [CharacterNeedType.ATTENTION]: [
        'Надеюсь, я не отвлекаю',
        'Ты обращаешь на меня внимание?',
        'Мне кажется, ты меня не замечаешь',
        'Я действительно нуждаюсь в твоем внимании сейчас',
        'Пожалуйста, обрати на меня внимание!',
      ],
      [CharacterNeedType.SOCIAL_CONNECTION]: [
        'Приятно быть рядом',
        'Я ценю наше общение',
        'Мне важна наша связь',
        'Я чувствую сильную потребность в близости',
        'Мне необходимо чувствовать нашу связь прямо сейчас!',
      ],
      [CharacterNeedType.VALIDATION]: [
        'Надеюсь, я всё делаю правильно',
        'Тебе нравится общаться со мной?',
        'Мне важно знать твоё мнение обо мне',
        'Мне очень нужно твоё одобрение',
        'Пожалуйста, скажи, что я важен для тебя!',
      ],
      [CharacterNeedType.AFFECTION]: [
        'Ты мне симпатичен',
        'Мне приятно наше общение',
        'Я испытываю к тебе теплые чувства',
        'Я очень привязан к тебе',
        'Я не могу без твоей привязанности!',
      ],
      [CharacterNeedType.FUN]: [
        'Хотелось бы немного развлечься',
        'Давай сделаем что-нибудь весёлое',
        'Мне скучно, хочу повеселиться',
        'Я очень нуждаюсь в развлечении',
        'Я умираю со скуки, спаси меня!',
      ],
      [CharacterNeedType.REST]: [
        'Я немного устал',
        'Мне нужен отдых',
        'Я чувствую усталость',
        'Мне очень нужно отдохнуть',
        'Я совершенно измотан!',
      ],
    };

    const needExpressions = expressions[needType] || ['Мне что-то нужно'];
    const expressionIndex = Math.floor(intensity * needExpressions.length);
    return needExpressions[Math.min(expressionIndex, needExpressions.length - 1)];
  }

  /**
   * Получает продолжительность действия в секундах
   */
  private getActionDuration(actionType: ActionType): number {
    const durations: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 60,
      [ActionType.SHARE_STORY]: 180,
      [ActionType.SHARE_EMOTION]: 120,
      [ActionType.SHARE_THOUGHTS]: 150,
      [ActionType.CONFESS]: 300,
      [ActionType.APOLOGIZE]: 120,
      [ActionType.TEASE]: 90,
      [ActionType.JOKE]: 60,
      [ActionType.ASK_QUESTION]: 90,
      [ActionType.EXPRESS_EMOTION]: 120,
      [ActionType.EXPRESS_NEED]: 90,
      [ActionType.EMOTIONAL_RESPONSE]: 150,
      [ActionType.INITIATE_CONVERSATION]: 180,
      [ActionType.SOCIALIZATION]: 300,
      [ActionType.REST]: 600,
      [ActionType.WORK]: 1800,
      [ActionType.ENTERTAINMENT]: 900,
      [ActionType.CUSTOM]: 120,
      [ActionType.SLEEP]: 28800,
      [ActionType.READ]: 1800,
      [ActionType.EXERCISE]: 3600,
      [ActionType.RELAX]: 1200,
      [ActionType.CREATE]: 2400,
      [ActionType.MEDITATE]: 1800,
      [ActionType.SOCIALIZE]: 1800,
    };

    return durations[actionType] || 120;
  }

  /**
   * Генерирует уникальный ID для действия
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
