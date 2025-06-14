import { Injectable } from '@nestjs/common';
import { MemoryType } from '../../../src/character/interfaces/memory.interfaces';
import { CharacterMemory, MemoryImportance, MemoryImportanceLevel } from '../../../src/character/entities/character-memory.entity';

/**
 * Интерфейс для создания памяти о сообщении
 */
interface CreateMessageMemoryParams {
  characterId: number;
  userId: number;
  messageText: string;
  importance?: number;
  messageId?: number;
  isFromCharacter?: boolean;
}

/**
 * Интерфейс для создания памяти о действии
 */
interface CreateActionMemoryParams {
  characterId: number;
  action: {
    description: string;
    metadata?: {
      importance?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  isInterrupted?: boolean;
}

/**
 * Мок для MemoryService для использования в тестах
 */
@Injectable()
export class MockMemoryService {
  /**
   * Создание нового воспоминания
   */
  async createMemory(
    characterId: number,
    content: string,
    type: MemoryType = MemoryType.EVENT,
    importance: MemoryImportance = MemoryImportanceLevel.AVERAGE,
    metadata: Record<string, unknown> = {},
  ): Promise<CharacterMemory> {
    return {
      id: Math.floor(Math.random() * 1000),
      characterId,
      character: null,
      content,
      type,
      importance,
      metadata,
      memoryDate: new Date(),
      isActive: true,
      lastRecalled: null,
      recallCount: 0,
      summary: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as CharacterMemory;
  }

  /**
   * Создает запись в памяти о выполненном действии
   */
  async createActionMemory(params: CreateActionMemoryParams): Promise<CharacterMemory> {
    const { characterId, action, isInterrupted } = params;
    const content = isInterrupted
      ? `Выполнял действие: ${action.description} (прервано)`
      : `Выполнил действие: ${action.description}`;

    return this.createMemory(
      characterId,
      content,
      MemoryType.EVENT,
      MemoryImportanceLevel.AVERAGE,
      action.metadata || {},
    );
  }

  /**
   * Создает запись в памяти о событии
   */
  async createEventMemory(
    characterId: number,
    content: string,
    importance: number = 5,
    metadata: Record<string, unknown> = {},
  ): Promise<CharacterMemory> {
    const normalizedImportance = Math.min(Math.max(Math.round(importance), 1), 10) as MemoryImportance;
    return this.createMemory(
      characterId,
      content,
      MemoryType.EVENT,
      normalizedImportance,
      metadata,
    );
  }

  /**
   * Создает СОБЫТИЙНУЮ память о значимом сообщении
   */
  async createMessageMemory(params: CreateMessageMemoryParams): Promise<CharacterMemory> {
    const { characterId, userId, messageText, importance } = params;
    const memoryImportance = importance
      ? Math.min(Math.max(Math.round(importance), 1), 10) as MemoryImportance
      : MemoryImportanceLevel.LOW;

    const content = params.isFromCharacter
      ? `Я написал: "${messageText}"`
      : `Пользователь написал: "${messageText}"`;

    const type = MemoryType.CONVERSATION;

    const metadata = {
      userId,
      messageText,
      importance,
      messageId: params.messageId,
      isFromCharacter: params.isFromCharacter,
    };

    return this.createMemory(characterId, content, type, memoryImportance, metadata);
  }

  /**
   * Получение недавних воспоминаний персонажа
   */
  async getRecentMemories(
    characterId: number,
    limit: number = 10,
    type?: MemoryType,
  ): Promise<CharacterMemory[]> {
    return Array(limit).fill(null).map((_, index) => ({
      id: index + 1,
      characterId,
      character: null,
      content: `Тестовое воспоминание ${index + 1}`,
      type: type || MemoryType.EVENT,
      importance: MemoryImportanceLevel.AVERAGE,
      metadata: {},
      memoryDate: new Date(Date.now() - index * 3600000), // Каждое воспоминание на час раньше предыдущего
      isActive: true,
      lastRecalled: null,
      recallCount: 0,
      summary: null,
      createdAt: new Date(Date.now() - index * 3600000),
      updatedAt: new Date(Date.now() - index * 3600000)
    }) as unknown as CharacterMemory);
  }

  /**
   * Получение важных воспоминаний персонажа
   */
  async getImportantMemories(
    characterId: number,
    limit: number = 10,
  ): Promise<CharacterMemory[]> {
    return Array(limit).fill(null).map((_, index) => ({
      id: index + 1,
      characterId,
      character: null,
      content: `Важное воспоминание ${index + 1}`,
      type: MemoryType.EVENT,
      importance: MemoryImportanceLevel.HIGH,
      metadata: {},
      memoryDate: new Date(Date.now() - index * 3600000),
      isActive: true,
      lastRecalled: null,
      recallCount: 0,
      summary: null,
      createdAt: new Date(Date.now() - index * 3600000),
      updatedAt: new Date(Date.now() - index * 3600000)
    }) as unknown as CharacterMemory);
  }

  /**
   * Поиск воспоминаний по ключевым словам
   */
  async searchMemoriesByKeywords(
    characterId: number,
    keywords: string[],
    limit: number = 10,
  ): Promise<CharacterMemory[]> {
    return Array(limit).fill(null).map((_, index) => ({
      id: index + 1,
      characterId,
      character: null,
      content: `Воспоминание с ключевыми словами: ${keywords.join(', ')}`,
      type: MemoryType.EVENT,
      importance: MemoryImportanceLevel.AVERAGE,
      metadata: { keywords },
      memoryDate: new Date(Date.now() - index * 3600000),
      isActive: true,
      lastRecalled: null,
      recallCount: 0,
      summary: null,
      createdAt: new Date(Date.now() - index * 3600000),
      updatedAt: new Date(Date.now() - index * 3600000)
    }) as unknown as CharacterMemory);
  }

  /**
   * Ограничение количества воспоминаний
   */
  async limitMemoriesCount(
    characterId: number,
    maxCount: number = 100,
  ): Promise<void> {
    // Мок-реализация, ничего не делает
  }

  /**
   * Обновление важности воспоминания
   */
  async updateMemoryImportance(
    memoryId: number,
    importance: MemoryImportance,
  ): Promise<CharacterMemory | null> {
    return {
      id: memoryId,
      characterId: 1,
      character: null,
      content: 'Обновленное воспоминание',
      type: MemoryType.EVENT,
      importance,
      metadata: {},
      memoryDate: new Date(),
      isActive: true,
      lastRecalled: null,
      recallCount: 0,
      summary: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as CharacterMemory;
  }

  /**
   * Отметить воспоминание как вспомненное
   */
  async markMemoryAsRecalled(memoryId: number): Promise<CharacterMemory | null> {
    return {
      id: memoryId,
      characterId: 1,
      character: null,
      content: 'Вспомненное воспоминание',
      type: MemoryType.EVENT,
      importance: MemoryImportanceLevel.AVERAGE,
      metadata: {},
      memoryDate: new Date(Date.now() - 86400000), // Сутки назад
      isActive: true,
      lastRecalled: new Date(),
      recallCount: 1,
      summary: null,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date()
    } as unknown as CharacterMemory;
  }
}

/**
 * Экспортируем мок для использования в тестах
 */
export const mockMemoryService = {
  provide: 'MemoryService',
  useClass: MockMemoryService
}; 