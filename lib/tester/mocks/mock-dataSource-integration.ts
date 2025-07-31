/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars -- Mock data source integration requires any type for generic database operations */
import { DataSource, Repository, QueryRunner, EntityManager } from 'typeorm';
import { ALL_TEST_ENTITIES } from '../entities';

/**
 * Интерфейс для mock DataSource с поддержкой fallback режима
 */
export interface IMockIntegrationDataSource {
  isInitialized: boolean;
  initialize(): Promise<IMockIntegrationDataSource>;
  destroy(): Promise<void>;
  getRepository<Entity>(target: any): Repository<Entity>;
  createQueryRunner(): QueryRunner;
  manager: EntityManager;
  clearAllMockData(): Promise<void>;
  getMockData(entityName: string): any[];
}

/**
 * Реализация mock DataSource для интеграционных тестов
 * Предоставляет fallback решение когда PostgreSQL недоступен
 */
export class MockIntegrationDataSource implements IMockIntegrationDataSource {
  private mockRepositories = new Map<string, Repository<any>>();
  private mockData = new Map<string, any[]>();
  private _isInitialized = false;
  private _manager: EntityManager;

  constructor() {
    // Инициализируем mock репозитории для всех сущностей
    this.initializeMockRepositories();
    this._manager = this.createMockManager();
  }

  private initializeMockRepositories(): void {
    ALL_TEST_ENTITIES.forEach(entity => {
      const entityName = entity.name;
      this.mockData.set(entityName, []);

      const mockRepository = this.createMockRepository(entityName);
      this.mockRepositories.set(entityName, mockRepository);
    });
  }

  private createMockRepository(entityName: string): Repository<any> {
    const entityData = this.mockData.get(entityName) || [];

    return {
      find: jest.fn().mockImplementation(async () => {
        return [...entityData];
      }),

      findOne: jest.fn().mockImplementation(async (options?: { where?: { id?: string } }) => {
        if (!options?.where?.id) return entityData[0] || null;

        return entityData.find(item => item.id === options.where.id) || null;
      }),

      save: jest.fn().mockImplementation(async (entity: any) => {
        if (!entity.id) {
          entity.id = this.generateMockId(entityName);
        }

        const existingIndex = entityData.findIndex(item => item.id === entity.id);
        if (existingIndex >= 0) {
          entityData[existingIndex] = { ...entity };
        } else {
          entityData.push({ ...entity });
        }

        return { ...entity };
      }),

      remove: jest.fn().mockImplementation(async (entity: any) => {
        const index = entityData.findIndex(item => item.id === entity.id);
        if (index >= 0) {
          entityData.splice(index, 1);
        }
        return entity;
      }),

      delete: jest.fn().mockImplementation(async (criteria: { id?: string }) => {
        const initialLength = entityData.length;
        if (criteria.id) {
          const index = entityData.findIndex(item => item.id === criteria.id);
          if (index >= 0) {
            entityData.splice(index, 1);
          }
        }
        return { affected: initialLength - entityData.length };
      }),

      clear: jest.fn().mockImplementation(async () => {
        entityData.length = 0;
        return undefined;
      }),

      query: jest.fn().mockImplementation(async (sql: string) => {
        // Базовая обработка SQL запросов
        if (sql.includes('SELECT 1')) {
          return [{ '?column?': 1 }];
        }
        return [];
      }),

      createQueryBuilder: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue(null),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      })),

      metadata: {
        name: entityName,
        targetName: entityName,
        tableName: entityName.toLowerCase(),
        columns: [],
        relations: [],
      },
    } as any;
  }

  private createMockManager(): EntityManager {
    return {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT 1')) {
          return [{ '?column?': 1 }];
        }
        return [];
      }),
      getRepository: <Entity>(target: any): Repository<Entity> => this.getRepository(target),
    } as any;
  }

  // Маппинг сущностей к типам их первичных ключей
  private entityIdTypes = new Map<string, 'number' | 'string'>([
    ['User', 'string'], // UUID
    ['Character', 'number'], // Auto-increment
    ['Dialog', 'number'], // Auto-increment
    ['Need', 'number'], // Auto-increment
    ['CharacterMemory', 'number'], // Auto-increment
    ['CharacterMotivation', 'number'], // Auto-increment
    ['Action', 'number'], // Auto-increment
    ['Message', 'number'], // Auto-increment
    ['AccessKey', 'string'], // UUID
    ['PsychologicalTest', 'number'], // Auto-increment
  ]);

  private mockIdCounter = 1;

  private generateMockId(entityName?: string): string | number {
    const idType = entityName ? this.entityIdTypes.get(entityName) : 'number';

    if (idType === 'string') {
      // Генерируем UUID-подобный строковый ID
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 11)}`;
    } else {
      // Генерируем числовой ID
      return this.mockIdCounter++;
    }
  }

  async initialize(): Promise<IMockIntegrationDataSource> {
    this._isInitialized = true;
    return this;
  }

  async destroy(): Promise<void> {
    this._isInitialized = false;
    this.mockData.clear();
    this.mockRepositories.clear();
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  getRepository<Entity>(target: any): Repository<Entity> {
    const entityName = typeof target === 'string' ? target : target.name;
    return this.mockRepositories.get(entityName) || this.createMockRepository(entityName);
  }

  createQueryRunner(): QueryRunner {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT 1')) {
          return [{ '?column?': 1 }];
        }
        return [];
      }),
      manager: this._manager,
    } as any;
  }

  get manager(): EntityManager {
    return this._manager;
  }

  /**
   * Очистка всех mock данных для тестов
   */
  async clearAllMockData(): Promise<void> {
    this.mockData.forEach(entityData => {
      entityData.length = 0;
    });
  }

  /**
   * Получение mock данных для сущности (для отладки в тестах)
   */
  getMockData(entityName: string): any[] {
    return this.mockData.get(entityName) || [];
  }
}

/**
 * Создает и инициализирует mock DataSource для интеграционных тестов
 */
export async function createMockIntegrationDataSource(): Promise<IMockIntegrationDataSource> {
  const mockDataSource = new MockIntegrationDataSource();
  await mockDataSource.initialize();
  return mockDataSource;
}
