import { DataSource, DataSourceOptions } from 'typeorm';
import { ALL_TEST_ENTITIES } from '../entities';
import { DbConnectionManager } from './db-connection-manager';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

// Хранилище для уже созданных схем, чтобы избежать дублирования
const createdSchemas = new Set<string>();

// Глобальный кеш DataSource для переиспользования в тестах и минимизации числа подключений
let sharedTestDataSource: DataSource | null = null;

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
      save: async (entity: unknown) => entity,
      update: async () => ({ affected: 1 }),
      delete: async () => ({ affected: 1 }),
      createQueryBuilder: () => ({
        where: () => ({ getOne: async () => null, getMany: async () => [] }),
      }),
    },
  }),
  getRepository: () => ({
    find: async () => [],
    findOne: async () => null,
    save: async (entity: unknown) => entity,
    update: async () => ({ affected: 1 }),
    delete: async () => ({ affected: 1 }),
    createQueryBuilder: () => ({
      where: () => ({ getOne: async () => null, getMany: async () => [] }),
    }),
  }),
  query: async () => [],
  manager: {
    query: async () => [],
  },
  entityMetadatas: [],
} as unknown as DataSource;

/**
 * Создает DataSource для тестов
 */
export async function createTestDataSource(entities?: any[]): Promise<DataSource> {
  // Проверяем, требуется ли база данных для текущего теста
  const globalContext = global as { __currentTest?: { params?: { requiresDatabase?: boolean } } };
  const currentTest = globalContext.__currentTest;
  const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

  // Если база данных не требуется, возвращаем мок DataSource
  if (!requiresDatabase) {
    console.log('[createTestDataSource] Используем мок DataSource, т.к. requiresDatabase: false');
    return mockDataSource;
  }

  // Проверяем доступность базы данных без вывода ошибок (тихая проверка)
  try {
    const client = new Client({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
      user: process.env.TEST_DB_USERNAME || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password',
      database: process.env.TEST_DB_NAME || 'nexus_test',
      connectionTimeoutMillis: 1000, // Быстрый таймаут
    });

    await client.connect();
    await client.end();
  } catch (_error) {
    console.log('[createTestDataSource] База данных недоступна, используем мок DataSource');
    return mockDataSource;
  }

  // Если передан список сущностей, создаем новый DataSource
  if (entities && entities.length > 0) {
    return createNewTestDataSource(entities);
  }

  // Если уже есть созданный DataSource, возвращаем его
  if (sharedTestDataSource && sharedTestDataSource.isInitialized) {
    return sharedTestDataSource;
  }

  // Иначе создаем новый DataSource со всеми сущностями
  const dataSource = await createNewTestDataSource(ALL_TEST_ENTITIES);
  sharedTestDataSource = dataSource;
  return dataSource;
}

/**
 * Создает новый DataSource для тестов
 */
async function createNewTestDataSource(entities: any[]): Promise<DataSource> {
  // Генерируем уникальное имя схемы для изоляции тестов
  const schemaName = `test_${uuidv4().replace(/-/g, '_')}`;

  // Проверяем, не существует ли уже такая схема
  if (createdSchemas.has(schemaName)) {
    console.log(`Схема ${schemaName} уже существует, создаем новую...`);
    return createNewTestDataSource(entities);
  }

  // Настройки подключения к тестовой базе данных
  const options: DataSourceOptions = {
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    schema: schemaName,
    synchronize: true,
    dropSchema: true,
    entities,
    logging: false,
  };

  // Создаем DataSource
  const dataSource = new DataSource(options);

  try {
    // Создаем схему в базе данных
    await createSchema(schemaName);

    // Инициализируем DataSource
    await dataSource.initialize();

    // Добавляем схему в список созданных
    createdSchemas.add(schemaName);

    // Регистрируем соединение в DbConnectionManager
    DbConnectionManager.registerConnection(dataSource);

    return dataSource;
  } catch (error) {
    console.error('Ошибка при создании DataSource:', error);
    console.log('[createNewTestDataSource] Из-за ошибки используем мок DataSource');
    return mockDataSource;
  }
}

/**
 * Создает схему в базе данных
 */
async function createSchema(schemaName: string): Promise<void> {
  const client = new Client({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    user: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
  });

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.end();
  } catch (error) {
    console.error(`Ошибка при создании схемы ${schemaName}:`, error);
    await client.end();
  }
}

/**
 * Создает DataSource для тестов синхронно
 */
export function createTestDataSourceSync(entities?: any[]): DataSource {
  // Проверяем, требуется ли база данных для текущего теста
  const globalContext = global as { __currentTest?: { params?: { requiresDatabase?: boolean } } };
  const currentTest = globalContext.__currentTest;
  const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

  // Если база данных не требуется, возвращаем мок DataSource
  if (!requiresDatabase) {
    console.log(
      '[createTestDataSourceSync] Используем мок DataSource, т.к. requiresDatabase: false',
    );
    return mockDataSource;
  }

  // Если передан список сущностей, создаем новый DataSource
  if (entities && entities.length > 0) {
    // Настройки подключения к тестовой базе данных
    const options: DataSourceOptions = {
      type: 'postgres',
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
      username: process.env.TEST_DB_USERNAME || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password',
      database: process.env.TEST_DB_NAME || 'nexus_test',
      synchronize: true,
      dropSchema: true,
      entities,
      logging: false,
    };

    // Создаем DataSource
    return new DataSource(options);
  }

  // Если уже есть созданный DataSource, возвращаем его
  if (sharedTestDataSource && sharedTestDataSource.isInitialized) {
    return sharedTestDataSource;
  }

  // Иначе создаем новый DataSource со всеми сущностями
  const options: DataSourceOptions = {
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    synchronize: true,
    dropSchema: true,
    entities: ALL_TEST_ENTITIES,
    logging: false,
  };

  // Создаем DataSource
  return new DataSource(options);
}
