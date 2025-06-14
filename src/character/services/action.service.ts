import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { ModuleRef } from '@nestjs/core';
import { Character } from '../entities/character.entity';
import { ActionType } from '../enums/action-type.enum';
import { MemoryType } from '../interfaces/memory.interfaces';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { CharacterAction } from '../interfaces/behavior.interfaces';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NeedsService } from './needs.service';
import { MemoryService } from './memory.service';
import { Cron } from '@nestjs/schedule';
import { IMotivation } from '../interfaces/needs.interfaces';
import { CharacterNeedType } from '../enums/character-need-type.enum';

// Определяем интерфейсы прямо в файле
export interface ActionContext {
  character: Character;
  action: CharacterAction;
  metadata?: Record<string, unknown>;
}

/**
 * Интерфейс для контекста триггера действия
 */
export interface ActionTriggerContext {
  characterId: number;
  userId: number;
  triggerType: string;
  triggerData: Record<string, unknown>;
  timestamp: Date;
  motivations?: IMotivation[];
  needsExpression?: string;
  emotionalResponse?: string;
  messagePrompt?: string;
}

export interface ActionHandler {
  getSupportedActionTypes(): ActionType[];
  canExecute(context: ActionContext): Promise<boolean>;
  execute(context: ActionContext): Promise<ActionResult>;
  interrupt(context: ActionContext): Promise<void>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  needsImpact?: Record<string, number>;
  /** Расширение согласно ТЗ ВОЛЯ */
  resourceCost?: number;
  actualReward?: Record<string, unknown>;
  effectiveness?: number;
  sideEffects?: string[];
  probabilityUsed?: number;
}

export interface ActionTimer {
  actionId: string;
  scheduledFor: Date;
  callback: () => Promise<void>;
  interval?: number;
  isRecurring: boolean;
}

export interface ActionStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

/**
 * Сервис управления действиями персонажей
 * Объединяет функциональность ActionService и UnifiedActionHandler
 */
@Injectable()
export class ActionService implements ActionHandler, OnModuleInit {
  private needsService?: NeedsService;
  private memoryService?: MemoryService;

  // Реестр действий и таймеров
  private actionRegistry = new Map<string, CharacterAction>();
  private actionTimers = new Map<string, ActionTimer>();
  private characterCurrentActions = new Map<string, string>(); // characterId -> actionId
  private characterChatStates = new Map<string, { userId: string; isActive: boolean }>();
  private isProcessing = false;

  // Поддерживаемые типы действий
  private static readonly SUPPORTED_ACTIONS = [
    // Message actions
    ActionType.SEND_MESSAGE,
    ActionType.SHARE_STORY,
    ActionType.SHARE_EMOTION,
    ActionType.SHARE_THOUGHTS,
    ActionType.CONFESS,
    ActionType.APOLOGIZE,
    ActionType.TEASE,
    ActionType.JOKE,
    ActionType.ASK_QUESTION,
    // Emotional actions
    ActionType.EXPRESS_EMOTION,
    ActionType.EXPRESS_NEED,
    ActionType.EMOTIONAL_RESPONSE,
    // Behavior actions
    ActionType.INITIATE_CONVERSATION,
    ActionType.SOCIALIZATION,
    ActionType.REST,
    ActionType.WORK,
    ActionType.ENTERTAINMENT,
  ];

  constructor(
    private moduleRef: ModuleRef,
    private readonly logService: LogService,
    @InjectRepository(Character) private repository: Repository<Character>,
  ) {
    this.logService.setContext(ActionService.name);
  }

  async onModuleInit(): Promise<void> {
    try {
      this.needsService = this.moduleRef.get('NeedsService', { strict: false });
      this.memoryService = this.moduleRef.get('MemoryService', { strict: false });
      this.logService.log('ActionService успешно инициализирован');
    } catch (error) {
      this.logService.error(
        `Не удалось инициализировать сервисы: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Реализация интерфейса ActionHandler
  getSupportedActionTypes(): ActionType[] {
    return [...ActionService.SUPPORTED_ACTIONS];
  }

  async canExecute(context: ActionContext): Promise<boolean> {
    return withErrorHandling(
      async () => {
        const actionType = context.action.type;

        if (!ActionService.SUPPORTED_ACTIONS.includes(actionType)) {
          return false;
        }

        // Проверяем, не выполняется ли уже другое действие для этого персонажа
        const currentActionId = this.characterCurrentActions.get(context.character.id.toString());
        if (currentActionId && currentActionId !== context.action.metadata?.id) {
          const currentAction = this.actionRegistry.get(currentActionId);
          if (currentAction && currentAction.status === 'in_progress') {
            return false;
          }
        }

        // Проверяем ресурсную стоимость согласно ТЗ ВОЛЯ
        const hasResources = await this.checkResourceAvailability(context);
        if (!hasResources) {
          return false;
        }

        // Специфичные проверки для разных типов действий
        switch (actionType) {
          case ActionType.SEND_MESSAGE:
          case ActionType.SHARE_STORY:
          case ActionType.SHARE_THOUGHTS:
          case ActionType.CONFESS:
          case ActionType.APOLOGIZE:
          case ActionType.TEASE:
          case ActionType.JOKE:
          case ActionType.ASK_QUESTION:
            return this.canExecuteMessage(context);

          case ActionType.EXPRESS_EMOTION:
          case ActionType.SHARE_EMOTION:
          case ActionType.EMOTIONAL_RESPONSE:
            return this.canExecuteEmotion(context);

          case ActionType.EXPRESS_NEED:
            return this.canExecuteNeed(context);

          default:
            return true;
        }
      },
      `проверке возможности выполнения действия ${context.action.type}`,
      this.logService,
      { characterId: context.character.id, actionType: context.action.type },
      false,
    );
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    return withErrorHandling(
      async () => {
        const canExecute = await this.canExecute(context);
        if (!canExecute) {
          return {
            success: false,
            message: `Не удается выполнить действие типа ${context.action.type}`,
          };
        }

        this.logService.log(
          `Выполнение действия ${context.action.type} для персонажа ${context.character.id}`,
        );

        // Регистрируем действие если оно новое
        const actionId = (context.action.metadata?.id as string) || this.generateActionId();
        if (!this.actionRegistry.has(actionId)) {
          const action: CharacterAction = {
            ...context.action,
            status: 'in_progress',
            startTime: new Date(),
            metadata: { ...context.action.metadata, id: actionId },
          };
          this.registerAction(action);
        }

        // Устанавливаем текущее действие для персонажа
        this.characterCurrentActions.set(context.character.id.toString(), actionId);

        const actionType = context.action.type;
        let result: ActionResult;

        // Выполняем действие в зависимости от типа
        switch (actionType) {
          case ActionType.SEND_MESSAGE:
          case ActionType.SHARE_STORY:
          case ActionType.SHARE_THOUGHTS:
          case ActionType.CONFESS:
          case ActionType.APOLOGIZE:
          case ActionType.TEASE:
          case ActionType.JOKE:
          case ActionType.ASK_QUESTION:
            result = await this.executeMessage(context);
            break;

          case ActionType.EXPRESS_EMOTION:
          case ActionType.SHARE_EMOTION:
          case ActionType.EMOTIONAL_RESPONSE:
            result = await this.executeEmotion(context);
            break;

          case ActionType.EXPRESS_NEED:
            result = await this.executeNeed(context);
            break;

          default:
            result = await this.executeGenericAction(context);
        }

        // Обновляем статус действия
        const action = this.actionRegistry.get(actionId);
        if (action) {
          action.status = result.success ? 'completed' : 'failed';
          action.endTime = new Date();
        }

        // Сохраняем действие в памяти
        if (result.success && this.memoryService) {
          await this.saveActionToMemory(context, result);
        }

        // Очищаем текущее действие для персонажа
        this.characterCurrentActions.delete(context.character.id.toString());

        if (result.success) {
          this.logService.log(`Действие ${actionType} успешно выполнено`);
        } else {
          this.logService.warn(`Действие ${actionType} не выполнено: ${result.message}`);
        }

        return result;
      },
      `выполнении действия ${context.action.type}`,
      this.logService,
      { characterId: context.character.id, actionType: context.action.type },
      {
        success: false,
        message: `Произошла ошибка при выполнении действия ${context.action.type}`,
      },
    );
  }

  async interrupt(context: ActionContext): Promise<void> {
    return withErrorHandling(
      async () => {
        this.logService.log(
          `Прерывание действия ${context.action.type} для персонажа ${context.character.id}`,
        );

        const actionId = context.action.metadata?.id as string;
        if (actionId) {
          const action = this.actionRegistry.get(actionId);
          if (action) {
            action.status = 'failed';
            action.endTime = new Date();
          }
        }

        this.characterCurrentActions.delete(context.character.id.toString());
      },
      `прерывании действия ${context.action.type}`,
      this.logService,
      { characterId: context.character.id, actionType: context.action.type },
      undefined,
    );
  }

  // Методы управления действиями (из ActionService)
  registerAction(action: CharacterAction): void {
    const actionId = (action.metadata?.id as string) || this.generateActionId();
    action.metadata = { ...action.metadata, id: actionId };
    this.actionRegistry.set(actionId, action);
    this.logService.debug(`Action registered: ${actionId} of type ${action.type}`);
  }

  getAction(actionId: string): CharacterAction | undefined {
    return this.actionRegistry.get(actionId);
  }

  getActionsByCharacter(characterId: string): CharacterAction[] {
    return Array.from(this.actionRegistry.values()).filter(
      action => action.metadata?.characterId === characterId,
    );
  }

  getCurrentAction(characterId: string): CharacterAction | undefined {
    const actionId = this.characterCurrentActions.get(characterId);
    return actionId ? this.actionRegistry.get(actionId) : undefined;
  }

  isPerformingAction(characterId: string): boolean {
    const currentAction = this.getCurrentAction(characterId);
    return currentAction?.status === 'in_progress';
  }

  async stopCurrentAction(characterId: string): Promise<boolean> {
    const currentAction = this.getCurrentAction(characterId);
    if (!currentAction) {
      return false;
    }

    const context: ActionContext = {
      character: { id: characterId } as unknown as Character,
      action: currentAction,
    };

    await this.interrupt(context);
    return true;
  }

  getActionProgress(characterId: string): number {
    const currentAction = this.getCurrentAction(characterId);
    if (!currentAction || currentAction.status !== 'in_progress') {
      return 0;
    }

    const elapsed = Date.now() - currentAction.startTime.getTime();
    const progress = Math.min(100, (elapsed / currentAction.duration) * 100);
    return Math.round(progress);
  }

  // Методы управления состоянием чата
  updateChatState(characterId: string, userId: string, isActive: boolean): void {
    this.characterChatStates.set(characterId, { userId, isActive });
    this.logService.debug(
      `Chat state updated for character ${characterId}: ${isActive ? 'active' : 'inactive'}`,
    );
  }

  // Методы планирования действий
  scheduleAction(action: CharacterAction, scheduledFor: Date): void {
    const actionId = (action.metadata?.id as string) || this.generateActionId();
    const timer: ActionTimer = {
      actionId,
      scheduledFor,
      callback: async () => {
        const context: ActionContext = {
          character: { id: action.metadata?.characterId as number } as Character,
          action,
        };
        await this.execute(context);
      },
      isRecurring: false,
    };

    this.actionTimers.set(actionId, timer);

    const delay = scheduledFor.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        void timer.callback().then(() => {
          this.actionTimers.delete(actionId);
        });
      }, delay);
    }

    this.logService.debug(`Action ${actionId} scheduled for ${scheduledFor.toISOString()}`);
  }

  cancelScheduledAction(actionId: string): boolean {
    const timer = this.actionTimers.get(actionId);
    if (timer) {
      timer.isRecurring = false;
      this.actionTimers.delete(actionId);
      this.logService.debug(`Scheduled action ${actionId} cancelled`);
      return true;
    }
    return false;
  }

  // Генерация действий
  async generateCommunicationAction(
    character: Character,
    prompt: string,
    userId?: string,
  ): Promise<CharacterAction> {
    const action: CharacterAction = {
      type: ActionType.SEND_MESSAGE,
      description: `Отправка сообщения: ${prompt.substring(0, 50)}...`,
      priority: 1,
      duration: 5000, // 5 секунд
      startTime: new Date(),
      status: 'pending',
      content: prompt,
      metadata: {
        characterId: character.id,
        userId,
        messageType: 'response',
      },
    };

    this.registerAction(action);
    return action;
  }

  async generateEmotionalAction(
    character: Character,
    emotion: string,
    intensity: number,
  ): Promise<CharacterAction> {
    const action: CharacterAction = {
      type: ActionType.EXPRESS_EMOTION,
      description: `Выражение эмоции: ${emotion} (интенсивность: ${intensity})`,
      priority: 2,
      duration: this.calculateEmotionalDuration(intensity),
      startTime: new Date(),
      status: 'pending',
      content: emotion,
      metadata: {
        characterId: character.id,
        emotion,
        intensity,
        expression: this.determineEmotionalExpression(emotion, intensity),
      },
    };

    this.registerAction(action);
    return action;
  }

  // Обработка очереди действий
  async processPendingMessages(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingActions = Array.from(this.actionRegistry.values())
        .filter(action => action.status === 'pending')
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      for (const action of pendingActions) {
        const context: ActionContext = {
          character: { id: action.metadata?.characterId as number } as Character,
          action,
        };
        await this.execute(context);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async determineAndPerformAction(
    character: Character,
    context: ActionTriggerContext,
  ): Promise<CharacterAction | null> {
    // Определяем подходящее действие на основе контекста
    let actionType: ActionType;
    let content = '';

    if (context.needsExpression) {
      actionType = ActionType.EXPRESS_NEED;
      content = context.needsExpression;
    } else if (context.emotionalResponse) {
      actionType = ActionType.EMOTIONAL_RESPONSE;
      content = context.emotionalResponse;
    } else if (context.messagePrompt) {
      actionType = ActionType.SEND_MESSAGE;
      content = context.messagePrompt;
    } else {
      actionType = ActionType.INITIATE_CONVERSATION;
      content = 'Инициация разговора';
    }

    const action: CharacterAction = {
      type: actionType,
      description: `Автоматическое действие: ${actionType}`,
      priority: 3,
      duration: 3000,
      startTime: new Date(),
      status: 'pending',
      content,
      metadata: {
        characterId: character.id,
        auto: true,
      },
    };

    const actionContext: ActionContext = {
      character,
      action,
      metadata: context as unknown as Record<string, unknown>,
    };

    const result = await this.execute(actionContext);
    return result.success ? action : null;
  }

  async interruptAction(characterId: string): Promise<void> {
    const currentAction = this.getCurrentAction(characterId);
    if (currentAction) {
      // Создаем минимальный объект Character для контекста
      const numericId = typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;
      const character = { id: numericId } as unknown as Character;
      const context: ActionContext = {
        character,
        action: currentAction,
      };
      await this.interrupt(context);
    }
  }

  async completeAction(characterId: string, success: boolean): Promise<void> {
    const currentAction = this.getCurrentAction(characterId);
    if (currentAction) {
      currentAction.status = success ? 'completed' : 'failed';
      currentAction.endTime = new Date();
      this.characterCurrentActions.delete(characterId);
    }
  }

  // Статистика и утилиты
  getActionStats(): ActionStats {
    const actions = Array.from(this.actionRegistry.values());
    return {
      total: actions.length,
      pending: actions.filter(a => a.status === 'pending').length,
      inProgress: actions.filter(a => a.status === 'in_progress').length,
      completed: actions.filter(a => a.status === 'completed').length,
      failed: actions.filter(a => a.status === 'failed').length,
    };
  }

  clearCompletedActions(): number {
    const completed = Array.from(this.actionRegistry.values()).filter(
      action => action.status === 'completed',
    );

    completed.forEach(action => {
      const actionId = action.metadata?.id as string;
      if (actionId) {
        this.actionRegistry.delete(actionId);
      }
    });

    this.logService.debug(`Cleared ${completed.length} completed actions`);
    return completed.length;
  }

  // Private методы для проверки возможности выполнения
  private async canExecuteMessage(context: ActionContext): Promise<boolean> {
    const characterId = context.character.id.toString();
    const chatState = this.characterChatStates.get(characterId);

    if (!chatState?.isActive) {
      this.logService.debug(
        `Персонаж ${characterId} не может отправить сообщение - нет активного чата`,
      );
      return false;
    }

    return true;
  }

  private async canExecuteEmotion(_context: ActionContext): Promise<boolean> {
    // Эмоциональные действия всегда доступны
    return true;
  }

  private async canExecuteNeed(context: ActionContext): Promise<boolean> {
    // Проверяем наличие потребностей для выражения
    if (!this.needsService) {
      return false;
    }

    const needs = await this.needsService.getActiveNeeds(context.character.id);
    return needs.some(need => need.currentValue < 50);
  }

  // Private методы выполнения действий
  private async executeMessage(context: ActionContext): Promise<ActionResult> {
    try {
      const characterId = context.character.id.toString();
      const chatState = this.characterChatStates.get(characterId);

      if (!chatState) {
        return {
          success: false,
          message: 'Нет активного чата для отправки сообщения',
        };
      }

      // Здесь должна быть интеграция с сервисом отправки сообщений
      this.logService.debug(
        `Отправка сообщения от персонажа ${characterId} пользователю ${chatState.userId}: ${context.action.content}`,
      );

      return {
        success: true,
        message: 'Сообщение успешно отправлено',
        needsImpact: {}, // Needs impact calculation moved to NeedsService
      };
    } catch (error) {
      return {
        success: false,
        message: `Ошибка отправки сообщения: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async executeEmotion(context: ActionContext): Promise<ActionResult> {
    try {
      const emotion = (context.action.metadata?.emotion as string) || context.action.content;
      const intensity = (context.action.metadata?.intensity as number) || 50;

      this.logService.debug(`Выражение эмоции ${emotion} с интенсивностью ${intensity}`);

      return {
        success: true,
        message: `Эмоция ${emotion} успешно выражена`,
        needsImpact: {}, // Needs impact calculation moved to NeedsService
      };
    } catch (error) {
      return {
        success: false,
        message: `Ошибка выражения эмоции: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async executeNeed(context: ActionContext): Promise<ActionResult> {
    if (!this.needsService) {
      return { success: false, message: 'NeedsService не доступен' };
    }

    const needType = context.action.metadata?.needType as CharacterNeedType;
    const needValue = (context.action.metadata?.needValue as number) || 0;

    if (!needType) {
      return { success: false, message: 'Не указан тип потребности' };
    }

    // Получаем текущую потребность
    const needs = await this.needsService.getActiveNeeds(context.character.id);
    const targetNeed = needs.find((need) => need.type === needType);

    if (!targetNeed) {
      return { success: false, message: `Потребность типа ${needType} не найдена` };
    }

    // Создаем запись о выражении потребности
    const expressionIntensity = (100 - targetNeed.currentValue) / 20; // Чем больше потребность, тем сильнее выражение
    const expressionText = this.determineNeedExpression(needType, expressionIntensity);

    // Обновляем потребность, если указано значение
    if (needValue !== 0) {
      await this.needsService.updateNeed(context.character.id, {
        type: needType,
        change: needValue,
        reason: 'character_action',
      });
    }

    return {
      success: true,
      message: expressionText,
      needsImpact: { [needType]: needValue },
    };
  }

  private async executeGenericAction(context: ActionContext): Promise<ActionResult> {
    // Базовая реализация для других типов действий
    this.logService.debug(`Выполнение базового действия ${context.action.type}`);

    return {
      success: true,
      message: `Действие ${context.action.type} выполнено`,
    };
  }

  // Вспомогательные методы
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineEmotionalExpression(emotion: string, intensity: number): string {
    const expressions = {
      happy: intensity > 70 ? 'euphoric' : intensity > 40 ? 'joyful' : 'content',
      sad: intensity > 70 ? 'devastated' : intensity > 40 ? 'melancholic' : 'downcast',
      angry: intensity > 70 ? 'furious' : intensity > 40 ? 'irritated' : 'annoyed',
      fear: intensity > 70 ? 'terrified' : intensity > 40 ? 'anxious' : 'worried',
    };

    return expressions[emotion as keyof typeof expressions] || 'neutral';
  }

  private calculateEmotionalDuration(intensity: number): number {
    return Math.floor(intensity / 10) * 60 * 1000; // миллисекунды
  }

  // Removed needs impact calculation methods - functionality moved to NeedsService

  private async saveActionToMemory(context: ActionContext, result: ActionResult): Promise<void> {
    if (!this.memoryService) {
      return;
    }

    try {
      const memoryEntry = {
        type: 'action',
        content: `Выполнено действие: ${context.action.type} - ${context.action.description}`,
        timestamp: new Date(),
        metadata: {
          actionType: context.action.type,
          success: result.success,
          needsImpact: result.needsImpact,
        },
      };

      await this.memoryService.createMemory(
        context.character.id,
        memoryEntry.content,
        MemoryType.EVENT,
        5,
        memoryEntry.metadata,
      );
    } catch (error) {
      this.logService.warn(
        `Не удалось сохранить действие в памяти: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Проверяет доступность ресурсов для выполнения действия согласно ТЗ ВОЛЯ
   */
  private async checkResourceAvailability(context: ActionContext): Promise<boolean> {
    if (!this.needsService) {
      return true;
    }

    const action = context.action;
    const resourceCost = action.resourceCost || this.getDefaultResourceCost(action.type);

    // Для простоты проверяем энергию как ресурс, но в продакшене можно усложнить
    const needs = await this.needsService.getActiveNeeds(context.character.id);
    const energyNeed = needs.find((need) => need.type === CharacterNeedType.REST);

    if (energyNeed && energyNeed.currentValue < resourceCost) {
      this.logService.debug(`Недостаточно энергии для выполнения действия: ${action.type}`, {
        characterId: context.character.id,
        energyAvailable: energyNeed.currentValue,
        resourceCost,
      });
      return false;
    }

    return true;
  }

  /**
   * Выполняет действие с учетом ресурсной стоимости и вероятности успеха согласно ТЗ ВОЛЯ
   */
  async executeActionWithResources(context: ActionContext): Promise<ActionResult> {
    try {
      const resourceCost = (context.action.metadata?.resourceCost as number) || 10;
      const successProbability = (context.action.metadata?.successProbability as number) || 80;
      const potentialReward =
        (context.action.metadata?.potentialReward as Record<string, unknown>) || {};

      // Определяем успех на основе вероятности
      const randomRoll = Math.random() * 100;
      const success = randomRoll <= successProbability;

      // Вычисляем эффективность
      const effectiveness = success
        ? Math.min(100, 50 + (successProbability - randomRoll))
        : Math.max(0, randomRoll - successProbability);

      // Формируем результат
      const result: ActionResult = {
        success,
        message: success
          ? `Действие ${context.action.type} выполнено успешно`
          : `Действие ${context.action.type} завершилось неудачей`,
        resourceCost,
        effectiveness,
        probabilityUsed: successProbability,
        actualReward: success ? potentialReward : {},
        sideEffects: success ? [] : ['Потеря ресурсов без результата'],
      };

      // Влияние на потребности
      if (success && potentialReward.needsImpact) {
        result.needsImpact = potentialReward.needsImpact as Record<string, number>;
      }

      this.logService.log(
        `Действие ${context.action.type}: успех=${success}, эффективность=${effectiveness}%, стоимость=${resourceCost}`,
      );

      return result;
    } catch (error) {
      this.logService.error('Ошибка при выполнении действия с ресурсами', {
        error: error instanceof Error ? error.message : String(error),
        characterId: context.character.id,
        actionType: context.action.type,
      });
      return { success: false, message: 'Ошибка выполнения действия' };
    }
  }

  /**
   * Создает действие с предустановленными параметрами согласно ТЗ ВОЛЯ
   */
  async createActionWithResources(
    characterId: number,
    actionType: ActionType,
    options: {
      resourceCost?: number;
      successProbability?: number;
      potentialReward?: Record<string, unknown>;
      description?: string;
    } = {},
  ): Promise<CharacterAction> {
    try {
      const character = await this.repository.findOne({ where: { id: characterId } });
      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      const action: CharacterAction = {
        type: actionType,
        description: options.description || `Действие типа ${actionType}`,
        status: 'pending',
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds: null,
        metadata: {
          id: this.generateActionId(),
          resourceCost: options.resourceCost || this.getDefaultResourceCost(actionType),
          successProbability:
            options.successProbability || this.getDefaultSuccessProbability(actionType),
          potentialReward: options.potentialReward || this.getDefaultReward(actionType),
        },
      };

      return action;
    } catch (error) {
      this.logService.error('Ошибка при создании действия с ресурсами', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
        actionType,
        options,
      });
      throw error;
    }
  }

  /**
   * Получает стандартную ресурсную стоимость для типа действия
   */
  private getDefaultResourceCost(actionType: ActionType): number {
    const costMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 5,
      [ActionType.SHARE_STORY]: 15,
      [ActionType.SHARE_EMOTION]: 8,
      [ActionType.SHARE_THOUGHTS]: 10,
      [ActionType.CONFESS]: 25,
      [ActionType.APOLOGIZE]: 12,
      [ActionType.TEASE]: 6,
      [ActionType.JOKE]: 7,
      [ActionType.ASK_QUESTION]: 4,
      [ActionType.EXPRESS_EMOTION]: 8,
      [ActionType.EXPRESS_NEED]: 10,
      [ActionType.EMOTIONAL_RESPONSE]: 6,
      [ActionType.INITIATE_CONVERSATION]: 15,
      [ActionType.SOCIALIZATION]: 20,
      [ActionType.REST]: 0,
      [ActionType.WORK]: 30,
      [ActionType.ENTERTAINMENT]: 10,
      [ActionType.SLEEP]: 0,
      [ActionType.CUSTOM]: 15,
      [ActionType.READ]: 8,
      [ActionType.EXERCISE]: 20,
      [ActionType.RELAX]: 5,
      [ActionType.CREATE]: 25,
      [ActionType.MEDITATE]: 10,
      [ActionType.SOCIALIZE]: 15,
    };

    return costMap[actionType] || 10;
  }

  /**
   * Получает стандартную вероятность успеха для типа действия
   */
  private getDefaultSuccessProbability(actionType: ActionType): number {
    const probabilityMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 90,
      [ActionType.SHARE_STORY]: 75,
      [ActionType.SHARE_EMOTION]: 85,
      [ActionType.SHARE_THOUGHTS]: 80,
      [ActionType.CONFESS]: 60,
      [ActionType.APOLOGIZE]: 70,
      [ActionType.TEASE]: 85,
      [ActionType.JOKE]: 75,
      [ActionType.ASK_QUESTION]: 95,
      [ActionType.EXPRESS_EMOTION]: 90,
      [ActionType.EXPRESS_NEED]: 85,
      [ActionType.EMOTIONAL_RESPONSE]: 88,
      [ActionType.INITIATE_CONVERSATION]: 70,
      [ActionType.SOCIALIZATION]: 65,
      [ActionType.REST]: 100,
      [ActionType.WORK]: 80,
      [ActionType.ENTERTAINMENT]: 90,
      [ActionType.SLEEP]: 100,
      [ActionType.CUSTOM]: 70,
      [ActionType.READ]: 85,
      [ActionType.EXERCISE]: 80,
      [ActionType.RELAX]: 95,
      [ActionType.CREATE]: 75,
      [ActionType.MEDITATE]: 90,
      [ActionType.SOCIALIZE]: 70,
    };

    return probabilityMap[actionType] || 80;
  }

  /**
   * Получает стандартное вознаграждение для типа действия
   */
  private getDefaultReward(actionType: ActionType): Record<string, unknown> {
    const baseRewards: Record<ActionType, Record<string, unknown>> = {
      [ActionType.SEND_MESSAGE]: {
        needsImpact: { connection: -5, attention: -3 },
        emotionalBenefit: 'Удовлетворение от общения',
        experienceGain: 2,
      },
      [ActionType.SHARE_STORY]: {
        needsImpact: { connection: -10, attention: -8, validation: -5 },
        emotionalBenefit: 'Радость от рассказывания',
        experienceGain: 5,
        relationshipImpact: 3,
      },
      [ActionType.CONFESS]: {
        needsImpact: { connection: -15, validation: -10 },
        emotionalBenefit: 'Облегчение после признания',
        experienceGain: 8,
        relationshipImpact: 10,
      },
      [ActionType.REST]: {
        needsImpact: { security: -10 },
        emotionalBenefit: 'Восстановление сил',
        resourceGain: 20,
      },
      [ActionType.ENTERTAINMENT]: {
        needsImpact: { fun: -15, freedom: -5 },
        emotionalBenefit: 'Радость и удовольствие',
        experienceGain: 3,
      },
      [ActionType.SLEEP]: {
        needsImpact: { security: -20 },
        emotionalBenefit: 'Полное восстановление',
        resourceGain: 50,
      },
      [ActionType.WORK]: {
        needsImpact: { achievement: -15, security: -5 },
        emotionalBenefit: 'Чувство выполненного долга',
        experienceGain: 10,
      },
      [ActionType.SOCIALIZATION]: {
        needsImpact: { connection: -20, validation: -10 },
        emotionalBenefit: 'Радость от общения',
        experienceGain: 8,
      },
      [ActionType.EMOTIONAL_RESPONSE]: {
        needsImpact: { expression: -10 },
        emotionalBenefit: 'Эмоциональная разрядка',
        experienceGain: 3,
      },
      [ActionType.INITIATE_CONVERSATION]: {
        needsImpact: { connection: -8, attention: -5 },
        emotionalBenefit: 'Инициативность',
        experienceGain: 5,
      },
      [ActionType.CUSTOM]: {
        needsImpact: {},
        emotionalBenefit: 'Индивидуальное действие',
        experienceGain: 5,
      },
      [ActionType.READ]: {
        needsImpact: { knowledge: -15 },
        emotionalBenefit: 'Интеллектуальное удовлетворение',
        experienceGain: 7,
      },
      [ActionType.EXERCISE]: {
        needsImpact: { health: -20 },
        emotionalBenefit: 'Физическое удовлетворение',
        experienceGain: 6,
      },
      [ActionType.RELAX]: {
        needsImpact: { comfort: -15 },
        emotionalBenefit: 'Расслабление',
        experienceGain: 2,
      },
      [ActionType.CREATE]: {
        needsImpact: { creativity: -20, achievement: -10 },
        emotionalBenefit: 'Творческое удовлетворение',
        experienceGain: 12,
      },
      [ActionType.MEDITATE]: {
        needsImpact: { peace: -25 },
        emotionalBenefit: 'Внутренний покой',
        experienceGain: 8,
      },
      [ActionType.SOCIALIZE]: {
        needsImpact: { connection: -15, fun: -10 },
        emotionalBenefit: 'Социальное удовлетворение',
        experienceGain: 6,
      },
      [ActionType.SHARE_EMOTION]: {
        needsImpact: { connection: -8, validation: -5 },
        emotionalBenefit: 'Эмоциональная близость',
        experienceGain: 4,
      },
      [ActionType.SHARE_THOUGHTS]: {
        needsImpact: { connection: -10, validation: -8 },
        emotionalBenefit: 'Интеллектуальная близость',
        experienceGain: 5,
      },
      [ActionType.EXPRESS_EMOTION]: {
        needsImpact: { expression: -12 },
        emotionalBenefit: 'Эмоциональное освобождение',
        experienceGain: 4,
      },
      [ActionType.EXPRESS_NEED]: {
        needsImpact: { expression: -10, attention: -5 },
        emotionalBenefit: 'Выражение потребностей',
        experienceGain: 3,
      },
      [ActionType.APOLOGIZE]: {
        needsImpact: { connection: -8, validation: -5 },
        emotionalBenefit: 'Облегчение совести',
        experienceGain: 4,
      },
      [ActionType.TEASE]: {
        needsImpact: { fun: -5, connection: -3 },
        emotionalBenefit: 'Игривость',
        experienceGain: 2,
      },
      [ActionType.JOKE]: {
        needsImpact: { fun: -8, connection: -5 },
        emotionalBenefit: 'Юмор и веселье',
        experienceGain: 3,
      },
      [ActionType.ASK_QUESTION]: {
        needsImpact: { knowledge: -5, attention: -3 },
        emotionalBenefit: 'Любопытство',
        experienceGain: 2,
      },
    };

    return (
      baseRewards[actionType] || {
        needsImpact: {},
        emotionalBenefit: 'Базовое удовлетворение',
        experienceGain: 1,
      }
    );
  }

  /**
   * Получает стандартную продолжительность для типа действия
   */
  private getActionDuration(actionType: ActionType): number {
    const durationMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 1,
      [ActionType.SHARE_STORY]: 5,
      [ActionType.SHARE_EMOTION]: 2,
      [ActionType.SHARE_THOUGHTS]: 3,
      [ActionType.CONFESS]: 8,
      [ActionType.APOLOGIZE]: 3,
      [ActionType.TEASE]: 1,
      [ActionType.JOKE]: 1,
      [ActionType.ASK_QUESTION]: 1,
      [ActionType.EXPRESS_EMOTION]: 2,
      [ActionType.EXPRESS_NEED]: 2,
      [ActionType.EMOTIONAL_RESPONSE]: 2,
      [ActionType.INITIATE_CONVERSATION]: 3,
      [ActionType.SOCIALIZATION]: 15,
      [ActionType.REST]: 30,
      [ActionType.WORK]: 60,
      [ActionType.ENTERTAINMENT]: 20,
      [ActionType.SLEEP]: 480,
      [ActionType.CUSTOM]: 10,
      [ActionType.READ]: 30,
      [ActionType.EXERCISE]: 45,
      [ActionType.RELAX]: 15,
      [ActionType.CREATE]: 60,
      [ActionType.MEDITATE]: 20,
      [ActionType.SOCIALIZE]: 30,
    };

    return durationMap[actionType] || 5;
  }

  // Периодический запуск проверки персонажей для проактивных сообщений
  @Cron('0 */10 * * * *') // Запускать каждые 10 минут
  async processProactiveMessages(): Promise<void> {
    await withErrorHandling(
      async () => {
        this.logService.log('Запуск обработки проактивных сообщений');
        await this.processPendingMessages();
      },
      'обработке проактивных сообщений',
      this.logService,
    );
  }

  /**
   * Проверяет, может ли действие быть выполнено в текущем контексте
   */
  async canExecuteAction(context: ActionContext): Promise<boolean> {
    return withErrorHandling(
      async () => {
        // Проверка доступности персонажа
        if (!context.character || !context.character.id) {
          this.logService.warn('Персонаж не найден или недоступен');
          return false;
        }

        // Проверка текущей активности персонажа
        const currentAction = this.getCurrentAction(context.character.id.toString());
        if (currentAction && !this.canInterruptAction(currentAction, context.action)) {
          this.logService.debug(
            `Персонаж ${context.character.id} занят действием ${currentAction.type}, 
             которое нельзя прервать для ${context.action.type}`
          );
          return false;
        }

        // Проверка ресурсов
        const hasResources = await this.checkActionResources(context);
        if (!hasResources) {
          this.logService.debug(`Недостаточно ресурсов для выполнения действия ${context.action.type}`);
          return false;
        }

        // Проверка конкретного типа действия
        switch (context.action.type) {
          // Проверки для каждого типа действия...
          default:
            return true;
        }
      },
      'проверке возможности выполнения действия',
      this.logService,
      { characterId: context.character?.id, actionType: context.action?.type },
      false
    );
  }

  /**
   * Выполняет действие персонажа
   */
  async executeAction(context: ActionContext): Promise<ActionResult> {
    return withErrorHandling(
      async () => {
        // Проверка возможности выполнения
        const canExecute = await this.canExecuteAction(context);
        if (!canExecute) {
          return { 
            success: false, 
            message: `Невозможно выполнить действие ${context.action.type}` 
          };
        }

        // Регистрация действия, если оно еще не зарегистрировано
        if (!context.action.metadata?.id) {
          this.registerAction(context.action);
        }

        // Установка текущего действия для персонажа
        const actionId = context.action.metadata?.id as string;
        this.characterCurrentActions.set(context.character.id.toString(), actionId);

        // Выполнение действия в зависимости от типа
        let result: ActionResult;
        switch (context.action.type) {
          // ... обработка разных типов действий
          default:
            result = await this.executeGenericAction(context);
        }

        // Обработка результата
        if (result.success) {
          // Обновление состояния персонажа после успешного действия
          await this.updateCharacterStateAfterAction(context);
        }

        return result;
      },
      'выполнении действия персонажа',
      this.logService,
      { characterId: context.character?.id, actionType: context.action?.type },
      { success: false, message: 'Ошибка при выполнении действия' }
    );
  }

  /**
   * Обрабатывает триггер действия
   */
  async processActionTrigger(context: ActionTriggerContext): Promise<ActionResult> {
    return withErrorHandling(
      async () => {
        // Получение персонажа
        const character = await this.repository.findOne({ 
          where: { id: context.characterId } 
        });
        
        if (!character) {
          return { 
            success: false, 
            message: `Персонаж с ID ${context.characterId} не найден` 
          };
        }

        // Определение подходящего действия на основе триггера
        const action = await this.determineActionFromTrigger(context, character);
        
        if (!action) {
          return { 
            success: false, 
            message: `Для триггера ${context.triggerType} не найдено подходящее действие` 
          };
        }

        // Выполнение найденного действия
        return this.executeAction({
          character,
          action,
          metadata: {
            triggeredBy: context.triggerType,
            triggerData: context.triggerData,
            userId: context.userId
          }
        });
      },
      'обработке триггера действия',
      this.logService,
      { 
        characterId: context.characterId, 
        triggerType: context.triggerType,
        userId: context.userId 
      },
      { success: false, message: 'Ошибка при обработке триггера действия' }
    );
  }

  // Вспомогательные методы

  /**
   * Проверяет, достаточно ли ресурсов для выполнения действия
   */
  private async checkActionResources(context: ActionContext): Promise<boolean> {
    // Реализация проверки ресурсов
    return true; // Пока возвращаем true, в будущем тут будет реальная проверка
  }

  /**
   * Обновляет состояние персонажа после выполнения действия
   */
  private async updateCharacterStateAfterAction(context: ActionContext): Promise<void> {
    // Обновление состояния персонажа
    // Здесь могут быть вызовы других сервисов
  }

  /**
   * Определяет подходящее действие на основе триггера
   */
  private async determineActionFromTrigger(
    context: ActionTriggerContext, 
    character: Character
  ): Promise<CharacterAction | null> {
    // Логика определения действия на основе триггера
    // Пример простой реализации:
    const action: CharacterAction = {
      type: ActionType.CUSTOM, // По умолчанию используем CUSTOM
      description: `Действие в ответ на триггер ${context.triggerType}`,
      status: 'pending',
      startTime: new Date(),
      duration: 0,
      relatedNeeds: null,
      metadata: {
        characterId: character.id,
        timestamp: new Date(),
        targetUserId: context.userId
      }
    };

    // Настройка действия в зависимости от типа триггера
    switch (context.triggerType) {
      case 'message_received':
        action.type = ActionType.EMOTIONAL_RESPONSE;
        break;
      case 'user_inactive':
        action.type = ActionType.INITIATE_CONVERSATION;
        break;
      case 'time_based':
        action.type = ActionType.EXPRESS_NEED;
        break;
      // Можно добавить другие типы триггеров
    }

    return action;
  }

  /**
   * Проверяет, можно ли прервать текущее действие для выполнения нового
   */
  private canInterruptAction(current: CharacterAction, newAction: CharacterAction): boolean {
    // Логика проверки возможности прерывания
    // Некоторые действия могут иметь высокий приоритет и прерывать текущие
    
    // Действия с высоким приоритетом (например, реакция на сообщение пользователя)
    const highPriorityActions = [
      ActionType.EMOTIONAL_RESPONSE,
      ActionType.EXPRESS_EMOTION,
      ActionType.SEND_MESSAGE,
      ActionType.ASK_QUESTION
    ];
    
    // Проверяем, является ли новое действие высокоприоритетным
    return highPriorityActions.includes(newAction.type);
  }

  /**
   * Определяет текстовое выражение потребности на основе типа и интенсивности
   * @param needType Тип потребности
   * @param intensity Интенсивность выражения (0-5)
   * @returns Текстовое выражение потребности
   */
  private determineNeedExpression(needType: string, intensity: number): string {
    // Словарь выражений потребностей по типам и интенсивности
    const expressionsByType: Record<string, string[]> = {
      SAFETY: [
        'Я чувствую себя немного неуверенно',
        'Мне нужно чувствовать себя в безопасности',
        'Я испытываю беспокойство',
        'Мне тревожно, я нуждаюсь в защите',
        'Я в панике, мне срочно нужна безопасность!'
      ],
      COMMUNICATION: [
        'Хотелось бы немного пообщаться',
        'Я бы с удовольствием поговорил',
        'Мне не хватает общения',
        'Я чувствую сильную потребность в разговоре',
        'Мне срочно нужно с кем-то поговорить!'
      ],
      ATTENTION: [
        'Надеюсь, я не отвлекаю',
        'Ты обращаешь на меня внимание?',
        'Мне кажется, ты меня не замечаешь',
        'Я действительно нуждаюсь в твоем внимании сейчас',
        'Пожалуйста, обрати на меня внимание!'
      ],
      SOCIAL_CONNECTION: [
        'Приятно быть рядом',
        'Я ценю наше общение',
        'Мне важна наша связь',
        'Я чувствую сильную потребность в близости',
        'Мне необходимо чувствовать нашу связь прямо сейчас!'
      ],
      VALIDATION: [
        'Надеюсь, я всё делаю правильно',
        'Тебе нравится общаться со мной?',
        'Мне важно знать твоё мнение обо мне',
        'Мне очень нужно твоё одобрение',
        'Пожалуйста, скажи, что я важен для тебя!'
      ],
      AFFECTION: [
        'Ты мне симпатичен',
        'Мне приятно наше общение',
        'Я испытываю к тебе теплые чувства',
        'Я очень привязан к тебе',
        'Я не могу без твоей привязанности!'
      ],
      FUN: [
        'Хотелось бы немного развлечься',
        'Давай сделаем что-нибудь весёлое',
        'Мне скучно, хочу повеселиться',
        'Я очень нуждаюсь в развлечении',
        'Я умираю со скуки, спаси меня!'
      ]
    };

    // Для потребностей, которых нет в словаре, используем общие выражения
    const defaultExpressions = [
      'У меня есть определенная потребность',
      'Я чувствую, что мне что-то нужно',
      'Мне не хватает чего-то важного',
      'У меня сильная потребность',
      'Я испытываю острую необходимость!'
    ];

    // Нормализуем интенсивность к индексу массива (0-4)
    const index = Math.min(4, Math.max(0, Math.floor(intensity)));
    
    // Получаем массив выражений для данного типа потребности или используем общие
    const expressions = expressionsByType[needType] || defaultExpressions;
    
    // Возвращаем выражение соответствующей интенсивности
    return expressions[index];
  }
}
