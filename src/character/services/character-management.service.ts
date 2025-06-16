import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { Need } from '../entities/need.entity';
import { Action } from '../entities/action.entity';
import { EventType, StoryEvent, StoryEventEffect } from '../entities/story-event.entity';
import { CreateCharacterDto } from '../dto/create-character.dto';
import { ErrorHandlingService } from '../../common/utils/error-handling/error-handling.service';
import { CacheService } from '../../cache/cache.service';
import { LogService } from '../../logging/log.service';
import { CharacterNeedType } from '../enums/character-need-type.enum';

export interface ICharacterAnalysis {
  characterId: string;
  needsAnalysis: {
    needsByType: Record<string, number>;
    averageValue: number;
    criticalNeeds: string[];
    overallSatisfaction: string;
  };
  memoriesAnalysis: {
    totalMemories: number;
    averageImportance: number;
    importantMemoriesCount: number;
    recentMemoriesCount: number;
    memoryRetention: string;
  };
  activityAnalysis: {
    totalActions: number;
    actionsByType: Record<string, number>;
    recentActionsCount: number;
    activityLevel: string;
  };
  overallState: string;
  createdAt: Date;
}

/**
 * Объединенный сервис управления персонажами
 * Координирует основную функциональность персонажей, объединяя логику из разных доменов
 */
@Injectable()
export class CharacterManagementService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(StoryEvent)
    private readonly storyEventRepository: Repository<StoryEvent>,
    private readonly cacheService: CacheService,
    private readonly errorHandler: ErrorHandlingService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(CharacterManagementService.name);
  }

  /**
   * Создание нового персонажа с базовыми настройками
   */
  async createCharacter(dto: CreateCharacterDto, userId: number | string): Promise<Character> {
    try {
      // Создание персонажа
      const character = this.characterRepository.create({
        ...dto,
        userId: typeof userId === 'number' ? String(userId) : userId,
        isActive: true,
        createdAt: new Date(),
      });

      const savedCharacter = await this.characterRepository.save(character);

      // Инициализация базовых потребностей
      await this.initializeBasicNeeds(savedCharacter.id.toString());

      // Кэширование
      await this.cacheService.set(
        `character:${savedCharacter.id}`,
        savedCharacter,
        3600, // 1 час
      );

      this.logService.log(`Character created successfully: ${savedCharacter.id}`);
      return savedCharacter;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Error creating character', errorMessage);
      throw error;
    }
  }

  /**
   * Получение персонажа с полными данными
   */
  async getCharacterWithData(id: string): Promise<Character | null> {
    try {
      // Попытка получить из кэша
      const cached = await this.cacheService.get<Character>(`character:${id}`);
      if (cached) {
        return cached;
      }

      // Загрузка из БД с отношениями
      const character = await this.characterRepository.findOne({
        where: { id: parseInt(id, 10) },
        relations: ['needs', 'memories', 'actions', 'storyEvents'],
      });

      if (character) {
        // Кэширование результата
        await this.cacheService.set(`character:${id}`, character, 3600);
      }

      return character;
    } catch (error) {
      this.logService.error('Ошибка при получении персонажа с данными', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      return null;
    }
  }

  // Removed duplicate methods - functionality delegated to specialized services:
  // - updateNeeds -> use NeedsService
  // - addMemory -> use MemoryService
  // - createAction -> use ActionService

  /**
   * Создание сюжетного события
   */
  async createStoryEvent(
    characterId: string,
    eventType: string,
    description: string,
    impact?: StoryEventEffect,
  ): Promise<StoryEvent> {
    return this.errorHandler.withErrorHandling(
      async () => {
        const storyEvent = this.storyEventRepository.create({
          characterId: parseInt(characterId, 10),
          type: eventType as EventType,
          title: description,
          description,
          triggers: {},
          effects: impact,
        });

        const savedStoryEvent = await this.storyEventRepository.save(storyEvent);

        // Инвалидация кэша персонажа
        await this.cacheService.del(`character:${characterId}`);

        this.logService.log(`Story event created for character ${characterId}: ${eventType}`);
        return savedStoryEvent;
      },
      'создании сюжетного события',
      this.logService,
    );
  }

  /**
   * Получение анализа персонажа
   */
  async getCharacterAnalysis(characterId: string): Promise<ICharacterAnalysis> {
    try {
      const character = await this.getCharacterWithData(characterId);
      if (!character) {
        throw new Error('Character not found');
      }

      // Анализ потребностей
      const needsAnalysis = this.analyzeNeeds(character.needs || []);

      // Анализ воспоминаний
      const memoriesAnalysis = this.analyzeMemories(character.memories || []);

      // Анализ активности
      const activityAnalysis = this.analyzeActivity(character.actions || []);

      return {
        characterId,
        needsAnalysis,
        memoriesAnalysis,
        activityAnalysis,
        overallState: this.calculateOverallState(needsAnalysis, memoriesAnalysis, activityAnalysis),
        createdAt: new Date(),
      };
    } catch (error) {
      this.logService.error('Ошибка при получении анализа персонажа', {
        error: error instanceof Error ? error.message : String(error),
        characterId,
      });
      throw error;
    }
  }

  /**
   * Инициализация базовых потребностей для нового персонажа
   */
  private async initializeBasicNeeds(characterId: string): Promise<void> {
    const basicNeeds = [
      { type: 'SOCIAL', value: 50 },
      { type: 'EMOTIONAL', value: 50 },
      { type: 'INTELLECTUAL', value: 50 },
      { type: 'PHYSICAL', value: 50 },
    ];

    for (const needData of basicNeeds) {
      const need = this.needRepository.create({
        characterId: parseInt(characterId, 10),
        type: needData.type as CharacterNeedType,
        currentValue: needData.value,
        maxValue: 100,
        growthRate: 1,
        decayRate: 0.5,
        threshold: 50,
        priority: 5, // Базовый приоритет
        isActive: true,
      });

      await this.needRepository.save(need);
    }
  }

  /**
   * Расчет приоритета потребности на основе значения
   */
  private calculateNeedPriority(value: number): string {
    if (value < 25) return 'CRITICAL';
    if (value < 50) return 'HIGH';
    if (value < 75) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Анализ потребностей персонажа
   */
  private analyzeNeeds(needs: Need[]): {
    needsByType: Record<string, number>;
    averageValue: number;
    criticalNeeds: string[];
    overallSatisfaction: string;
  } {
    const needsByType = needs.reduce(
      (acc, need) => {
        acc[need.type] = need.currentValue;
        return acc;
      },
      {} as Record<string, number>,
    );

    const averageValue =
      needs.length > 0
        ? needs.reduce((sum, need) => sum + need.currentValue, 0) / needs.length
        : 50;

    const criticalNeeds = needs.filter(need => need.currentValue < 25);

    return {
      needsByType,
      averageValue,
      criticalNeeds: criticalNeeds.map(need => need.type),
      overallSatisfaction: averageValue > 75 ? 'HIGH' : averageValue > 50 ? 'MEDIUM' : 'LOW',
    };
  }

  /**
   * Анализ воспоминаний персонажа
   */
  private analyzeMemories(memories: CharacterMemory[]): {
    totalMemories: number;
    averageImportance: number;
    importantMemoriesCount: number;
    recentMemoriesCount: number;
    memoryRetention: string;
  } {
    const totalMemories = memories.length;
    const averageImportance =
      memories.length > 0
        ? memories.reduce((sum, memory) => sum + memory.importance, 0) / memories.length
        : 0;

    const importantMemories = memories.filter(memory => memory.importance > 75);
    const recentMemories = memories.filter(memory => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return memory.createdAt > weekAgo;
    });

    return {
      totalMemories,
      averageImportance,
      importantMemoriesCount: importantMemories.length,
      recentMemoriesCount: recentMemories.length,
      memoryRetention: totalMemories > 0 ? 'ACTIVE' : 'INACTIVE',
    };
  }

  /**
   * Анализ активности персонажа
   */
  private analyzeActivity(actions: Action[]): {
    totalActions: number;
    actionsByType: Record<string, number>;
    recentActionsCount: number;
    activityLevel: string;
  } {
    const totalActions = actions.length;
    const actionsByType = actions.reduce(
      (acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentActions = actions.filter(action => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return action.createdAt > dayAgo;
    });

    return {
      totalActions,
      actionsByType,
      recentActionsCount: recentActions.length,
      activityLevel:
        recentActions.length > 10 ? 'HIGH' : recentActions.length > 5 ? 'MEDIUM' : 'LOW',
    };
  }

  /**
   * Расчет общего состояния персонажа
   */
  private calculateOverallState(
    needsAnalysis: { averageValue: number },
    memoriesAnalysis: { averageImportance: number },
    activityAnalysis: { activityLevel: string },
  ): string {
    const needsScore = needsAnalysis.averageValue;
    const memoryScore = memoriesAnalysis.averageImportance;
    const activityScore =
      activityAnalysis.activityLevel === 'HIGH'
        ? 80
        : activityAnalysis.activityLevel === 'MEDIUM'
          ? 60
          : 40;

    const overallScore = (needsScore + memoryScore + activityScore) / 3;

    if (overallScore > 75) return 'EXCELLENT';
    if (overallScore > 60) return 'GOOD';
    if (overallScore > 40) return 'FAIR';
    return 'POOR';
  }
}
