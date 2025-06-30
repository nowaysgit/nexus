import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { ActionType } from '../enums/action-type.enum';
import { CharacterAction } from '../interfaces/behavior.interfaces';

export interface ActionContext {
  character: Character;
  action: CharacterAction;
  metadata?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  needsImpact?: Record<string, number>;
  resourceCost?: number;
  actualReward?: Record<string, unknown>;
  effectiveness?: number;
  sideEffects?: string[];
  probabilityUsed?: number;
}

export interface ActionStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

/**
 * Сервис управления жизненным циклом действий персонажей
 * Отвечает за регистрацию, выполнение, прерывание и отслеживание статистики действий
 */
@Injectable()
export class ActionLifecycleService extends BaseService {
  // Реестр действий и состояний
  private actionRegistry = new Map<string, CharacterAction>();
  private characterCurrentActions = new Map<string, string>(); // characterId -> actionId
  private characterChatStates = new Map<string, { userId: string; isActive: boolean }>();

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

  constructor(logService: LogService) {
    super(logService);
  }

  /**
   * Получает список поддерживаемых типов действий
   */
  getSupportedActionTypes(): ActionType[] {
    return [...ActionLifecycleService.SUPPORTED_ACTIONS];
  }

  /**
   * Регистрирует действие в системе
   */
  registerAction(action: CharacterAction): void {
    return this.withErrorHandlingSync('регистрации действия', () => {
      const actionId = (action.metadata?.id as string) || this.generateActionId();
      action.metadata = { ...action.metadata, id: actionId };
      this.actionRegistry.set(actionId, action);
      this.logInfo(`Действие ${action.type} зарегистрировано с ID: ${actionId}`);
    });
  }

  /**
   * Получает действие по ID
   */
  getAction(actionId: string): CharacterAction | undefined {
    return this.actionRegistry.get(actionId);
  }

  /**
   * Получает все действия персонажа
   */
  getActionsByCharacter(characterId: string): CharacterAction[] {
    return Array.from(this.actionRegistry.values()).filter(
      action => action.metadata?.characterId === parseInt(characterId),
    );
  }

  /**
   * Получает текущее действие персонажа
   */
  getCurrentAction(characterId: string): CharacterAction | undefined {
    const actionId = this.characterCurrentActions.get(characterId);
    return actionId ? this.actionRegistry.get(actionId) : undefined;
  }

  /**
   * Проверяет, выполняет ли персонаж действие
   */
  isPerformingAction(characterId: string): boolean {
    const currentAction = this.getCurrentAction(characterId);
    return currentAction?.status === 'in_progress';
  }

  /**
   * Останавливает текущее действие персонажа
   */
  async stopCurrentAction(characterId: string): Promise<boolean> {
    return this.withErrorHandling('остановке текущего действия', async () => {
      const actionId = this.characterCurrentActions.get(characterId);
      if (!actionId) {
        return false;
      }

      const action = this.actionRegistry.get(actionId);
      if (action) {
        action.status = 'cancelled';
        action.endTime = new Date();
        this.characterCurrentActions.delete(characterId);
        this.logInfo(`Действие ${action.type} остановлено для персонажа ${characterId}`);
        return true;
      }

      return false;
    });
  }

  /**
   * Получает прогресс выполнения действия персонажа (0-100)
   */
  getActionProgress(characterId: string): number {
    const action = this.getCurrentAction(characterId);
    if (!action || action.status !== 'in_progress') {
      return 0;
    }

    const startTime = action.startTime?.getTime() || Date.now();
    const duration = action.duration || 0;
    const elapsed = Date.now() - startTime;

    return Math.min(100, Math.max(0, (elapsed / (duration * 1000)) * 100));
  }

  /**
   * Обновляет состояние чата персонажа
   */
  updateChatState(characterId: string, userId: string, isActive: boolean): void {
    this.withErrorHandlingSync('обновлении состояния чата', () => {
      this.characterChatStates.set(characterId, { userId, isActive });
      this.logDebug(
        `Состояние чата обновлено для персонажа ${characterId}: ${isActive ? 'активен' : 'неактивен'}`,
      );
    });
  }

  /**
   * Прерывает действие
   */
  async interruptAction(characterId: string): Promise<void> {
    return this.withErrorHandling('прерывании действия', async () => {
      const actionId = this.characterCurrentActions.get(characterId);
      if (actionId) {
        const action = this.actionRegistry.get(actionId);
        if (action) {
          action.status = 'cancelled';
          action.endTime = new Date();
          this.characterCurrentActions.delete(characterId);
          this.logInfo(`Действие ${action.type} прервано для персонажа ${characterId}`);
        }
      }
    });
  }

  /**
   * Завершает действие
   */
  async completeAction(characterId: string, success: boolean): Promise<void> {
    return this.withErrorHandling('завершении действия', async () => {
      const actionId = this.characterCurrentActions.get(characterId);
      if (actionId) {
        const action = this.actionRegistry.get(actionId);
        if (action) {
          action.status = success ? 'completed' : 'failed';
          action.endTime = new Date();
          this.characterCurrentActions.delete(characterId);
          this.logInfo(
            `Действие ${action.type} ${success ? 'завершено' : 'провалено'} для персонажа ${characterId}`,
          );
        }
      }
    });
  }

  /**
   * Получает статистику действий
   */
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

  /**
   * Очищает завершенные действия
   */
  clearCompletedActions(): number {
    return this.withErrorHandlingSync('очистке завершенных действий', () => {
      const completedActions = Array.from(this.actionRegistry.entries()).filter(
        ([, action]) => action.status === 'completed' || action.status === 'failed',
      );

      completedActions.forEach(([actionId]) => {
        this.actionRegistry.delete(actionId);
      });

      this.logInfo(`Очищено ${completedActions.length} завершенных действий`);
      return completedActions.length;
    });
  }

  /**
   * Очищает все действия (используется в тестах)
   */
  clearAllActions(): void {
    this.withErrorHandlingSync('очистке всех действий', () => {
      this.actionRegistry.clear();
      this.characterCurrentActions.clear();
      this.characterChatStates.clear();
      this.logDebug('Все действия очищены');
    });
  }

  /**
   * Проверяет, можно ли прервать текущее действие для выполнения нового
   */
  canInterruptAction(current: CharacterAction, newAction: CharacterAction): boolean {
    // Действия с высоким приоритетом
    const highPriorityActions = [
      ActionType.EMOTIONAL_RESPONSE,
      ActionType.EXPRESS_EMOTION,
      ActionType.SEND_MESSAGE,
      ActionType.ASK_QUESTION,
    ];

    return highPriorityActions.includes(newAction.type);
  }

  /**
   * Устанавливает текущее действие для персонажа
   */
  setCurrentAction(characterId: string, actionId: string): void {
    this.characterCurrentActions.set(characterId, actionId);
  }

  /**
   * Генерирует уникальный ID для действия
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
