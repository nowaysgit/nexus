import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Character } from '../../entities/character.entity';
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
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

  constructor(
    @InjectRepository(Character)
    private readonly repository: Repository<Character>,
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
}
