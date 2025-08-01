import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Character } from '../../entities/character.entity';
import { Need } from '../../entities/need.entity';
import { CharacterMemory } from '../../entities/character-memory.entity';
import { CharacterNeedType } from '../../enums/character-need-type.enum';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { CacheService } from '../../../cache/cache.service';
import { CharacterArchetype } from '../../enums/character-archetype.enum';

// Определяем интерфейсы локально
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  sort?: Record<string, 'ASC' | 'DESC'>;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    totalItems: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

/**
 * Сервис для работы с персонажами
 * Использует композицию вместо наследования для лучшей гибкости
 */
@Injectable()
export class CharacterService extends BaseService {
  private readonly entityName: string = 'Character';

  // Кеш-настройки для оптимизации
  private readonly CACHE_TTL = 600; // 10 минут для стабильных данных
  private readonly CHARACTER_CACHE_PREFIX = 'character:';
  private readonly NEEDS_CACHE_PREFIX = 'needs:';
  private readonly MEMORY_CACHE_PREFIX = 'memory:';

  constructor(
    @InjectRepository(Character)
    private readonly repository: Repository<Character>,
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    @InjectRepository(CharacterMemory)
    private readonly memoryRepository: Repository<CharacterMemory>,
    private readonly cacheService: CacheService,
    logService: LogService,
  ) {
    super(logService);
  }

  // Базовые CRUD операции через прямое использование repository

  /**
   * Найти одну запись по ID
   */
  async findOne(id: number | string, relations: string[] = []): Promise<Character | null> {
    return this.withErrorHandling('получении персонажа по ID', async () => {
      const character = await this.repository.findOne({
        where: { id } as FindOptionsWhere<Character>,
        relations,
      });
      return character;
    });
  }

  /**
   * Найти одну запись по ID (алиас для findOne)
   */
  async findOneById(id: number | string, relations: string[] = []): Promise<Character | null> {
    return this.findOne(id, relations);
  }

  /**
   * Создать новую запись
   */
  async create(data: DeepPartial<Character>): Promise<Character> {
    return this.withErrorHandling('создании персонажа', async () => {
      if (!data.archetype) {
        data.archetype = CharacterArchetype.HERO;
      }

      // По умолчанию appearance не должен быть null из-за NOT NULL ограничения
      if (!data.appearance) {
        data.appearance = 'n/a';
      }

      // Убеждаемся что userId правильно установлен
      if (data.user && !data.userId) {
        data.userId = data.user.id;
        this.logDebug('Установлен userId из user объекта', {
          userId: data.userId,
        });
      }

      const entity = this.repository.create(data);
      this.logDebug('Создан entity для сохранения', {
        entityId: entity.id,
        entityUserId: entity.userId,
        entityName: entity.name,
      });

      const saved = await this.repository.save(entity);
      this.logDebug('Entity сохранен в базу данных', {
        savedId: saved.id,
        savedUserId: saved.userId,
        savedName: saved.name,
      });

      return saved;
    });
  }

  /**
   * Обновить запись
   */
  async update(id: number | string, data: Partial<Character>): Promise<Character> {
    return this.withErrorHandling('обновлении персонажа', async () => {
      const entity = await this.findOne(id);
      if (!entity) {
        throw new Error(`Персонаж с ID ${id} не найден`);
      }
      const updatedEntity = Object.assign({}, entity, data);
      return await this.repository.save(updatedEntity);
    });
  }

  /**
   * Удалить запись
   */
  async delete(id: number | string): Promise<void> {
    return this.withErrorHandling('удалении персонажа', async () => {
      const entity = await this.findOne(id);
      if (!entity) {
        throw new Error(`Персонаж с ID ${id} не найден`);
      }
      await this.repository.remove(entity);
    });
  }

  // Специфичные методы для персонажей

  /**
   * Поиск всех персонажей с потребностями
   */
  async findAll(): Promise<Character[]> {
    try {
      return await this.repository.find({
        relations: ['needs'],
      });
    } catch (error) {
      this.logError(
        `Ошибка при поиске всех персонажей: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      return [];
    }
  }

  /**
   * Поиск персонажей по ID пользователя
   * @param userId ID пользователя
   */
  async findByUserId(userId: string): Promise<Character[]> {
    return this.withErrorHandling('поиске персонажей пользователя', async () => {
      return this.repository.find({
        where: { userId },
        relations: ['needs'],
      });
    });
  }

  /**
   * Обновление времени последнего взаимодействия
   * @param id ID персонажа
   */
  async updateLastInteraction(id: number): Promise<void> {
    return this.withErrorHandling('обновлении времени последнего взаимодействия', async () => {
      await this.repository.update(id, { lastInteraction: new Date() });
    });
  }

  /**
   * Получение персонажа по ID с указанными отношениями
   * @param id ID персонажа
   * @param relations Отношения для загрузки
   */
  async findOneWithRelations(id: number, relations: string[] = []): Promise<Character | null> {
    return await this.withErrorHandling('получении персонажа с отношениями', async () => {
      const character = await this.repository.findOne({
        where: { id },
        relations,
      });

      if (!character) {
        this.logWarning(`Персонаж с ID ${id} не найден`);
        return null;
      }
      return character;
    });
  }

  /**
   * Получение персонажа с базовыми потребностями
   */
  async findOneWithNeeds(id: number): Promise<Character | null> {
    return this.findOneWithRelations(id, ['needs']);
  }

  /**
   * Получение персонажа с полным набором отношений (потребности, воспоминания, мотивации)
   */
  async findOneWithFullProfile(id: number): Promise<Character | null> {
    return this.findOneWithRelations(id, ['needs', 'memories', 'motivations']);
  }

  /**
   * Найти записи по условию
   */
  async findBy(
    where: FindOptionsWhere<Character>,
    options: { limit?: number; relations?: string[] } = {},
  ): Promise<Character[]> {
    return this.withErrorHandling('поиске персонажей по условию', async () => {
      return await this.repository.find({
        where,
        relations: options.relations || [],
        take: options.limit,
      });
    });
  }

  /**
   * Получение данных с пагинацией
   */
  async findWithPagination(
    options: PaginationOptions = {},
    where: FindOptionsWhere<Character> = {} as FindOptionsWhere<Character>,
    relations: string[] = [],
  ): Promise<PaginatedResult<Character>> {
    return this.withErrorHandling('получении данных с пагинацией', async () => {
      const { page = 1, limit = 10, sort = {} } = options;
      const skip = (page - 1) * limit;

      const [items, totalItems] = await this.repository.findAndCount({
        where,
        relations,
        take: limit,
        skip,
        order: sort,
      });

      return {
        items,
        meta: {
          totalItems,
          itemsPerPage: limit,
          totalPages: Math.ceil(totalItems / limit) || 1,
          currentPage: page,
        },
      };
    });
  }

  // ===============================================
  // ОПТИМИЗИРОВАННЫЕ МЕТОДЫ (интегрированы из optimized версии)
  // ===============================================

  /**
   * ОПТИМИЗАЦИЯ: Кешированное получение персонажа с полными данными
   */
  async getCharacterOptimized(characterId: number): Promise<Character | null> {
    return this.withErrorHandling('оптимизированном получении персонажа', async () => {
      const cacheKey = `${this.CHARACTER_CACHE_PREFIX}${characterId}`;

      const cached = await this.cacheService.get<Character>(cacheKey);
      if (cached) {
        this.logDebug('Персонаж получен из кеша', { characterId, cacheKey });
        return cached;
      }

      const character = await this.repository
        .createQueryBuilder('character')
        .where('character.id = :id', { id: characterId })
        .andWhere('character.isActive = :isActive', { isActive: true })
        .getOne();

      if (character) {
        await this.cacheService.set(cacheKey, character, this.CACHE_TTL);
        this.logDebug('Персонаж добавлен в кеш', { characterId, cacheKey });
      }

      return character;
    });
  }

  /**
   * ОПТИМИЗАЦИЯ: Получение потребностей персонажа в batch режиме
   */
  async getCharacterNeedsBatch(characterId: number): Promise<Record<CharacterNeedType, Need>> {
    return this.withErrorHandling('получении потребностей персонажа', async () => {
      const cacheKey = `${this.NEEDS_CACHE_PREFIX}${characterId}`;

      const cached = await this.cacheService.get<Record<CharacterNeedType, Need>>(cacheKey);
      if (cached) {
        this.logDebug('Потребности получены из кеша', { characterId });
        return cached;
      }

      const needs = await this.needRepository
        .createQueryBuilder('need')
        .where('need.characterId = :characterId', { characterId })
        .andWhere('need.isActive = :isActive', { isActive: true })
        .getMany();

      const needsMap: Record<CharacterNeedType, Need> = {} as Record<CharacterNeedType, Need>;
      needs.forEach(need => {
        needsMap[need.type] = need;
      });

      await this.cacheService.set(cacheKey, needsMap, this.CACHE_TTL);
      this.logDebug('Потребности добавлены в кеш', { characterId, needsCount: needs.length });

      return needsMap;
    });
  }

  /**
   * ОПТИМИЗАЦИЯ: Обновление потребностей в batch режиме
   */
  async updateCharacterNeedsBatch(
    characterId: number,
    updates: Array<{ type: CharacterNeedType; value: number; priority?: number }>,
  ): Promise<void> {
    return this.withErrorHandling('обновлении потребностей персонажа', async () => {
      const updatePromises = updates.map(async update => {
        return this.needRepository
          .createQueryBuilder()
          .update(Need)
          .set({
            currentValue: update.value,
            priority: update.priority,
          })
          .where('characterId = :characterId', { characterId })
          .andWhere('type = :type', { type: update.type })
          .execute();
      });

      await Promise.all(updatePromises);

      // Сбрасываем кеш потребностей
      const cacheKey = `${this.NEEDS_CACHE_PREFIX}${characterId}`;
      await this.cacheService.del(cacheKey);

      this.logDebug('Потребности обновлены в batch режиме', {
        characterId,
        updatesCount: updates.length,
      });
    });
  }

  /**
   * ОПТИМИЗАЦИЯ: Поиск воспоминаний с кешированием
   */
  async searchMemoriesOptimized(
    characterId: number,
    query: string,
    limit: number = 10,
  ): Promise<CharacterMemory[]> {
    return this.withErrorHandling('поиске воспоминаний', async () => {
      const cacheKey = `${this.MEMORY_CACHE_PREFIX}${characterId}:search:${query}:${limit}`;

      const cached = await this.cacheService.get<CharacterMemory[]>(cacheKey);
      if (cached) {
        this.logDebug('Результаты поиска воспоминаний получены из кеша', { characterId, query });
        return cached;
      }

      const memories = await this.memoryRepository
        .createQueryBuilder('memory')
        .where('memory.characterId = :characterId', { characterId })
        .andWhere('(memory.content ILIKE :query OR memory.context ILIKE :query)', {
          query: `%${query}%`,
        })
        .orderBy('memory.createdAt', 'DESC')
        .limit(limit)
        .getMany();

      // Кешируем результаты поиска на меньшее время (2 минуты)
      await this.cacheService.set(cacheKey, memories, 120);

      this.logDebug('Результаты поиска воспоминаний добавлены в кеш', {
        characterId,
        query,
        memoriesCount: memories.length,
      });

      return memories;
    });
  }

  /**
   * ОПТИМИЗАЦИЯ: Получение нескольких персонажей batch режимом
   */
  async getCharactersBatch(characterIds: number[]): Promise<Record<number, Character>> {
    return this.withErrorHandling('получении персонажей batch режимом', async () => {
      const result: Record<number, Character> = {};
      const uncachedIds: number[] = [];

      // Проверяем кеш для каждого персонажа
      for (const id of characterIds) {
        const cacheKey = `${this.CHARACTER_CACHE_PREFIX}${id}`;
        const cached = await this.cacheService.get<Character>(cacheKey);
        if (cached) {
          result[id] = cached;
        } else {
          uncachedIds.push(id);
        }
      }

      // Загружаем некешированных персонажей одним запросом
      if (uncachedIds.length > 0) {
        const characters = await this.repository
          .createQueryBuilder('character')
          .whereInIds(uncachedIds)
          .andWhere('character.isActive = :isActive', { isActive: true })
          .getMany();

        // Добавляем в результат и кеш
        for (const character of characters) {
          result[character.id] = character;
          const cacheKey = `${this.CHARACTER_CACHE_PREFIX}${character.id}`;
          await this.cacheService.set(cacheKey, character, this.CACHE_TTL);
        }
      }

      this.logDebug('Персонажи получены batch режимом', {
        totalRequested: characterIds.length,
        fromCache: characterIds.length - uncachedIds.length,
        fromDatabase: uncachedIds.length,
      });

      return result;
    });
  }

  /**
   * ОПТИМИЗАЦИЯ: Обработка всех потребностей персонажей
   */
  async processAllCharacterNeedsOptimized(): Promise<{
    processed: number;
    errors: number;
    duration: number;
  }> {
    return this.withErrorHandling('обработке всех потребностей персонажей', async () => {
      const startTime = Date.now();
      let processed = 0;
      let errors = 0;

      const characters = await this.repository
        .createQueryBuilder('character')
        .where('character.isActive = :isActive', { isActive: true })
        .getMany();

      const batchSize = 10; // Обрабатываем по 10 персонажей одновременно
      for (let i = 0; i < characters.length; i += batchSize) {
        const batch = characters.slice(i, i + batchSize);
        const batchPromises = batch.map(async character => {
          try {
            await this.processCharacterNeedsOptimized(character.id);
            processed++;
          } catch (error) {
            this.logError('Ошибка обработки потребностей персонажа', {
              characterId: character.id,
              error: error instanceof Error ? error.message : String(error),
            });
            errors++;
          }
        });

        await Promise.all(batchPromises);
      }

      const duration = Date.now() - startTime;

      this.logInfo('Завершена обработка потребностей всех персонажей', {
        processed,
        errors,
        duration,
        totalCharacters: characters.length,
      });

      return { processed, errors, duration };
    });
  }

  /**
   * Приватный метод для обработки потребностей конкретного персонажа
   */
  private async processCharacterNeedsOptimized(characterId: number): Promise<void> {
    const needs = await this.getCharacterNeedsBatch(characterId);

    const updates = Object.entries(needs).map(([type, need]) => {
      // Пример логики обработки потребностей
      let newValue = need.currentValue;

      // Естественное убывание потребностей со временем
      if (type === 'HUNGER' || type === 'THIRST') {
        newValue = Math.max(0, need.currentValue - 5);
      }

      return {
        type: type as CharacterNeedType,
        value: newValue,
        priority: need.priority,
      };
    });

    if (updates.length > 0) {
      await this.updateCharacterNeedsBatch(characterId, updates);
    }
  }

  /**
   * ОПТИМИЗАЦИЯ: Статистика эффективности кеша
   */
  async getCacheEfficiencyStats(): Promise<{
    totalKeys: number;
    characterKeys: number;
    needsKeys: number;
    memoryKeys: number;
    hitRate: number;
  }> {
    return this.withErrorHandling('получении статистики кеша', async () => {
      // Здесь можно добавить реальную статистику кеша, если CacheService это поддерживает
      // Для демонстрации возвращаем базовую структуру
      return {
        totalKeys: 0,
        characterKeys: 0,
        needsKeys: 0,
        memoryKeys: 0,
        hitRate: 0.85, // Предполагаемый hit rate
      };
    });
  }
}
