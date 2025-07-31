/* eslint-disable */
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import {
  getDataSourceToken,
  getRepositoryToken as typeormGetRepositoryToken,
} from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../utils/data-source';
import { ALL_TEST_ENTITIES } from '../entities';
import { DbConnectionManager } from '../utils/db-connection-manager';

// Глобальное хранилище единственного DataSource, чтобы избежать создания
// множества подключений и ошибки "too many clients already" при параллельных тестах.
let globalTestDataSource: DataSource | null = null;

// Генератор уникальных ID для моков
let mockIdCounter = 1;

// Маппинг сущностей к типам их первичных ключей
const entityIdTypes = new Map<string, 'number' | 'string'>([
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

const getMockId = (entityName?: string) => {
  const idType = entityName ? entityIdTypes.get(entityName) : 'number';

  if (idType === 'string') {
    // Генерируем UUID-подобный строковый ID
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 11)}`;
  } else {
    // Генерируем числовой ID
    return mockIdCounter++;
  }
};

// Хранилище для данных мок-репозиториев
const mockRepositoryStorage = new Map<string, any[]>();

// Интерфейс для расширенного мок-DataSource
interface MockDataSource extends DataSource {
  clearAllRepositories?: () => void;
}

// Улучшенный мок для репозитория с реализацией основных методов
const createMockRepository = (entity: any) => {
  // Получаем имя сущности
  const entityName =
    typeof entity === 'string' ? entity : entity.name || entity.constructor?.name || 'Unknown';

  // Получаем или создаем хранилище для этой сущности
  if (!mockRepositoryStorage.has(entityName)) {
    mockRepositoryStorage.set(entityName, []);
  }

  const storage = mockRepositoryStorage.get(entityName)!;

  return {
    target: { name: entityName },
    metadata: { name: entityName, columns: [] },

    create: jest.fn().mockImplementation((entityLike: any) => {
      const id = getMockId(entityName);
      return { id, ...entityLike };
    }),

    save: jest.fn().mockImplementation(async (entity: any) => {
      if (entity.id) {
        // Обновление существующей сущности
        const index = storage.findIndex(item => String(item.id) === String(entity.id));
        if (index !== -1) {
          storage[index] = { ...storage[index], ...entity };
          return storage[index];
        }
      } else {
        // Создание новой сущности
        entity.id = getMockId(entityName);
      }

      storage.push(entity);
      return entity;
    }),

    find: jest.fn().mockImplementation(async (options: any = {}) => {
      let results = [...storage];

      if (options.where) {
        results = storage.filter(item =>
          Object.keys(options.where).every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(item[key]) === String(options.where[key]);
            }
            return item[key] === options.where[key];
          }),
        );
      }

      // Применяем сортировку
      if (options.order) {
        const orderKey = Object.keys(options.order)[0];
        const orderDirection = options.order[orderKey];
        results.sort((a, b) => {
          if (orderDirection === 'DESC') {
            return a[orderKey] < b[orderKey] ? 1 : -1;
          } else {
            return a[orderKey] > b[orderKey] ? 1 : -1;
          }
        });
      }

      // Применяем лимит
      if (options.take) {
        results = results.slice(0, options.take);
      }

      return results;
    }),

    findOne: jest.fn().mockImplementation(async (options: any = {}) => {
      if (options.where) {
        return (
          storage.find(item =>
            Object.keys(options.where).every(key => {
              // Для ID используем строковое сравнение
              if (key === 'id') {
                return String(item[key]) === String(options.where[key]);
              }
              return item[key] === options.where[key];
            }),
          ) || null
        );
      }
      return storage[0] || null;
    }),

    findOneBy: jest.fn().mockImplementation(async (where: any) => {
      return (
        storage.find(item =>
          Object.keys(where).every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(item[key]) === String(where[key]);
            }
            return item[key] === where[key];
          }),
        ) || null
      );
    }),

    findBy: jest.fn().mockImplementation(async (where: any) => {
      return storage.filter(item =>
        Object.keys(where).every(key => {
          // Для ID используем строковое сравнение
          if (key === 'id') {
            return String(item[key]) === String(where[key]);
          }
          return item[key] === where[key];
        }),
      );
    }),

    findAndCount: jest.fn().mockImplementation(async (options: any = {}) => {
      let results = [...storage];

      if (options.where) {
        results = storage.filter(item =>
          Object.keys(options.where).every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(item[key]) === String(options.where[key]);
            }
            return item[key] === options.where[key];
          }),
        );
      }

      // Применяем сортировку
      if (options.order) {
        const orderKey = Object.keys(options.order)[0];
        const orderDirection = options.order[orderKey];
        results.sort((a, b) => {
          if (orderDirection === 'DESC') {
            return a[orderKey] < b[orderKey] ? 1 : -1;
          } else {
            return a[orderKey] > b[orderKey] ? 1 : -1;
          }
        });
      }

      // Применяем лимит
      if (options.take) {
        results = results.slice(0, options.take);
      }

      return [results, results.length];
    }),

    remove: jest.fn().mockImplementation(async (entities: any | any[]) => {
      const entitiesToRemove = Array.isArray(entities) ? entities : [entities];

      entitiesToRemove.forEach(entity => {
        const index = storage.findIndex(item => String(item.id) === String(entity.id));
        if (index !== -1) {
          storage.splice(index, 1);
        }
      });

      return entitiesToRemove;
    }),

    delete: jest.fn().mockImplementation(async (criteria: any) => {
      let deletedCount = 0;

      if (typeof criteria === 'object' && criteria !== null) {
        // Удаление по критериям
        for (let i = storage.length - 1; i >= 0; i--) {
          const item = storage[i];
          const matches = Object.keys(criteria).every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(item[key]) === String(criteria[key]);
            }
            return item[key] === criteria[key];
          });

          if (matches) {
            storage.splice(i, 1);
            deletedCount++;
          }
        }
      } else {
        // Удаление по ID
        const index = storage.findIndex(item => String(item.id) === String(criteria));
        if (index !== -1) {
          storage.splice(index, 1);
          deletedCount = 1;
        }
      }

      return { affected: deletedCount };
    }),

    update: jest.fn().mockImplementation(async (criteria: any, partialEntity: any) => {
      let updatedCount = 0;

      for (const item of storage) {
        const matches =
          typeof criteria === 'object'
            ? Object.keys(criteria).every(key => {
                // Для ID используем строковое сравнение
                if (key === 'id') {
                  return String(item[key]) === String(criteria[key]);
                }
                return item[key] === criteria[key];
              })
            : String(item.id) === String(criteria);

        if (matches) {
          Object.assign(item, partialEntity);
          updatedCount++;
        }
      }

      return { affected: updatedCount };
    }),

    insert: jest.fn().mockImplementation(async (entity: any) => {
      if (!entity.id) {
        entity.id = getMockId(entity.name);
      }

      storage.push(entity);

      return {
        identifiers: [{ id: entity.id }],
        generatedMaps: [{ id: entity.id }],
        raw: [entity],
      };

      return entity;
    }),

    // ИСПРАВЛЕНИЕ: Перемещаю метод count в основной объект репозитория
    count: jest.fn().mockImplementation(async (options: any = {}) => {
      console.log(`[MOCK DEBUG] ${entityName} Repository count called with options:`, options);

      // Обрабатываем разные форматы опций
      let where = options.where || options;

      // Если передан просто объект с условиями (без where)
      if (typeof options === 'object' && !options.where && Object.keys(options).length > 0) {
        where = options;
      }

      // Если нет условий, возвращаем общее количество
      if (!where || Object.keys(where).length === 0) {
        console.log(`[MOCK DEBUG] ${entityName} Repository count returning total:`, storage.length);
        return storage.length;
      }

      // Фильтрация по условиям
      const count = storage.filter(item =>
        Object.keys(where).every(key => {
          // Для ID используем строковое сравнение
          if (key === 'id') {
            return String(item[key]) === String(where[key]);
          }
          return item[key] === where[key];
        }),
      ).length;

      console.log(
        `[MOCK DEBUG] ${entityName} Repository count with where ${JSON.stringify(where)} returning:`,
        count,
      );
      return count;
    }),

    createQueryBuilder: jest.fn().mockImplementation(() => {
      let whereConditions: any = {};
      let orderByField: string | null = null;
      let orderByDirection: 'ASC' | 'DESC' = 'ASC';
      let takeLimit: number | null = null;
      let skipOffset: number | null = null;

      const self = {
        where: jest.fn().mockImplementation((condition: string, params?: any) => {
          // Парсим простые условия вида "memory.characterId = :characterId"
          if (condition && params) {
            const match = condition.match(/(\w+)\.(\w+)\s*=\s*:(\w+)/);
            if (match) {
              const fieldName = match[2];
              const paramName = match[3];
              if (params[paramName] !== undefined) {
                whereConditions[fieldName] = params[paramName];
              }
            }
          }
          return self;
        }),
        andWhere: jest.fn().mockImplementation((condition: string, params?: any) => {
          // Аналогично where, но добавляем условие
          if (condition && params) {
            const match = condition.match(/(\w+)\.(\w+)\s*=\s*:(\w+)/);
            if (match) {
              const fieldName = match[2];
              const paramName = match[3];
              if (params[paramName] !== undefined) {
                whereConditions[fieldName] = params[paramName];
              }
            }
          }
          return self;
        }),
        orderBy: jest
          .fn()
          .mockImplementation((field: string, direction: 'ASC' | 'DESC' = 'ASC') => {
            // Убираем префикс таблицы из поля
            orderByField = field.includes('.') ? field.split('.')[1] : field;
            orderByDirection = direction;
            return self;
          }),
        addOrderBy: jest
          .fn()
          .mockImplementation((field: string, direction: 'ASC' | 'DESC' = 'ASC') => {
            // Для простоты, дополнительная сортировка игнорируется в моке
            // В реальном QueryBuilder это добавляет дополнительное поле сортировки
            return self;
          }),
        limit: jest.fn().mockImplementation((limit: number) => {
          takeLimit = limit;
          return self;
        }),
        take: jest.fn().mockImplementation((limit: number) => {
          takeLimit = limit;
          return self;
        }),
        skip: jest.fn().mockImplementation((offset: number) => {
          skipOffset = offset;
          return self;
        }),
        leftJoinAndSelect: jest.fn().mockImplementation(() => self),
        getOne: jest.fn().mockImplementation(async () => {
          let results = [...storage];

          // Применяем фильтрацию
          if (Object.keys(whereConditions).length > 0) {
            results = storage.filter(item =>
              Object.keys(whereConditions).every(key => {
                // Для ID используем строковое сравнение
                if (key === 'characterId' || key === 'id') {
                  return String(item[key]) === String(whereConditions[key]);
                }
                return item[key] === whereConditions[key];
              }),
            );
          }

          // Применяем сортировку
          if (orderByField) {
            results.sort((a, b) => {
              const aVal = a[orderByField];
              const bVal = b[orderByField];
              if (orderByDirection === 'DESC') {
                return aVal < bVal ? 1 : -1;
              } else {
                return aVal > bVal ? 1 : -1;
              }
            });
          }

          return results[0] || null;
        }),
        getMany: jest.fn().mockImplementation(async () => {
          let results = [...storage];

          // Применяем фильтрацию
          if (Object.keys(whereConditions).length > 0) {
            results = storage.filter(item =>
              Object.keys(whereConditions).every(key => {
                // Для ID используем строковое сравнение
                if (key === 'characterId' || key === 'id') {
                  return String(item[key]) === String(whereConditions[key]);
                }
                return item[key] === whereConditions[key];
              }),
            );
          }

          // Применяем сортировку
          if (orderByField) {
            results.sort((a, b) => {
              const aVal = a[orderByField];
              const bVal = b[orderByField];
              if (orderByDirection === 'DESC') {
                return aVal < bVal ? 1 : -1;
              } else {
                return aVal > bVal ? 1 : -1;
              }
            });
          }

          // Применяем пагинацию
          if (skipOffset !== null) {
            results = results.slice(skipOffset);
          }
          if (takeLimit !== null) {
            results = results.slice(0, takeLimit);
          }

          return results;
        }),
        getManyAndCount: jest.fn().mockImplementation(async () => {
          const results = await self.getMany();
          return [results, results.length];
        }),
      };
      return self;
    }),

    // Очистить хранилище для этого репозитория
    clear: jest.fn().mockImplementation(() => {
      mockRepositoryStorage.set(entityName, []);
    }),
  };
};

// Мок для DataSource, который используется, когда база данных не требуется
const mockDataSource = {
  isInitialized: true,
  initialize: async () => Promise.resolve(),
  destroy: async () => Promise.resolve(),
  createQueryRunner: () => ({
    connect: async () => Promise.resolve(),
    startTransaction: async () => Promise.resolve(),
    commitTransaction: async () => Promise.resolve(),
    rollbackTransaction: async () => Promise.resolve(),
    release: async () => Promise.resolve(),
    manager: {
      find: async () => [],
      findOne: async () => null,
      save: async (entity: any) => entity,
      update: async () => ({ affected: 1 }),
      delete: async () => ({ affected: 1 }),
      createQueryBuilder: () => ({
        where: () => ({ getOne: async () => null, getMany: async () => [] }),
      }),
    },
  }),
  getRepository: (entity: any) => {
    const entityName = entity?.name || 'MockEntity';
    return createMockRepository(entityName);
  },
  query: async () => [],
  manager: {
    query: async () => [],
    getRepository: (entity: any) => {
      const entityName = entity?.name || 'MockEntity';
      return createMockRepository(entityName);
    },
  },
  entityMetadatas: [],
  options: { type: 'postgres' },

  // Метод для очистки всех мок-хранилищ
  clearAllRepositories: () => {
    mockRepositoryStorage.clear();
    mockIdCounter = 1;
  },
} as unknown as MockDataSource;

/**
 * Модуль для предоставления DataSource в тестовом окружении
 * Использует singleton DataSource для всех тестов, чтобы избежать ошибки "too many clients already"
 */
@Global()
@Module({})
export class MockTypeOrmModule {
  /**
   * Создает модуль с провайдерами для DataSource
   */
  static forRoot(): DynamicModule {
    const providers: Provider[] = [
      {
        provide: getDataSourceToken(),
        useFactory: async () => {
          // Проверяем, требуется ли база данных для текущего теста
          const currentTest = (global as any).__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

          if (!requiresDatabase) {
            console.log(
              '[MockTypeOrmModule] Используем мок DataSource, т.к. requiresDatabase: false',
            );
            return mockDataSource;
          }

          // Используем глобальный DataSource, если он уже создан
          if (globalTestDataSource && globalTestDataSource.isInitialized) {
            return globalTestDataSource;
          }

          try {
            // Создаем новый DataSource и сохраняем его в глобальную переменную
            globalTestDataSource = await createTestDataSource();

            // Проверяем, что DataSource был успешно инициализирован
            if (!globalTestDataSource.isInitialized) {
              await globalTestDataSource.initialize();
            }

            // Регистрируем соединение в DbConnectionManager
            DbConnectionManager.registerConnection(globalTestDataSource);

            return globalTestDataSource;
          } catch (error) {
            console.error('[MockTypeOrmModule] Ошибка создания DataSource:', error);
            // В случае ошибки подключения к базе данных, возвращаем мок
            console.log('[MockTypeOrmModule] Возвращаем мок DataSource из-за ошибки подключения');
            return mockDataSource;
          }
        },
      },
      {
        provide: DataSource,
        useFactory: async () => {
          // Проверяем, требуется ли база данных для текущего теста
          const globalContext = global as {
            __currentTest?: { params?: { requiresDatabase?: boolean } };
          };
          const currentTest = globalContext.__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

          if (!requiresDatabase) {
            return mockDataSource;
          }

          // Используем глобальный DataSource, если он уже создан
          if (globalTestDataSource && globalTestDataSource.isInitialized) {
            return globalTestDataSource;
          }

          try {
            // Создаем новый DataSource и сохраняем его в глобальную переменную
            globalTestDataSource = await createTestDataSource();

            // Проверяем, что DataSource был успешно инициализирован
            if (!globalTestDataSource.isInitialized) {
              await globalTestDataSource.initialize();
            }

            // Регистрируем соединение в DbConnectionManager
            DbConnectionManager.registerConnection(globalTestDataSource);

            return globalTestDataSource;
          } catch (error) {
            console.error('[MockTypeOrmModule] Ошибка создания DataSource:', error);
            // В случае ошибки подключения к базе данных, возвращаем мок
            return mockDataSource;
          }
        },
      },
    ];

    return {
      module: MockTypeOrmModule,
      providers,
      exports: providers,
    };
  }

  /**
   * Создает модуль с провайдерами для DataSource с указанными сущностями
   */
  static forFeature(entities: any[]): DynamicModule {
    const providers: Provider[] = [
      {
        provide: getDataSourceToken(),
        useFactory: async () => {
          // Проверяем, требуется ли база данных для текущего теста
          const currentTest = (global as any).__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

          if (!requiresDatabase) {
            console.log(
              '[MockTypeOrmModule.forFeature] Используем мок DataSource, т.к. requiresDatabase: false',
            );
            return mockDataSource;
          }

          // Используем глобальный DataSource, если он уже создан
          if (globalTestDataSource && globalTestDataSource.isInitialized) {
            return globalTestDataSource;
          }

          try {
            // Создаем новый DataSource с указанными сущностями
            globalTestDataSource = await createTestDataSource();

            // Проверяем, что DataSource был успешно инициализирован
            if (!globalTestDataSource.isInitialized) {
              await globalTestDataSource.initialize();
            }

            // Регистрируем соединение в DbConnectionManager
            DbConnectionManager.registerConnection(globalTestDataSource);

            return globalTestDataSource;
          } catch (error) {
            console.error('[MockTypeOrmModule.forFeature] Ошибка создания DataSource:', error);
            // В случае ошибки подключения к базе данных, возвращаем мок
            return mockDataSource;
          }
        },
      },
      ...entities.map(entity => ({
        provide: typeormGetRepositoryToken(entity),
        useFactory: (dataSource: DataSource) => {
          // Проверяем, требуется ли база данных для текущего теста
          const currentTest = (global as any).__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

          if (!requiresDatabase) {
            console.log(
              `[MockTypeOrmModule.forFeature] Создаем мок репозиторий для ${entity.name}, т.к. requiresDatabase: false`,
            );
            const mockRepo = createMockRepository(entity);
            console.log(
              `[MockTypeOrmModule.forFeature] Мок репозиторий для ${entity.name} создан, методы:`,
              Object.getOwnPropertyNames(mockRepo),
            );
            console.log(
              `[MockTypeOrmModule.forFeature] Мок репозиторий для ${entity.name} имеет count:`,
              typeof mockRepo.count,
            );
            return mockRepo;
          }

          try {
            return dataSource.getRepository(entity);
          } catch (error) {
            console.error(
              `[MockTypeOrmModule.forFeature] Ошибка получения репозитория для ${entity.name}:`,
              error,
            );
            // Возвращаем улучшенный мок репозиторий
            const mockRepo = createMockRepository(entity);
            console.log(
              `[MockTypeOrmModule.forFeature] Мок репозиторий для ${entity.name} создан после ошибки, методы:`,
              Object.getOwnPropertyNames(mockRepo),
            );
            return mockRepo;
          }
        },
        inject: [getDataSourceToken()],
      })),
    ];

    return {
      module: MockTypeOrmModule,
      providers,
      exports: providers,
    };
  }

  /**
   * Очистить все мок-репозитории
   * Полезно для тестов, которые используют моки вместо реальной базы данных
   */
  static clearMocks(): void {
    // Очищаем все хранилища мок-репозиториев
    mockRepositoryStorage.clear();

    // Сбрасываем счетчик ID
    mockIdCounter = 1;

    // Выводим информацию в консоль только в режиме отладки
    if (process.env.DEBUG) {
      console.log('Все мок-репозитории очищены');
    }
  }

  /**
   * Очистить конкретный мок-репозиторий по имени сущности
   * @param entityName Имя сущности
   */
  static clearMockRepository(entityName: string): void {
    if (mockRepositoryStorage.has(entityName)) {
      mockRepositoryStorage.set(entityName, []);

      // Выводим информацию в консоль только в режиме отладки
      if (process.env.DEBUG) {
        console.log(`Мок-репозиторий для ${entityName} очищен`);
      }
    }
  }
}

// Хелпер-функция для получения токена репозитория - больше не нужна, используем оригинальную
// function getRepositoryToken(entity: any): string {
//   return `${entity.name}Repository`;
// }
