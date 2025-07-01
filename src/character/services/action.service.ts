import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { ModuleRef } from '@nestjs/core';
import { Character } from '../entities/character.entity';
import { ActionType } from '../enums/action-type.enum';
import { BaseService } from '../../common/base/base.service';
import { CharacterAction } from '../interfaces/behavior.interfaces';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionExecutorService } from './action-executor.service';
import {
  ActionLifecycleService,
  ActionContext,
  ActionResult,
  ActionStats,
} from './action-lifecycle.service';
import { ActionSchedulerService } from './action-scheduler.service';
import { ActionGeneratorService, ActionTriggerContext } from './action-generator.service';
import { IMotivation } from '../interfaces/needs.interfaces';

export interface ActionHandler {
  getSupportedActionTypes(): ActionType[];
  canExecute(context: ActionContext): Promise<boolean>;
  execute(context: ActionContext): Promise<ActionResult>;
  interrupt(context: ActionContext): Promise<void>;
}

/**
 * Фасад для управления действиями персонажей
 * Делегирует работу ActionExecutorService для обеспечения обратной совместимости
 * @deprecated Используйте ActionExecutorService напрямую для новых функций
 */
@Injectable()
export class ActionService extends BaseService implements ActionHandler, OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    logService: LogService,
    @InjectRepository(Character) private repository: Repository<Character>,
    private actionExecutorService: ActionExecutorService,
    private lifecycleService: ActionLifecycleService,
    private schedulerService: ActionSchedulerService,
    private generatorService: ActionGeneratorService,
  ) {
    super(logService);
  }

  async onModuleInit(): Promise<void> {
    this.logInfo('ActionService фасад успешно инициализирован');
  }

  // === ДЕЛЕГИРОВАНИЕ К ActionExecutorService ===

  getSupportedActionTypes(): ActionType[] {
    return this.actionExecutorService.getSupportedActionTypes();
  }

  async canExecute(context: ActionContext): Promise<boolean> {
    return this.actionExecutorService.canExecute(context);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    return this.actionExecutorService.execute(context);
  }

  async interrupt(context: ActionContext): Promise<void> {
    return this.actionExecutorService.interrupt(context);
  }

  // === МЕТОДЫ УПРАВЛЕНИЯ ДЕЙСТВИЯМИ ===

  registerAction(action: CharacterAction): void {
    this.lifecycleService.registerAction(action);
  }

  getAction(actionId: string): CharacterAction | undefined {
    return this.lifecycleService.getAction(actionId);
  }

  getActionsByCharacter(characterId: string): CharacterAction[] {
    return this.lifecycleService.getActionsByCharacter(characterId);
  }

  getCurrentAction(characterId: string): CharacterAction | undefined {
    return this.lifecycleService.getCurrentAction(characterId);
  }

  isPerformingAction(characterId: string): boolean {
    return this.lifecycleService.isPerformingAction(characterId);
  }

  async stopCurrentAction(characterId: string): Promise<boolean> {
    return this.lifecycleService.stopCurrentAction(characterId);
  }

  getActionProgress(characterId: string): number {
    return this.lifecycleService.getActionProgress(characterId);
  }

  updateChatState(characterId: string, userId: string, isActive: boolean): void {
    this.lifecycleService.updateChatState(characterId, userId, isActive);
  }

  // === МЕТОДЫ ПЛАНИРОВАНИЯ ===

  scheduleAction(action: CharacterAction, scheduledFor: Date): void {
    this.schedulerService.scheduleAction(action, scheduledFor);
  }

  cancelScheduledAction(actionId: string): boolean {
    return this.schedulerService.cancelScheduledAction(actionId);
  }

  // === МЕТОДЫ ГЕНЕРАЦИИ ===

  async generateCommunicationAction(
    character: Character,
    prompt: string,
    userId?: string,
  ): Promise<CharacterAction> {
    return this.generatorService.generateCommunicationAction(character, prompt, userId);
  }

  async generateEmotionalAction(
    character: Character,
    emotion: string,
    intensity: number,
  ): Promise<CharacterAction> {
    return this.generatorService.generateEmotionalAction(character, emotion, intensity);
  }

  // === ОСНОВНЫЕ МЕТОДЫ БИЗНЕС-ЛОГИКИ ===

  async determineAndPerformAction(
    character: Character,
    context: ActionTriggerContext,
  ): Promise<CharacterAction | null> {
    return this.actionExecutorService.determineAndPerformAction(character, context);
  }

  async processActionTrigger(context: ActionTriggerContext): Promise<ActionResult> {
    return this.actionExecutorService.processActionTrigger(context);
  }

  async interruptAction(characterId: string): Promise<void> {
    return this.lifecycleService.interruptAction(characterId);
  }

  async completeAction(characterId: string, success: boolean): Promise<void> {
    return this.lifecycleService.completeAction(characterId, success);
  }

  // === СТАТИСТИКА И УПРАВЛЕНИЕ ===

  getActionStats(): ActionStats {
    return this.lifecycleService.getActionStats();
  }

  clearCompletedActions(): number {
    return this.lifecycleService.clearCompletedActions();
  }

  // === РЕСУРСЫ ===

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
    return this.actionExecutorService.createActionWithResources(characterId, actionType, options);
  }

  // === УСТАРЕВШИЕ МЕТОДЫ (для обратной совместимости) ===

  /**
   * @deprecated Используйте processActionTrigger
   */
  async processPendingMessages(): Promise<void> {
    this.logWarning('processPendingMessages устарел, используйте processActionTrigger');
  }

  /**
   * @deprecated Используйте processActionTrigger
   */
  async processProactiveMessages(): Promise<void> {
    this.logWarning('processProactiveMessages устарел, используйте processActionTrigger');
  }

  /**
   * @deprecated Используйте canExecute
   */
  async canExecuteAction(context: ActionContext): Promise<boolean> {
    return this.canExecute(context);
  }

  /**
   * @deprecated Используйте execute
   */
  async executeAction(context: ActionContext): Promise<ActionResult> {
    return this.execute(context);
  }

  /**
   * @deprecated Используйте ActionGeneratorService.determineActionFromTrigger напрямую
   */
  async determineActionFromTrigger(
    context: ActionTriggerContext,
    character: Character,
  ): Promise<CharacterAction | null> {
    return this.generatorService.determineActionFromTrigger(context, character);
  }
}

// Экспорты для обратной совместимости с тестами
export { ActionContext, ActionResult, ActionTriggerContext, ActionStats };
