import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { Character } from '../entities/character.entity';
import { ActionType } from '../enums/action-type.enum';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { CharacterAction } from '../interfaces/behavior.interfaces';
import {
  ActionLifecycleService,
  ActionContext,
  ActionResult,
  ActionStats,
} from './action-lifecycle.service';
import { ActionSchedulerService, ActionTimer } from './action-scheduler.service';
import { ActionResourceService } from './action-resource.service';
import { ActionGeneratorService, ActionTriggerContext } from './action-generator.service';
import { NeedsService } from './needs.service';
import { MemoryService } from './memory.service';
import { MemoryType } from '../interfaces/memory.interfaces';

/**
 * Координирующий сервис для управления действиями персонажей
 * Объединяет функциональность всех специализированных action-сервисов
 * Предоставляет единый интерфейс для работы с действиями
 */
@Injectable()
export class ActionExecutorService extends BaseService implements OnModuleInit {
  private needsService?: NeedsService;
  private memoryService?: MemoryService;

  constructor(
    private moduleRef: ModuleRef,
    logService: LogService,
    @InjectRepository(Character) private repository: Repository<Character>,
    private lifecycleService: ActionLifecycleService,
    private schedulerService: ActionSchedulerService,
    private resourceService: ActionResourceService,
    private generatorService: ActionGeneratorService,
  ) {
    super(logService);
  }

  async onModuleInit(): Promise<void> {
    try {
      this.needsService = this.moduleRef.get('NeedsService', { strict: false });
      this.memoryService = this.moduleRef.get('MemoryService', { strict: false });
      this.logInfo('ActionExecutorService успешно инициализирован');
    } catch (error) {
      this.logError(
        `Не удалось инициализировать сервисы: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // === ОСНОВНЫЕ МЕТОДЫ ИНТЕРФЕЙСА ===

  /**
   * Получает поддерживаемые типы действий
   */
  getSupportedActionTypes(): ActionType[] {
    return this.lifecycleService.getSupportedActionTypes();
  }

  /**
   * Проверяет возможность выполнения действия
   */
  async canExecute(context: ActionContext): Promise<boolean> {
    try {
      const result = await this.withErrorHandling(
        `проверке возможности выполнения действия ${context.action.type}`,
        async () => {
          const actionType = context.action.type;

          // Проверяем поддержку типа действия
          if (!this.getSupportedActionTypes().includes(actionType)) {
            this.logDebug(`Тип действия ${actionType} не поддерживается`);
            return false;
          }

          // Проверяем, не выполняется ли уже другое действие
          const currentActionId = this.lifecycleService.getCurrentAction(
            context.character.id.toString(),
          )?.metadata?.id;
          if (currentActionId && currentActionId !== context.action.metadata?.id) {
            const currentAction = this.lifecycleService.getAction(currentActionId as string);
            if (currentAction && currentAction.status === 'in_progress') {
              this.logDebug(
                `Персонаж ${context.character.id} уже выполняет действие ${currentAction.type}`,
              );
              return false;
            }
          }

          // Проверяем ресурсы
          const hasResources = await this.resourceService.checkResourceAvailability(context);
          if (!hasResources) {
            this.logDebug(`Недостаточно ресурсов для действия ${actionType}`);
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
      );

      // Гарантируем, что всегда возвращаем boolean
      return Boolean(result);
    } catch (error) {
      this.logError(
        `Ошибка проверки canExecute: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false; // При ошибке возвращаем false
    }
  }

  /**
   * Выполняет действие
   */
  async execute(context: ActionContext): Promise<ActionResult> {
    return this.withErrorHandling(`выполнении действия ${context.action.type}`, async () => {
      const canExecute = await this.canExecute(context);
      if (!canExecute) {
        return {
          success: false,
          message: `Действие ${context.action.type} не может быть выполнено`,
        };
      }

      // Регистрируем действие
      this.lifecycleService.registerAction(context.action);
      const actionId = context.action.metadata?.id as string;
      this.lifecycleService.setCurrentAction(context.character.id.toString(), actionId);

      // Обновляем статус
      context.action.status = 'in_progress';
      context.action.startTime = new Date();

      let result: ActionResult;

      try {
        // Выполняем действие с учетом ресурсов
        result = await this.resourceService.executeActionWithResources(context);

        // Обновляем состояние персонажа
        await this.updateCharacterStateAfterAction(context, result);

        // Сохраняем в память
        await this.saveActionToMemory(context, result);

        // Завершаем действие
        await this.lifecycleService.completeAction(context.character.id.toString(), result.success);
      } catch (error) {
        result = {
          success: false,
          message: `Ошибка выполнения действия: ${error instanceof Error ? error.message : String(error)}`,
        };
        await this.lifecycleService.completeAction(context.character.id.toString(), false);
      }

      this.logInfo(
        `Действие ${context.action.type} ${result.success ? 'выполнено' : 'провалено'} для персонажа ${context.character.id}`,
      );
      return result;
    });
  }

  /**
   * Прерывает действие
   */
  async interrupt(context: ActionContext): Promise<void> {
    return this.withErrorHandling(`прерывании действия ${context.action.type}`, async () => {
      await this.lifecycleService.interruptAction(context.character.id.toString());
      context.action.status = 'cancelled';
      context.action.endTime = new Date();
    });
  }

  // === МЕТОДЫ ГЕНЕРАЦИИ ДЕЙСТВИЙ ===

  /**
   * Генерирует коммуникационное действие
   */
  async generateCommunicationAction(
    character: Character,
    prompt: string,
    userId?: string,
  ): Promise<CharacterAction> {
    return this.generatorService.generateCommunicationAction(character, prompt, userId);
  }

  /**
   * Генерирует эмоциональное действие
   */
  async generateEmotionalAction(
    character: Character,
    emotion: string,
    intensity: number,
  ): Promise<CharacterAction> {
    return this.generatorService.generateEmotionalAction(character, emotion, intensity);
  }

  /**
   * Определяет и выполняет действие на основе триггера
   */
  async determineAndPerformAction(
    character: Character,
    context: ActionTriggerContext,
  ): Promise<CharacterAction | null> {
    return this.withErrorHandling('определении и выполнении действия по триггеру', async () => {
      // Генерируем действие на основе триггера
      const action = await this.generatorService.determineActionFromTrigger(context, character);
      if (!action) {
        return null;
      }

      // Проверяем возможность прерывания текущего действия
      const currentAction = this.lifecycleService.getCurrentAction(character.id.toString());
      if (currentAction && !this.lifecycleService.canInterruptAction(currentAction, action)) {
        this.logDebug(
          `Невозможно прервать текущее действие ${currentAction.type} для выполнения ${action.type}`,
        );
        return null;
      }

      // Выполняем действие
      const actionContext: ActionContext = {
        character,
        action,
        metadata: {
          triggeredBy: context.triggerType,
          triggerData: context.triggerData,
          userId: context.userId,
        },
      };

      const result = await this.execute(actionContext);
      return result.success ? action : null;
    });
  }

  /**
   * Обрабатывает триггер действия
   */
  async processActionTrigger(context: ActionTriggerContext): Promise<ActionResult> {
    return this.withErrorHandling('обработке триггера действия', async () => {
      const character = await this.repository.findOne({ where: { id: context.characterId } });
      if (!character) {
        return {
          success: false,
          message: `Персонаж с ID ${context.characterId} не найден`,
        };
      }

      const action = await this.determineAndPerformAction(character, context);
      if (!action) {
        return {
          success: false,
          message: 'Не удалось определить подходящее действие для триггера',
        };
      }

      return {
        success: true,
        message: `Действие ${action.type} успешно выполнено по триггеру ${context.triggerType}`,
        data: { actionId: action.metadata?.id, actionType: action.type },
      };
    });
  }

  // === МЕТОДЫ ПЛАНИРОВАНИЯ ===

  /**
   * Планирует действие
   */
  scheduleAction(action: CharacterAction, scheduledFor: Date): void {
    this.schedulerService.scheduleAction(action, scheduledFor);
  }

  /**
   * Отменяет запланированное действие
   */
  cancelScheduledAction(actionId: string): boolean {
    return this.schedulerService.cancelScheduledAction(actionId);
  }

  /**
   * Получает все запланированные действия
   */
  getScheduledActions(): ActionTimer[] {
    return this.schedulerService.getScheduledActionsAsTimers();
  }

  // === МЕТОДЫ УПРАВЛЕНИЯ СОСТОЯНИЕМ ===

  /**
   * Регистрирует действие
   */
  registerAction(action: CharacterAction): void {
    this.lifecycleService.registerAction(action);
  }

  /**
   * Получает действие по ID
   */
  getAction(actionId: string): CharacterAction | undefined {
    return this.lifecycleService.getAction(actionId);
  }

  /**
   * Получает действия персонажа
   */
  getActionsByCharacter(characterId: string): CharacterAction[] {
    return this.lifecycleService.getActionsByCharacter(characterId);
  }

  /**
   * Получает текущее действие персонажа
   */
  getCurrentAction(characterId: string): CharacterAction | undefined {
    return this.lifecycleService.getCurrentAction(characterId);
  }

  /**
   * Проверяет, выполняет ли персонаж действие
   */
  isPerformingAction(characterId: string): boolean {
    return this.lifecycleService.isPerformingAction(characterId);
  }

  /**
   * Останавливает текущее действие
   */
  async stopCurrentAction(characterId: string): Promise<boolean> {
    return this.lifecycleService.stopCurrentAction(characterId);
  }

  /**
   * Получает прогресс действия
   */
  getActionProgress(characterId: string): number {
    return this.lifecycleService.getActionProgress(characterId);
  }

  /**
   * Обновляет состояние чата
   */
  updateChatState(characterId: string, userId: string, isActive: boolean): void {
    this.lifecycleService.updateChatState(characterId, userId, isActive);
  }

  /**
   * Получает статистику действий
   */
  getActionStats(): ActionStats {
    return this.lifecycleService.getActionStats();
  }

  /**
   * Очищает завершенные действия
   */
  clearCompletedActions(): number {
    return this.lifecycleService.clearCompletedActions();
  }

  // === МЕТОДЫ РЕСУРСОВ ===

  /**
   * Создает действие с настройками ресурсов
   */
  createActionWithResources(
    characterId: number,
    actionType: ActionType,
    options: {
      resourceCost?: number;
      successProbability?: number;
      potentialReward?: Record<string, unknown>;
      description?: string;
    } = {},
  ): CharacterAction {
    return this.resourceService.createActionWithResources(characterId, actionType, options);
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  /**
   * Проверяет возможность выполнения сообщения
   */
  private async canExecuteMessage(context: ActionContext): Promise<boolean> {
    // Проверяем наличие промпта или контента
    const hasContent = !!(context.action.metadata?.prompt || context.action.description);
    if (!hasContent) {
      return false;
    }

    // Проверяем коммуникационные потребности
    if (this.needsService) {
      const needs = await this.needsService.getActiveNeeds(context.character.id);
      const commNeed = needs.find(need => need.type === CharacterNeedType.COMMUNICATION);
      return (commNeed?.currentValue || 0) >= 20;
    }

    return true;
  }

  /**
   * Проверяет возможность выполнения эмоционального действия
   */
  private async canExecuteEmotion(_context: ActionContext): Promise<boolean> {
    // Эмоциональные действия всегда доступны
    return true;
  }

  /**
   * Проверяет возможность выражения потребности
   */
  private async canExecuteNeed(context: ActionContext): Promise<boolean> {
    const needType = context.action.metadata?.needType as CharacterNeedType;
    if (!needType || !this.needsService) {
      return false;
    }

    const needs = await this.needsService.getActiveNeeds(context.character.id);
    const need = needs.find(n => n.type === needType);
    return (need?.currentValue || 0) < 50; // Можем выражать потребность только при низком уровне
  }

  /**
   * Обновляет состояние персонажа после выполнения действия
   */
  private async updateCharacterStateAfterAction(
    context: ActionContext,
    result: ActionResult,
  ): Promise<void> {
    if (
      !this.needsService ||
      !context.action.relatedNeeds ||
      !Array.isArray(context.action.relatedNeeds)
    ) {
      return;
    }

    const characterId = context.character.id;

    for (const need of context.action.relatedNeeds) {
      if (typeof need === 'object' && need !== null) {
        const typedNeed = need as { needType?: string; impact?: number };
        const needType = typedNeed.needType;
        const impact = typedNeed.impact;

        if (needType && typeof impact === 'number') {
          await this.needsService.updateNeed(characterId, {
            type: needType as CharacterNeedType,
            change: impact,
            reason: `Влияние действия ${context.action.type}`,
          });
        }
      } else if (typeof need === 'string') {
        await this.needsService.updateNeed(characterId, {
          type: need,
          change: result.success ? 10 : -5,
          reason: `Влияние действия ${context.action.type}`,
        });
      }
    }
  }

  /**
   * Сохраняет действие в память персонажа
   */
  private async saveActionToMemory(context: ActionContext, result: ActionResult): Promise<void> {
    if (!this.memoryService) {
      return;
    }

    try {
      const memoryContent = {
        actionType: context.action.type,
        description: context.action.description,
        success: result.success,
        timestamp: new Date(),
        metadata: context.action.metadata,
        result: {
          message: result.message,
          effectiveness: result.effectiveness,
          resourceCost: result.resourceCost,
        },
      };

      await this.memoryService.createMemory(
        context.character.id,
        JSON.stringify(memoryContent),
        MemoryType.EVENT,
        result.success ? 7 : 3, // importance от 1 до 10
        {
          actionType: context.action.type,
          success: result.success,
        },
      );

      this.logDebug(
        `Действие ${context.action.type} сохранено в память персонажа ${context.character.id}`,
      );
    } catch (error) {
      this.logError(
        `Ошибка сохранения действия в память: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
