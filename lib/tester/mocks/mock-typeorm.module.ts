/* eslint-disable */
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken as typeormGetRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../utils/data-source';
import { ALL_TEST_ENTITIES } from '../entities';
import { DbConnectionManager } from '../utils/db-connection-manager';

// Глобальное хранилище единственного DataSource, чтобы избежать создания
// множества подключений и ошибки "too many clients already" при параллельных тестах.
let globalTestDataSource: DataSource | null = null;

// Генератор уникальных ID для моков
let mockIdCounter = 1;
const getMockId = () => mockIdCounter++;

// Хранилище для данных мок-репозиториев
const mockRepositoryStorage = new Map<string, any[]>();

// Интерфейс для расширенного мок-DataSource
interface MockDataSource extends DataSource {
  clearAllRepositories?: () => void;
}

// Улучшенный мок для репозитория с реализацией основных методов
const createMockRepository = (entityName: string) => {
  // Инициализируем хранилище для этого типа сущности, если его еще нет
  if (!mockRepositoryStorage.has(entityName)) {
    mockRepositoryStorage.set(entityName, []);
  }
  
  // Получаем хранилище для этой сущности
  const storage = mockRepositoryStorage.get(entityName) || [];

  return {
    metadata: { type: 'postgres', name: entityName },
    
    create: jest.fn().mockImplementation((data: any) => {
      // Добавляем ID, если его нет
      if (!data.id) {
        data.id = getMockId();
      }
      
      // Добавляем timestamps, если их нет
      if (!data.createdAt) {
        data.createdAt = new Date();
      }
      if (!data.updatedAt) {
        data.updatedAt = new Date();
      }
      
      return { ...data };
    }),
    
    save: jest.fn().mockImplementation(async (entity: any) => {
      // Если это массив, обрабатываем каждый элемент
      if (Array.isArray(entity)) {
        const repo = createMockRepository(entityName);
        return Promise.all(entity.map(item => repo.save(item)));
      }
      
      // Добавляем ID, если его нет
      if (!entity.id) {
        entity.id = getMockId();
      }
      
      // Обновляем updatedAt
      entity.updatedAt = new Date();
      
      // Если createdAt отсутствует, добавляем его
      if (!entity.createdAt) {
        entity.createdAt = new Date();
      }
      
      // Ищем существующую запись по ID
      const existingIndex = storage.findIndex(item => item.id === entity.id);
      
      if (existingIndex >= 0) {
        // Обновляем существующую запись
        storage[existingIndex] = { ...storage[existingIndex], ...entity };
        return storage[existingIndex];
      } else {
        // Добавляем новую запись
        storage.push(entity);
        return entity;
      }
    }),
    
    findOne: jest.fn().mockImplementation(async (options: any) => {
      // Обрабатываем разные форматы опций
      let where = options;
      
      // Обработка findOne({ where: ... })
      if (options && options.where) {
        where = options.where;
      }
      
      // Обработка findOne(id)
      if (typeof options === 'string' || typeof options === 'number') {
        where = { id: options };
      }
      
      // Поиск по ID
      if (where && where.id !== undefined) {
        const idToFind = where.id;
        return storage.find(item => {
          // Сравниваем строковые представления ID для поддержки разных типов
          return String(item.id) === String(idToFind);
        }) || null;
      }
      
      // Поиск по другим полям
      if (where && typeof where === 'object') {
        const keys = Object.keys(where);
        return storage.find(item => 
          keys.every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(item[key]) === String(where[key]);
            }
            return item[key] === where[key];
          })
        ) || null;
      }
      
      return null;
    }),
    
    find: jest.fn().mockImplementation(async (options: any = {}) => {
      // Обрабатываем разные форматы опций
      let where = options.where || {};
      
      // Фильтрация по условиям
      let results = [...storage];
      if (Object.keys(where).length > 0) {
        results = storage.filter(item => 
          Object.keys(where).every(key => item[key] === where[key])
        );
      }
      
      // Применяем пагинацию, если указана
      if (options.skip !== undefined || options.take !== undefined) {
        const skip = options.skip || 0;
        const take = options.take !== undefined ? options.take : results.length;
        results = results.slice(skip, skip + take);
      }
      
      // Применяем сортировку, если указана
      if (options.order) {
        const orderKey = Object.keys(options.order)[0];
        const orderDir = options.order[orderKey];
        
        results = [...results].sort((a, b) => {
          if (orderDir === 'ASC') {
            return a[orderKey] > b[orderKey] ? 1 : -1;
          } else {
            return a[orderKey] < b[orderKey] ? 1 : -1;
          }
        });
      }
      
      return results;
    }),
    
    findAndCount: jest.fn().mockImplementation(async (options: any = {}) => {
      const repo = createMockRepository(entityName);
      const results = await repo.find(options);
      
      // Для общего количества учитываем только фильтрацию, без пагинации
      let where = options.where || {};
      let totalCount = storage.length;
      
      if (Object.keys(where).length > 0) {
        totalCount = storage.filter(item => 
          Object.keys(where).every(key => item[key] === where[key])
        ).length;
      }
      
      return [results, totalCount];
    }),
    
    update: jest.fn().mockImplementation(async (criteria: any, partialEntity: any) => {
      let affected = 0;
      
      // Обновляем все записи, соответствующие критериям
      storage.forEach((item, index) => {
        if (typeof criteria === 'string' || typeof criteria === 'number') {
          // Если критерий - просто ID
          if (item.id === criteria) {
            storage[index] = { ...item, ...partialEntity, updatedAt: new Date() };
            affected++;
          }
        } else {
          // Если критерий - объект с условиями
          const keys = Object.keys(criteria);
          if (keys.every(key => item[key] === criteria[key])) {
            storage[index] = { ...item, ...partialEntity, updatedAt: new Date() };
            affected++;
          }
        }
      });
      
      return { affected };
    }),
    
    delete: jest.fn().mockImplementation(async (criteria: any) => {
      const initialLength = storage.length;
      
      // Удаляем все записи, соответствующие критериям
      if (typeof criteria === 'string' || typeof criteria === 'number') {
        // Если критерий - просто ID
        for (let i = storage.length - 1; i >= 0; i--) {
          if (storage[i].id === criteria) {
            storage.splice(i, 1);
          }
        }
      } else if (criteria && criteria.where) {
        // Если критерий имеет формат { where: {...} }
        const where = criteria.where;
        const keys = Object.keys(where);
        for (let i = storage.length - 1; i >= 0; i--) {
          if (keys.every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(storage[i][key]) === String(where[key]);
            }
            return storage[i][key] === where[key];
          })) {
            storage.splice(i, 1);
          }
        }
      } else if (criteria && typeof criteria === 'object') {
        // Если критерий - объект с условиями
        const keys = Object.keys(criteria);
        for (let i = storage.length - 1; i >= 0; i--) {
          if (keys.every(key => {
            // Для ID используем строковое сравнение
            if (key === 'id') {
              return String(storage[i][key]) === String(criteria[key]);
            }
            return storage[i][key] === criteria[key];
          })) {
            storage.splice(i, 1);
          }
        }
      }
      
      return { affected: initialLength - storage.length };
    }),
    
    remove: jest.fn().mockImplementation(async (entity: any) => {
      // Если это массив, обрабатываем каждый элемент
      if (Array.isArray(entity)) {
        const repo = createMockRepository(entityName);
        return Promise.all(entity.map(item => repo.remove(item)));
      }
      
      // Удаляем сущность по ID
      if (entity && entity.id) {
        const index = storage.findIndex(item => String(item.id) === String(entity.id));
        if (index >= 0) {
          storage.splice(index, 1);
          return entity;
        }
      }
      
      return entity;
    }),
    
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
        })
      ).length;
      
      console.log(`[MOCK DEBUG] ${entityName} Repository count with where ${JSON.stringify(where)} returning:`, count);
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
        orderBy: jest.fn().mockImplementation((field: string, direction: 'ASC' | 'DESC' = 'ASC') => {
          // Убираем префикс таблицы из поля
          orderByField = field.includes('.') ? field.split('.')[1] : field;
          orderByDirection = direction;
          return self;
        }),
        addOrderBy: jest.fn().mockImplementation((field: string, direction: 'ASC' | 'DESC' = 'ASC') => {
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
              })
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
              })
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
    })
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
  }
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
            console.log('[MockTypeOrmModule] Используем мок DataSource, т.к. requiresDatabase: false');
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
          const globalContext = global as { __currentTest?: { params?: { requiresDatabase?: boolean } } };
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
            console.log('[MockTypeOrmModule.forFeature] Используем мок DataSource, т.к. requiresDatabase: false');
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
            console.log(`[MockTypeOrmModule.forFeature] Создаем мок репозиторий для ${entity.name}, т.к. requiresDatabase: false`);
            return createMockRepository(entity.name);
          }
          
          try {
            return dataSource.getRepository(entity);
          } catch (error) {
            console.error(`[MockTypeOrmModule.forFeature] Ошибка получения репозитория для ${entity.name}:`, error);
            // Возвращаем улучшенный мок репозитория
            return createMockRepository(entity.name);
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
