import { DataSource } from 'typeorm';
import { ALL_TEST_ENTITIES } from '../entities';
import { DbConnectionManager } from './db-connection-manager';
import { waitForDatabaseConnection } from './db-connection-checker';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

// Хранилище для уже созданных схем, чтобы избежать дублирования
const createdSchemas = new Set<string>();

/**
 * Генерирует уникальное имя схемы для тестов
 * @returns Уникальное имя схемы
 */
function generateUniqueSchemaName(): string {
  // Генерируем уникальное имя схемы и проверяем, что оно еще не использовалось
  let schemaName = `test_${uuidv4().replace(/-/g, '_').substring(0, 16)}`;

  // Если схема с таким именем уже существует, генерируем новое имя
  while (createdSchemas.has(schemaName)) {
    schemaName = `test_${uuidv4().replace(/-/g, '_').substring(0, 16)}`;
  }

  // Добавляем имя схемы в список созданных
  createdSchemas.add(schemaName);

  return schemaName;
}

/**
 * Создает схему в базе данных
 * @param schemaName Имя схемы для создания
 */
async function createSchema(schemaName: string): Promise<void> {
  const client = new Client({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    user: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    // Проверяем существование схемы перед созданием
    const checkResult = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName],
    );

    if (checkResult.rows.length === 0) {
      // Схема не существует, создаем её
      await client.query(`CREATE SCHEMA ${schemaName}`);
      console.log(`✅ Схема ${schemaName} успешно создана`);
    } else {
      console.log(`✅ Схема ${schemaName} уже существует`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при создании схемы ${schemaName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Создает тестовое подключение к базе данных
 * @param entities Опциональный массив сущностей для TypeORM
 * @param checkConnection Проверять ли доступность базы данных перед созданием DataSource
 * @returns DataSource для тестовой базы данных
 */
export async function createTestDataSource(
  entities?: any[],
  checkConnection = true,
): Promise<DataSource> {
  // Проверяем доступность базы данных, если требуется
  if (checkConnection) {
    const isConnected = await waitForDatabaseConnection();
    if (!isConnected) {
      throw new Error(
        'Не удалось подключиться к тестовой базе данных. Убедитесь, что контейнер запущен: docker compose -f docker-compose.test.yml up -d',
      );
    }
  }

  // Генерируем уникальное имя схемы для этого запуска теста
  const schemaName = generateUniqueSchemaName();

  // Создаем схему перед инициализацией DataSource
  await createSchema(schemaName);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    schema: schemaName,
    synchronize: true,
    dropSchema: true,
    logging: false,
    entities: entities || ALL_TEST_ENTITIES,
    extra: {
      max: 1, // Минимизируем количество соединений для тестов
      min: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      acquireTimeoutMillis: 5000,
    },
  });

  // Регистрируем соединение в менеджере соединений
  DbConnectionManager.registerConnection(dataSource);

  return dataSource;
}

/**
 * Создает тестовое подключение к базе данных (синхронная версия для обратной совместимости)
 * @deprecated Используйте асинхронную версию createTestDataSource
 * @param entities Опциональный массив сущностей для TypeORM
 * @returns DataSource для тестовой базы данных
 */
export function createTestDataSourceSync(entities?: any[]): DataSource {
  console.warn(
    'ПРЕДУПРЕЖДЕНИЕ: Использование устаревшей синхронной версии createTestDataSource. Рекомендуется перейти на асинхронную версию.',
  );

  // Генерируем уникальное имя схемы для этого запуска теста
  const schemaName = generateUniqueSchemaName();

  // В синхронной версии мы не можем создать схему асинхронно,
  // поэтому полагаемся на то, что TypeORM сделает это автоматически

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    schema: schemaName,
    synchronize: true,
    dropSchema: true,
    logging: false,
    entities: entities || ALL_TEST_ENTITIES,
    extra: {
      max: 1,
      min: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      acquireTimeoutMillis: 5000,
    },
  });

  // Регистрируем соединение в менеджере соединений
  DbConnectionManager.registerConnection(dataSource);

  return dataSource;
}
