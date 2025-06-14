import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CharacterMemory,
  MemoryImportance,
  MemoryImportanceLevel,
} from '../entities/character-memory.entity';
import { MemoryType } from '../interfaces/memory.interfaces';

import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

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
 * Сервис для управления СОБЫТИЙНОЙ памятью персонажей
 *
 * РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ:
 * - MemoryService: Сохраняет ВАЖНЫЕ события и эмоционально значимые моменты для формирования личности
 * - DialogService: Управляет диалогами и сохраняет историю для восстановления контекста
 *
 * MemoryService создает "воспоминания" - субъективные интерпретации событий,
 * которые влияют на поведение и принятие решений персонажем.
 */
@Injectable()
export class MemoryService {
  private readonly maxMemoryCount: number;
  private readonly defaultImportance: number;

  constructor(
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(MemoryService.name);
    // Инициализируем параметры из переменных окружения
    this.maxMemoryCount = parseInt(process.env.CHARACTER_MAX_MEMORY_SIZE || '100', 10);
    this.defaultImportance = 5;
  }

  /**
   * Преобразует числовое значение важности в MemoryImportance
   * @param value Числовое значение важности (от 1 до 10)
   * @returns Нормализованное значение как MemoryImportance
   */
  private normalizeImportance(value: number): MemoryImportance {
    // Округляем значение и ограничиваем диапазоном от 1 до 10
    const normalizedValue = Math.min(Math.max(Math.round(value), 1), 10);

    // Преобразуем в MemoryImportance с помощью приведения типа
    return normalizedValue as MemoryImportance;
  }

  /**
   * Создание нового воспоминания
   * @param characterId ID персонажа
   * @param content Содержание воспоминания
   * @param type Тип воспоминания
   * @param importance Важность воспоминания
   * @param metadata Дополнительные метаданные
   * @returns Созданное воспоминание
   */
  async createMemory(
    characterId: number,
    content: string,
    type: MemoryType = MemoryType.EVENT,
    importance: MemoryImportance = MemoryImportanceLevel.AVERAGE,
    metadata: Record<string, unknown> = {},
  ): Promise<CharacterMemory> {
    return withErrorHandling(
      async () => {
        // Создаем новое воспоминание
        const memory = this.memoryRepository.create({
          characterId,
          content,
          type,
          importance,
          metadata,
          memoryDate: new Date(),
          isActive: true,
        });

        // Сохраняем воспоминание
        const savedMemory = await this.memoryRepository.save(memory);

        // Проверяем и лимитируем количество воспоминаний
        await this.limitMemoriesCount(characterId, this.maxMemoryCount);

        return savedMemory;
      },
      'создании воспоминания',
      this.logService,
      { characterId, content, type, importance },
    );
  }

  /**
   * Создает запись в памяти о выполненном действии
   * @param params Параметры для создания памяти о действии
   * @returns Созданное воспоминание
   */
  async createActionMemory(params: CreateActionMemoryParams): Promise<CharacterMemory> {
    return withErrorHandling(
      async () => {
        const { characterId, action, isInterrupted } = params;

        // Формируем контент в зависимости от того, было ли действие прервано
        const content = isInterrupted
          ? `Выполнял действие: ${action.description} (прервано)`
          : `Выполнил действие: ${action.description}`;

        // Преобразуем importance из number in MemoryImportance (1-10)
        const importanceValue = action.metadata?.importance
          ? this.normalizeImportance(action.metadata.importance * 10)
          : MemoryImportanceLevel.AVERAGE;

        // Создаем воспоминание через основной метод
        return await this.createMemory(
          characterId,
          content,
          MemoryType.EVENT,
          importanceValue,
          action.metadata || {},
        );
      },
      'создании записи в памяти о действии',
      this.logService,
      { ...params },
    );
  }

  /**
   * Создает запись в памяти о событии
   * @param characterId ID персонажа
   * @param content Содержание события
   * @param importance Важность события (от 0 до 10)
   * @param metadata Дополнительные метаданные
   * @returns Созданное воспоминание
   */
  async createEventMemory(
    characterId: number,
    content: string,
    importance: number = 5,
    metadata: Record<string, unknown> = {},
  ): Promise<CharacterMemory> {
    return withErrorHandling(
      async () => {
        // Нормализуем важность
        const normalizedImportance = this.normalizeImportance(importance);

        // Создаем воспоминание
        return await this.createMemory(
          characterId,
          content,
          MemoryType.EVENT,
          normalizedImportance,
          metadata,
        );
      },
      'создании записи о событии',
      this.logService,
      { characterId, content, importance },
    );
  }

  /**
   * Создает СОБЫТИЙНУЮ память о значимом сообщении
   *
   * ВАЖНО: Этот метод НЕ дублирует DialogService!
   * - DialogService сохраняет ВСЕ сообщения для восстановления контекста
   * - MemoryService сохраняет только ВАЖНЫЕ сообщения как эмоциональные воспоминания
   *
   * @param params Параметры для создания памяти о сообщении
   * @returns Созданное воспоминание
   */
  async createMessageMemory(params: CreateMessageMemoryParams): Promise<CharacterMemory> {
    return withErrorHandling(
      async () => {
        const { characterId, userId, messageText, importance } = params;

        // Преобразуем числовое значение важности в MemoryImportance
        const memoryImportance = importance
          ? this.normalizeImportance(importance)
          : MemoryImportanceLevel.LOW;

        // Формируем контент в зависимости от типа сообщения
        const content = params.isFromCharacter
          ? `Я написал: "${messageText}"`
          : `Пользователь написал: "${messageText}"`;

        const type = params.isFromCharacter ? MemoryType.CONVERSATION : MemoryType.CONVERSATION;

        // Создаем метаданные для хранения дополнительной информации
        const metadata = {
          userId,
          messageText,
          importance,
          messageId: params.messageId,
          isFromCharacter: params.isFromCharacter,
        };

        // Создаем воспоминание через основной метод
        return await this.createMemory(characterId, content, type, memoryImportance, metadata);
      },
      'создании записи в памяти о сообщении',
      this.logService,
      { ...params },
    );
  }

  /**
   * Получение недавних воспоминаний персонажа
   * @param characterId ID персонажа
   * @param limit Максимальное количество воспоминаний
   * @param type Тип воспоминаний (опционально)
   * @returns Массив воспоминаний
   */
  async getRecentMemories(
    characterId: number,
    limit: number = 10,
    type?: MemoryType,
  ): Promise<CharacterMemory[]> {
    return withErrorHandling(
      async () => {
        // Создаем базовый запрос
        const queryBuilder = this.memoryRepository
          .createQueryBuilder('memory')
          .where('memory.characterId = :characterId', { characterId })
          .orderBy('memory.createdAt', 'DESC')
          .take(limit);

        // Если указан тип, добавляем его в запрос
        if (type) {
          queryBuilder.andWhere('memory.type = :type', { type });
        }

        // Выполняем запрос
        return await queryBuilder.getMany();
      },
      'получении воспоминаний персонажа',
      this.logService,
      { characterId, limit, type },
      [], // Возвращаем пустой массив в случае ошибки
    );
  }

  /**
   * Получение важных воспоминаний персонажа
   * @param characterId ID персонажа
   * @param limit Максимальное количество воспоминаний
   * @returns Массив важных воспоминаний
   */
  async getImportantMemories(characterId: number, limit: number = 10): Promise<CharacterMemory[]> {
    return withErrorHandling(
      async () => {
        return await this.memoryRepository.find({
          where: {
            characterId,
            importance: MemoryImportanceLevel.HIGH,
          },
          order: { createdAt: 'DESC' },
          take: limit,
        });
      },
      'получении важных воспоминаний персонажа',
      this.logService,
      { characterId, limit },
      [], // Возвращаем пустой массив в случае ошибки
    );
  }

  /**
   * Поиск воспоминаний по ключевым словам
   * @param characterId ID персонажа
   * @param keywords Массив ключевых слов
   * @param limit Максимальное количество воспоминаний
   * @returns Массив воспоминаний, содержащих ключевые слова
   */
  async searchMemoriesByKeywords(
    characterId: number,
    keywords: string[],
    limit: number = 10,
  ): Promise<CharacterMemory[]> {
    return withErrorHandling(
      async () => {
        // Формируем запрос на основе ключевых слов
        const queryBuilder = this.memoryRepository
          .createQueryBuilder('memory')
          .where('memory.characterId = :characterId', { characterId });

        // Добавляем условия для каждого ключевого слова (OR)
        if (keywords.length > 0) {
          const conditions = keywords.map((_keyword, index) => {
            const param = `keyword${index}`;
            return `memory.content LIKE :${param}`;
          });

          queryBuilder.andWhere(
            `(${conditions.join(' OR ')})`,
            keywords.reduce((acc, keyword, index) => {
              acc[`keyword${index}`] = `%${keyword}%`;
              return acc;
            }, {}),
          );
        }

        // Сортируем по дате и ограничиваем результаты
        queryBuilder.orderBy('memory.createdAt', 'DESC').take(limit);

        return await queryBuilder.getMany();
      },
      'поиске воспоминаний по ключевым словам',
      this.logService,
      { characterId, keywords, limit },
      [], // Возвращаем пустой массив в случае ошибки
    );
  }

  /**
   * Ограничение количества воспоминаний персонажа
   * Удаляет старые и менее важные воспоминания, если превышен лимит
   * @param characterId ID персонажа
   * @param maxCount Максимальное количество воспоминаний
   */
  async limitMemoriesCount(
    characterId: number,
    maxCount: number = this.maxMemoryCount,
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        // Получаем общее количество воспоминаний персонажа
        const totalCount = await this.memoryRepository.count({
          where: { characterId },
        });

        // Если количество превышает лимит, удаляем лишние
        if (totalCount > maxCount) {
          const toDelete = totalCount - maxCount;

          // Получаем ID устаревших и менее важных воспоминаний
          const oldMemories = await this.memoryRepository.find({
            where: { characterId },
            order: { importance: 'ASC', createdAt: 'ASC' },
            take: toDelete,
          });

          // Удаляем устаревшие воспоминания
          if (oldMemories.length > 0) {
            await this.memoryRepository.remove(oldMemories);
            this.logService.debug(
              `Удалено ${oldMemories.length} устаревших воспоминаний для персонажа ${characterId}`,
            );
          }
        }
      },
      'ограничении количества воспоминаний',
      this.logService,
      { characterId, maxCount },
    );
  }

  /**
   * Обновление важности воспоминания
   * @param memoryId ID воспоминания
   * @param importance Новая важность
   * @returns Обновленное воспоминание
   */
  async updateMemoryImportance(
    memoryId: number,
    importance: MemoryImportance,
  ): Promise<CharacterMemory | null> {
    return withErrorHandling(
      async () => {
        const memory = await this.memoryRepository.findOne({
          where: { id: memoryId },
        });

        if (!memory) {
          this.logService.warn(`Воспоминание с ID ${memoryId} не найдено`);
          return null;
        }

        memory.importance = importance;
        return await this.memoryRepository.save(memory);
      },
      'обновлении важности воспоминания',
      this.logService,
      { memoryId, importance },
      null, // Возвращаем null в случае ошибки
    );
  }

  /**
   * Помечает воспоминание как вспомненное (увеличивает счетчик recallCount)
   * @param memoryId ID воспоминания
   * @returns Обновленное воспоминание
   */
  async markMemoryAsRecalled(memoryId: number): Promise<CharacterMemory | null> {
    return withErrorHandling(
      async () => {
        const memory = await this.memoryRepository.findOne({
          where: { id: memoryId },
        });

        if (!memory) {
          this.logService.warn(`Воспоминание с ID ${memoryId} не найдено`);
          return null;
        }

        memory.recallCount = (memory.recallCount || 0) + 1;
        memory.lastRecalled = new Date();
        return await this.memoryRepository.save(memory);
      },
      'обновлении счетчика вспоминаний',
      this.logService,
      { memoryId },
      null, // Возвращаем null в случае ошибки
    );
  }
}
