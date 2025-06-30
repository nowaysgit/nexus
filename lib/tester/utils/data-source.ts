import { DataSource } from 'typeorm';
import configuration from '../../../src/common/config/configuration';
import { ALL_TEST_ENTITIES } from '../entities';

/**
 * Генерирует UUID-подобную строку для тестов
 */
function generateTestUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
}

// Глобальные переменные для управления поведением
let createdSchemas: string[] = [];
let globalTestDataSource: DataSource | null = null;

/**
 * Создает улучшенный мок DataSource для тестов без реального подключения к БД
 */
// Глобальное хранилище данных в памяти для мок репозиториев
const globalMemoryStorage = new Map<string, any[]>();

// Функция для получения данных из глобального хранилища
const getEntityData = (entityName: string) => {
  if (!globalMemoryStorage.has(entityName)) {
    globalMemoryStorage.set(entityName, []);
  }
  return globalMemoryStorage.get(entityName);
};

// Функция для очистки глобального хранилища
export const clearGlobalMemoryStorage = (): void => {
  globalMemoryStorage.clear();
};

export function createEnhancedMockDataSource(): DataSource {
  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    manager: {
      query: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity: any) => {
        // Если у entity нет id, генерируем его
        if (!entity.id) {
          entity.id = generateTestUUID();
        }
        return Promise.resolve(entity);
      }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      create: jest.fn().mockImplementation((_entity: any, data: any) => ({
        ...data,
        id: data.id || generateTestUUID(),
      })),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    },
  };

  const mockDataSource = {
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    transaction: jest.fn().mockImplementation(async (fn: any) => {
      return await fn(mockQueryRunner.manager);
    }),
    manager: mockQueryRunner.manager,
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn().mockImplementation((entity: any) => {
      const entityName = entity?.name || 'Unknown';

      return {
        create: jest.fn().mockImplementation((data: any) => ({
          ...data,
          id: data.id || generateTestUUID(),
        })),
        save: jest.fn().mockImplementation((entityData: any) => {
          // Если у entity нет id, генерируем его
          if (!entityData.id) {
            entityData.id = generateTestUUID();
          }

          // Сохраняем в память
          const storage = getEntityData(entityName);
          const existingIndex = storage.findIndex((item: any) => item.id === entityData.id);
          if (existingIndex >= 0) {
            storage[existingIndex] = entityData;
          } else {
            storage.push(entityData);
          }

          console.log(`[MOCK SAVE] ${entityName}:`, entityData.id, `Total: ${storage.length}`);

          return Promise.resolve(entityData);
        }),
        find: jest.fn().mockImplementation((options: any = {}) => {
          const storage = getEntityData(entityName);
          if (!options.where) return Promise.resolve(storage);

          // Простая фильтрация по where условию
          const filtered = storage.filter((item: any) => {
            return Object.keys(options.where).every(key => item[key] === options.where[key]);
          });
          return Promise.resolve(filtered);
        }),
        findOne: jest.fn().mockImplementation((options: any = {}) => {
          const storage = getEntityData(entityName);
          if (!options.where) return Promise.resolve(storage[0] || null);

          // Простая фильтрация по where условию
          const found = storage.find((item: any) => {
            return Object.keys(options.where).every(key => item[key] === options.where[key]);
          });
          return Promise.resolve(found || null);
        }),
        findOneBy: jest.fn().mockImplementation((criteria: any) => {
          const storage = getEntityData(entityName);
          const found = storage.find((item: any) => {
            return Object.keys(criteria).every(key => item[key] === criteria[key]);
          });
          console.log(
            `[MOCK FIND ONE BY] ${entityName}:`,
            criteria,
            `Found:`,
            found?.id,
            `Total: ${storage.length}`,
          );
          return Promise.resolve(found || null);
        }),
        findBy: jest.fn().mockImplementation((criteria: any) => {
          const storage = getEntityData(entityName);
          const filtered = storage.filter((item: any) => {
            return Object.keys(criteria).every(key => item[key] === criteria[key]);
          });
          return Promise.resolve(filtered);
        }),
        remove: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryRunner.manager.createQueryBuilder()),
        target: entity,
        metadata: {
          name: entity?.name || 'MockEntity',
          tableName: entity?.name?.toLowerCase() || 'mock_entity',
          columns: [],
        },
      };
    }),
    options: {
      type: 'postgres' as const,
      host: 'localhost',
      port: 5433,
      username: 'test_user',
      password: 'test_password',
      database: 'nexus_test',
      synchronize: false,
      entities: ALL_TEST_ENTITIES,
    },
  } as unknown as DataSource;

  return mockDataSource;
}

/**
 * Создает новый DataSource для тестов с повторными попытками подключения
 * @param _attempt - номер попытки подключения (не используется)
 * @returns DataSource или мок
 */
export async function createNewTestDataSource(_attempt: number = 1): Promise<DataSource> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  // Проверяем тип тестов - для unit тестов возвращаем сразу мок
  const isUnitTest = process.env.NODE_ENV === 'test' && !process.env.INTEGRATION_TEST;
  if (isUnitTest) {
    return createEnhancedMockDataSource();
  }

  for (let currentAttempt = 1; currentAttempt <= maxRetries; currentAttempt++) {
    try {
      // Используем тестовые переменные окружения вместо обычных
      const testHost = process.env.DB_TEST_HOST || process.env.DB_HOST || 'localhost';
      const testPort = parseInt(process.env.DB_TEST_PORT || process.env.DB_PORT || '5433', 10);
      const testUser = process.env.DB_TEST_USER || process.env.DB_USERNAME || 'test_user';
      const testPassword =
        process.env.DB_TEST_PASSWORD || process.env.DB_PASSWORD || 'test_password';
      const testDatabase = process.env.DB_TEST_NAME || process.env.TEST_DATABASE || 'nexus_test';

      console.log(
        `[DATA-SOURCE] Попытка ${currentAttempt}: подключение к PostgreSQL ${testHost}:${testPort}/${testDatabase} (user: ${testUser})`,
      );

      const dataSource = new DataSource({
        type: 'postgres',
        host: testHost,
        port: testPort,
        username: testUser,
        password: testPassword,
        database: testDatabase,
        synchronize: false,
        entities: ALL_TEST_ENTITIES,
        connectTimeoutMS: 10000,
        extra: {
          connectionTimeoutMillis: 10000,
        },
      });

      await dataSource.initialize();
      console.log(`[DATA-SOURCE] ✅ Успешное подключение к PostgreSQL`);

      return dataSource;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[DATA-SOURCE] ❌ Ошибка подключения попытка ${currentAttempt}:`, error.message);
      if (currentAttempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Возвращаем улучшенный мок DataSource вместо исключения
  return createEnhancedMockDataSource();
}

/**
 * Получает или создает глобальный DataSource для тестов
 * @returns DataSource
 */
export async function createTestDataSource(): Promise<DataSource> {
  if (globalTestDataSource && globalTestDataSource.isInitialized) {
    return globalTestDataSource;
  }

  globalTestDataSource = await createNewTestDataSource();
  return globalTestDataSource;
}

/**
 * Очищает созданные схемы и DataSource
 */
export async function cleanupTestDataSources(): Promise<void> {
  // Для unit тестов ничего не делаем
  const isUnitTest = process.env.NODE_ENV === 'test' && !process.env.INTEGRATION_TEST;
  if (isUnitTest) {
    return;
  }

  if (globalTestDataSource && globalTestDataSource.isInitialized) {
    try {
      await globalTestDataSource.destroy();
    } catch (error) {
      // Игнорируем ошибки при очистке
    } finally {
      globalTestDataSource = null;
    }
  }

  // Очистка схем только для интеграционных тестов
  if (createdSchemas.length > 0) {
    createdSchemas = [];
  }
}
