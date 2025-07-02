import { Injectable } from '@nestjs/common';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { INeed, INeedUpdate } from '../../../src/character/interfaces/needs.interfaces';

/**
 * Мок для NeedsService для использования в тестах
 */
@Injectable()
export class MockNeedsService {
  /**
   * Получает активные потребности персонажа
   */
  async getActiveNeeds(characterId: number): Promise<INeed[]> {
    return [
      {
        id: 1,
        characterId,
        type: CharacterNeedType.COMMUNICATION,
        currentValue: 50,
        maxValue: 100,
        threshold: 80,
        priority: 5,
        growthRate: 1.0,
        decayRate: 0.5,
        lastUpdated: new Date(),
        isActive: true,
        dynamicPriority: 1.0,
      },
      {
        id: 2,
        characterId,
        type: CharacterNeedType.STABILITY,
        currentValue: 60,
        maxValue: 100,
        threshold: 70,
        priority: 4,
        growthRate: 0.8,
        decayRate: 0.3,
        lastUpdated: new Date(),
        isActive: true,
        dynamicPriority: 1.0,
      },
      {
        id: 3,
        characterId,
        type: CharacterNeedType.SECURITY,
        currentValue: 70,
        maxValue: 100,
        threshold: 60,
        priority: 3,
        growthRate: 0.6,
        decayRate: 0.2,
        lastUpdated: new Date(),
        isActive: true,
        dynamicPriority: 1.0,
      },
      {
        id: 4,
        characterId,
        type: CharacterNeedType.REST,
        currentValue: 80,
        maxValue: 100,
        threshold: 50,
        priority: 2,
        growthRate: 0.5,
        decayRate: 0.1,
        lastUpdated: new Date(),
        isActive: true,
        dynamicPriority: 1.0,
      },
    ];
  }

  /**
   * Получает все потребности персонажа
   */
  async getNeedsByCharacter(characterId: number): Promise<INeed[]> {
    return this.getActiveNeeds(characterId);
  }

  /**
   * Обновляет потребность персонажа
   */
  async updateNeed(characterId: number, update: INeedUpdate): Promise<INeed> {
    return {
      id: 1,
      characterId,
      type: update.type,
      currentValue: 50 + update.change,
      maxValue: 100,
      threshold: 80,
      priority: 5,
      growthRate: 1.0,
      decayRate: 0.5,
      lastUpdated: new Date(),
      isActive: true,
      dynamicPriority: 1.0,
    };
  }

  /**
   * Обрабатывает рост потребностей
   */
  async processNeedsGrowth(characterId: number): Promise<INeed[]> {
    return this.getActiveNeeds(characterId);
  }

  /**
   * Сбрасывает потребность после удовлетворения
   */
  async resetNeed(characterId: number, needType: CharacterNeedType): Promise<void> {
    // Ничего не делаем, это мок
    return;
  }

  /**
   * Создает базовые потребности для нового персонажа
   */
  async createDefaultNeeds(characterId: number): Promise<INeed[]> {
    return this.getActiveNeeds(characterId);
  }

  /**
   * Получает потребности
   */
  async getNeeds(characterId: number): Promise<INeed[]> {
    return this.getNeedsByCharacter(characterId);
  }

  /**
   * Получает потребности по типу
   */
  async getNeedsByType(characterId: number, type: CharacterNeedType): Promise<INeed> {
    const needs = await this.getActiveNeeds(characterId);
    return needs.find(need => need.type === type) || needs[0];
  }

  /**
   * Рассчитывает рост потребностей
   */
  async calculateNeedsGrowth(characterId: number): Promise<INeed[]> {
    return this.getActiveNeeds(characterId);
  }

  /**
   * Получает невыполненные потребности
   */
  async getUnfulfilledNeeds(characterId: number): Promise<INeed[]> {
    const needs = await this.getActiveNeeds(characterId);
    return needs.filter(need => need.currentValue > need.threshold);
  }

  /**
   * Обновляет потребности персонажа
   */
  async updateNeeds(characterId: number, updates: INeedUpdate[]): Promise<INeed[]> {
    return updates.map((update, index) => ({
      id: index + 1,
      characterId,
      type: update.type,
      currentValue: update.change || 50,
      maxValue: 100,
      threshold: 70,
      priority: 3,
      growthRate: 0.8,
      decayRate: 0.3,
      lastUpdated: new Date(),
      isActive: true,
      dynamicPriority: 1.0,
    }));
  }

  /**
   * Рассчитывает приоритет потребности
   */
  calculatePriority(need: INeed): number {
    return need.priority;
  }

  /**
   * Получает потребности персонажа по ID
   */
  async getNeedsByCharacterId(characterId: number): Promise<INeed[]> {
    return this.getActiveNeeds(characterId);
  }
}

/**
 * Готовый мок NeedsService для добавления в providers
 */
export const mockNeedsService = {
  provide: 'NeedsService',
  useClass: MockNeedsService,
};
