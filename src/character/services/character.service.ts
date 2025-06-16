import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Character } from '../entities/character.entity';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { LogService } from '../../logging/log.service';
import { CharacterArchetype } from '../enums/character-archetype.enum';

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
export class CharacterService {
  private readonly entityName: string = 'Character';

  constructor(
    @InjectRepository(Character)
    private readonly repository: Repository<Character>,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(CharacterService.name);
  }

  // Базовые CRUD операции через прямое использование repository

  /**
   * Найти одну запись по ID
   */
  async findOne(id: number | string, relations: string[] = []): Promise<Character | null> {
    return withErrorHandling(
      async () => {
        const character = await this.repository.findOne({
          where: { id } as FindOptionsWhere<Character>,
          relations,
        });
        return character;
      },
      'получении персонажа по ID',
      this.logService,
      { id, relations },
      null,
    );
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
    return withErrorHandling(
      async () => {
        if (!data.archetype) {
          data.archetype = CharacterArchetype.HERO;
        }

        // По умолчанию appearance не должен быть null из-за NOT NULL ограничения
        if (!data.appearance) {
          data.appearance = 'n/a';
        }

        const entity = this.repository.create(data);
        return await this.repository.save(entity);
      },
      'создании персонажа',
      this.logService,
      { data },
      null as never,
    );
  }

  /**
   * Обновить запись
   */
  async update(id: number | string, data: Partial<Character>): Promise<Character> {
    return withErrorHandling(
      async () => {
        const entity = await this.findOne(id);
        if (!entity) {
          throw new Error(`Персонаж с ID ${id} не найден`);
        }
        const updatedEntity = Object.assign({}, entity, data);
        return await this.repository.save(updatedEntity);
      },
      'обновлении персонажа',
      this.logService,
      { id, data },
      null as never,
    );
  }

  /**
   * Удалить запись
   */
  async delete(id: number | string): Promise<void> {
    return withErrorHandling(
      async () => {
        const entity = await this.findOne(id);
        if (!entity) {
          throw new Error(`Персонаж с ID ${id} не найден`);
        }
        await this.repository.remove(entity);
      },
      'удалении персонажа',
      this.logService,
      { id },
      undefined,
    );
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
      this.logService.error(
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
    return withErrorHandling(
      async () => {
        return this.repository.find({
          where: { userId },
          relations: ['needs'],
        });
      },
      'поиске персонажей пользователя',
      this.logService,
      { userId },
      [],
    );
  }

  /**
   * Обновление времени последнего взаимодействия
   * @param id ID персонажа
   */
  async updateLastInteraction(id: number): Promise<void> {
    return withErrorHandling(
      async () => {
        await this.repository.update(id, {
          lastInteraction: new Date(),
        });
      },
      'обновлении времени взаимодействия',
      this.logService,
      { id },
    );
  }

  /**
   * Получение персонажа по ID с указанными отношениями
   * @param id ID персонажа
   * @param relations Отношения для загрузки
   */
  async findOneWithRelations(id: number, relations: string[] = []): Promise<Character | null> {
    return await withErrorHandling(
      async () => {
        const character = await this.repository.findOne({
          where: { id },
          relations,
        });

        if (!character) {
          this.logService.warn(`Персонаж с ID ${id} не найден`);
          return null;
        }
        return character;
      },
      'получении персонажа с отношениями',
      this.logService,
      { id, relations },
      null,
    );
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
    return withErrorHandling(
      async () => {
        return await this.repository.find({
          where,
          relations: options.relations || [],
          take: options.limit,
        });
      },
      'поиске персонажей по условию',
      this.logService,
      { where, options },
      [],
    );
  }

  /**
   * Получение данных с пагинацией
   */
  async findWithPagination(
    options: PaginationOptions = {},
    where: FindOptionsWhere<Character> = {} as FindOptionsWhere<Character>,
    relations: string[] = [],
  ): Promise<PaginatedResult<Character>> {
    return withErrorHandling(
      async () => {
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
      },
      'получении данных с пагинацией',
      this.logService,
      { options, where, relations },
      {
        items: [],
        meta: { totalItems: 0, itemsPerPage: 0, totalPages: 0, currentPage: 0 },
      },
    );
  }
}
