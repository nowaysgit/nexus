import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { ActionType } from '../enums/action-type.enum';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { ActionContext, ActionResult } from './action-lifecycle.service';
import { NeedsService } from './needs.service';

/**
 * Сервис управления ресурсами действий персонажей
 * Отвечает за проверку доступности ресурсов, расчет стоимости и наград согласно ТЗ ВОЛЯ
 */
@Injectable()
export class ActionResourceService extends BaseService {
  constructor(
    logService: LogService,
    private needsService: NeedsService,
  ) {
    super(logService);
  }

  /**
   * Проверяет доступность ресурсов для выполнения действия
   */
  async checkResourceAvailability(context: ActionContext): Promise<boolean> {
    return this.withErrorHandling('проверке доступности ресурсов', async () => {
      const resourceCost =
        (context.action.metadata?.resourceCost as number) ||
        this.getDefaultResourceCost(context.action.type);

      if (resourceCost <= 0) {
        return true; // Нет затрат ресурсов
      }

      // Получаем текущие потребности персонажа
      const needs = await this.needsService.getActiveNeeds(context.character.id);

      // Проверяем энергию (REST)
      const restNeed = needs.find(need => need.type === CharacterNeedType.REST);
      const currentEnergy = restNeed?.currentValue || 0;

      // Минимальный уровень энергии для выполнения действия
      const minEnergyRequired = Math.max(20, resourceCost);

      if (currentEnergy < minEnergyRequired) {
        this.logDebug(
          `Недостаточно энергии для действия ${context.action.type}: ${currentEnergy} < ${minEnergyRequired}`,
        );
        return false;
      }

      // Дополнительные проверки для специфичных типов действий
      return this.checkSpecificResourceRequirements(context, needs);
    });
  }

  /**
   * Выполняет действие с учетом ресурсов
   */
  async executeActionWithResources(context: ActionContext): Promise<ActionResult> {
    return this.withErrorHandling('выполнении действия с ресурсами', async () => {
      const resourceCost =
        (context.action.metadata?.resourceCost as number) ||
        this.getDefaultResourceCost(context.action.type);
      const successProbability =
        (context.action.metadata?.successProbability as number) ||
        this.getDefaultSuccessProbability(context.action.type);

      // Проверяем доступность ресурсов
      const hasResources = await this.checkResourceAvailability(context);
      if (!hasResources) {
        return {
          success: false,
          message: 'Недостаточно ресурсов для выполнения действия',
          resourceCost: 0,
        };
      }

      // Определяем успешность действия
      const isSuccessful = Math.random() * 100 < successProbability;

      // Рассчитываем фактическую стоимость (может быть меньше при неудаче)
      const actualCost = isSuccessful ? resourceCost : Math.floor(resourceCost * 0.7);

      // Применяем стоимость ресурсов
      await this.applyResourceCost(context.character.id, actualCost);

      // Рассчитываем награды при успехе
      const rewards = isSuccessful ? this.calculateRewards(context) : {};

      // Применяем награды
      if (isSuccessful && Object.keys(rewards).length > 0) {
        await this.applyRewards(context.character.id, rewards);
      }

      return {
        success: isSuccessful,
        message: isSuccessful ? 'Действие выполнено успешно' : 'Действие выполнено частично',
        resourceCost: actualCost,
        actualReward: rewards,
        effectiveness: isSuccessful ? 100 : Math.floor(Math.random() * 50 + 30),
        probabilityUsed: successProbability,
      };
    });
  }

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
  ): any {
    return this.withErrorHandlingSync('создания действия с ресурсами', () => {
      const action = {
        type: actionType,
        description: options.description || `Действие типа ${actionType}`,
        status: 'pending' as const,
        startTime: new Date(),
        duration: this.getActionDuration(actionType),
        relatedNeeds: this.getRelatedNeeds(actionType),
        metadata: {
          id: this.generateActionId(),
          characterId,
          resourceCost: options.resourceCost || this.getDefaultResourceCost(actionType),
          successProbability:
            options.successProbability || this.getDefaultSuccessProbability(actionType),
          potentialReward: options.potentialReward || this.getDefaultReward(actionType),
          timestamp: new Date(),
        },
      };

      this.logInfo(
        `Создано действие ${actionType} с ресурсной стоимостью ${action.metadata.resourceCost}`,
      );
      return action;
    });
  }

  /**
   * Получает стоимость ресурсов по умолчанию для типа действия
   */
  getDefaultResourceCost(actionType: ActionType): number {
    const costMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 10,
      [ActionType.SHARE_STORY]: 25,
      [ActionType.SHARE_EMOTION]: 15,
      [ActionType.SHARE_THOUGHTS]: 20,
      [ActionType.CONFESS]: 40,
      [ActionType.APOLOGIZE]: 30,
      [ActionType.TEASE]: 15,
      [ActionType.JOKE]: 10,
      [ActionType.ASK_QUESTION]: 12,
      [ActionType.EXPRESS_EMOTION]: 20,
      [ActionType.EXPRESS_NEED]: 25,
      [ActionType.EMOTIONAL_RESPONSE]: 15,
      [ActionType.INITIATE_CONVERSATION]: 35,
      [ActionType.SOCIALIZATION]: 30,
      [ActionType.REST]: -20, // Восстанавливает энергию
      [ActionType.WORK]: 50,
      [ActionType.ENTERTAINMENT]: 20,
      [ActionType.CUSTOM]: 25,
      [ActionType.SLEEP]: -30, // Восстанавливает много энергии
      [ActionType.READ]: 15,
      [ActionType.EXERCISE]: 40,
      [ActionType.RELAX]: -15, // Восстанавливает энергию
      [ActionType.CREATE]: 35,
      [ActionType.MEDITATE]: -10, // Восстанавливает энергию
      [ActionType.SOCIALIZE]: 25,
    };

    return costMap[actionType] || 25;
  }

  /**
   * Получает вероятность успеха по умолчанию для типа действия
   */
  getDefaultSuccessProbability(actionType: ActionType): number {
    const probabilityMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 85,
      [ActionType.SHARE_STORY]: 70,
      [ActionType.SHARE_EMOTION]: 80,
      [ActionType.SHARE_THOUGHTS]: 75,
      [ActionType.CONFESS]: 60,
      [ActionType.APOLOGIZE]: 70,
      [ActionType.TEASE]: 75,
      [ActionType.JOKE]: 80,
      [ActionType.ASK_QUESTION]: 90,
      [ActionType.EXPRESS_EMOTION]: 85,
      [ActionType.EXPRESS_NEED]: 80,
      [ActionType.EMOTIONAL_RESPONSE]: 85,
      [ActionType.INITIATE_CONVERSATION]: 65,
      [ActionType.SOCIALIZATION]: 70,
      [ActionType.REST]: 95,
      [ActionType.WORK]: 75,
      [ActionType.ENTERTAINMENT]: 85,
      [ActionType.CUSTOM]: 70,
      [ActionType.SLEEP]: 98, // Почти всегда успешно
      [ActionType.READ]: 85,
      [ActionType.EXERCISE]: 80,
      [ActionType.RELAX]: 90,
      [ActionType.CREATE]: 70,
      [ActionType.MEDITATE]: 88,
      [ActionType.SOCIALIZE]: 75,
    };

    return probabilityMap[actionType] || 70;
  }

  /**
   * Получает награды по умолчанию для типа действия
   */
  getDefaultReward(actionType: ActionType): Record<string, unknown> {
    const rewardMap: Record<ActionType, Record<string, unknown>> = {
      [ActionType.SEND_MESSAGE]: { communication: 15, attention: 10 },
      [ActionType.SHARE_STORY]: { communication: 25, attention: 20, validation: 15 },
      [ActionType.SHARE_EMOTION]: { communication: 20, emotional_connection: 25 },
      [ActionType.SHARE_THOUGHTS]: {
        communication: 20,
        validation: 15,
        intellectual_stimulation: 10,
      },
      [ActionType.CONFESS]: { emotional_connection: 40, vulnerability: 30, trust: 25 },
      [ActionType.APOLOGIZE]: { relationship_repair: 30, emotional_connection: 20 },
      [ActionType.TEASE]: { fun: 20, social_connection: 15 },
      [ActionType.JOKE]: { fun: 25, attention: 15, social_connection: 10 },
      [ActionType.ASK_QUESTION]: { communication: 15, curiosity_satisfaction: 20 },
      [ActionType.EXPRESS_EMOTION]: { emotional_release: 30, authenticity: 20 },
      [ActionType.EXPRESS_NEED]: { self_advocacy: 25, communication: 15 },
      [ActionType.EMOTIONAL_RESPONSE]: { empathy: 20, emotional_connection: 25 },
      [ActionType.INITIATE_CONVERSATION]: { communication: 30, social_connection: 25 },
      [ActionType.SOCIALIZATION]: { social_connection: 35, fun: 20 },
      [ActionType.REST]: { energy: 40, stress_relief: 30 },
      [ActionType.WORK]: { accomplishment: 30, productivity: 25 },
      [ActionType.ENTERTAINMENT]: { fun: 35, stress_relief: 20 },
      [ActionType.CUSTOM]: { general_satisfaction: 20 },
      [ActionType.SLEEP]: { energy: 60, health: 40, stress_relief: 50 },
      [ActionType.READ]: { knowledge: 30, intellectual_stimulation: 25 },
      [ActionType.EXERCISE]: { health: 40, energy: 20, accomplishment: 15 },
      [ActionType.RELAX]: { stress_relief: 35, energy: 25 },
      [ActionType.CREATE]: { creativity: 40, accomplishment: 30, self_expression: 25 },
      [ActionType.MEDITATE]: { inner_peace: 35, stress_relief: 30, mindfulness: 25 },
      [ActionType.SOCIALIZE]: { social_connection: 30, fun: 25 },
    };

    return rewardMap[actionType] || { general_satisfaction: 15 };
  }

  /**
   * Проверяет специфичные требования к ресурсам для разных типов действий
   */
  private async checkSpecificResourceRequirements(
    context: ActionContext,
    needs: any[],
  ): Promise<boolean> {
    const actionType = context.action.type;

    switch (actionType) {
      case ActionType.SOCIALIZATION:
      case ActionType.INITIATE_CONVERSATION:
        // Требует минимальный уровень коммуникации
        const commNeed = needs.find(need => need.type === CharacterNeedType.COMMUNICATION);
        return (commNeed?.currentValue || 0) >= 30;

      case ActionType.WORK:
        // Требует высокий уровень энергии
        const restNeed = needs.find(need => need.type === CharacterNeedType.REST);
        return (restNeed?.currentValue || 0) >= 60;

      case ActionType.CONFESS:
        // Требует эмоциональную готовность
        const emotionalReadiness = needs.find(need => need.type === CharacterNeedType.VALIDATION);
        return (emotionalReadiness?.currentValue || 0) >= 40;

      default:
        return true;
    }
  }

  /**
   * Применяет стоимость ресурсов к персонажу
   */
  private async applyResourceCost(characterId: number, cost: number): Promise<void> {
    if (cost > 0) {
      await this.needsService.updateNeed(characterId, {
        type: CharacterNeedType.REST,
        change: -cost,
        reason: 'Затраты энергии на действие',
      });
    } else if (cost < 0) {
      // Отрицательная стоимость = восстановление ресурсов
      await this.needsService.updateNeed(characterId, {
        type: CharacterNeedType.REST,
        change: Math.abs(cost),
        reason: 'Восстановление энергии',
      });
    }
  }

  /**
   * Применяет награды к персонажу
   */
  private async applyRewards(characterId: number, rewards: Record<string, unknown>): Promise<void> {
    for (const [rewardType, value] of Object.entries(rewards)) {
      if (typeof value === 'number') {
        // Мапим типы наград на типы потребностей
        const needType = this.mapRewardToNeedType(rewardType);
        if (needType) {
          await this.needsService.updateNeed(characterId, {
            type: needType,
            change: value,
            reason: `Награда за действие: ${rewardType}`,
          });
        }
      }
    }
  }

  /**
   * Рассчитывает награды для действия
   */
  private calculateRewards(context: ActionContext): Record<string, unknown> {
    const baseRewards = this.getDefaultReward(context.action.type);
    const potentialReward = context.action.metadata?.potentialReward as Record<string, unknown>;

    // Объединяем базовые и потенциальные награды
    return { ...baseRewards, ...potentialReward };
  }

  /**
   * Мапит тип награды на тип потребности
   */
  private mapRewardToNeedType(rewardType: string): CharacterNeedType | null {
    const mapping: Record<string, CharacterNeedType> = {
      communication: CharacterNeedType.COMMUNICATION,
      attention: CharacterNeedType.ATTENTION,
      validation: CharacterNeedType.VALIDATION,
      social_connection: CharacterNeedType.SOCIAL_CONNECTION,
      fun: CharacterNeedType.FUN,
      energy: CharacterNeedType.REST,
      affection: CharacterNeedType.AFFECTION,
    };

    return mapping[rewardType] || null;
  }

  /**
   * Получает продолжительность действия в секундах
   */
  private getActionDuration(actionType: ActionType): number {
    const durationMap: Record<ActionType, number> = {
      [ActionType.SEND_MESSAGE]: 30,
      [ActionType.SHARE_STORY]: 180,
      [ActionType.SHARE_EMOTION]: 90,
      [ActionType.SHARE_THOUGHTS]: 120,
      [ActionType.CONFESS]: 300,
      [ActionType.APOLOGIZE]: 150,
      [ActionType.TEASE]: 45,
      [ActionType.JOKE]: 30,
      [ActionType.ASK_QUESTION]: 60,
      [ActionType.EXPRESS_EMOTION]: 90,
      [ActionType.EXPRESS_NEED]: 120,
      [ActionType.EMOTIONAL_RESPONSE]: 75,
      [ActionType.INITIATE_CONVERSATION]: 180,
      [ActionType.SOCIALIZATION]: 600, // 10 минут
      [ActionType.REST]: 1800, // 30 минут
      [ActionType.WORK]: 3600, // 1 час
      [ActionType.ENTERTAINMENT]: 1200, // 20 минут
      [ActionType.CUSTOM]: 300,
      [ActionType.SLEEP]: 28800, // 8 часов
      [ActionType.READ]: 1800, // 30 минут
      [ActionType.EXERCISE]: 2700, // 45 минут
      [ActionType.RELAX]: 900, // 15 минут
      [ActionType.CREATE]: 3600, // 1 час
      [ActionType.MEDITATE]: 1200, // 20 минут
      [ActionType.SOCIALIZE]: 1800, // 30 минут
    };

    return durationMap[actionType] || 300; // По умолчанию 5 минут
  }

  /**
   * Получает связанные потребности для типа действия
   */
  private getRelatedNeeds(actionType: ActionType): string[] | null {
    const needsMap: Record<ActionType, string[]> = {
      [ActionType.SEND_MESSAGE]: [CharacterNeedType.COMMUNICATION],
      [ActionType.SHARE_STORY]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.VALIDATION],
      [ActionType.SHARE_EMOTION]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.SHARE_THOUGHTS]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.VALIDATION],
      [ActionType.CONFESS]: [CharacterNeedType.SOCIAL_CONNECTION, CharacterNeedType.VALIDATION],
      [ActionType.APOLOGIZE]: [CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.TEASE]: [CharacterNeedType.FUN, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.JOKE]: [CharacterNeedType.FUN, CharacterNeedType.ATTENTION],
      [ActionType.ASK_QUESTION]: [CharacterNeedType.COMMUNICATION],
      [ActionType.EXPRESS_EMOTION]: [CharacterNeedType.COMMUNICATION],
      [ActionType.EXPRESS_NEED]: [CharacterNeedType.COMMUNICATION],
      [ActionType.EMOTIONAL_RESPONSE]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.INITIATE_CONVERSATION]: [CharacterNeedType.COMMUNICATION, CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.SOCIALIZATION]: [CharacterNeedType.SOCIAL_CONNECTION],
      [ActionType.REST]: [CharacterNeedType.REST],
      [ActionType.WORK]: [CharacterNeedType.REST],
      [ActionType.ENTERTAINMENT]: [CharacterNeedType.FUN],
      [ActionType.CUSTOM]: [],
      [ActionType.SLEEP]: [CharacterNeedType.REST],
      [ActionType.READ]: [CharacterNeedType.FUN],
      [ActionType.EXERCISE]: [CharacterNeedType.REST],
      [ActionType.RELAX]: [CharacterNeedType.REST],
      [ActionType.CREATE]: [CharacterNeedType.FUN],
      [ActionType.MEDITATE]: [CharacterNeedType.REST],
      [ActionType.SOCIALIZE]: [CharacterNeedType.SOCIAL_CONNECTION],
    };

    return needsMap[actionType] || null;
  }

  /**
   * Генерирует уникальный ID для действия
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
