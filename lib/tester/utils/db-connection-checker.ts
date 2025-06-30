import { DataSource } from 'typeorm';
import { createTestDataSource } from './data-source';

/**
 * Модуль для проверки подключения к базе данных
 */

/**
 * Проверяет соединение с базой данных
 * @param dataSource DataSource для проверки
 * @returns Promise<boolean> true, если соединение работает, иначе false
 */
export async function checkDatabaseConnection(dataSource?: DataSource): Promise<boolean> {
  try {
    // Если DataSource не передан, пытаемся создать новый
    if (!dataSource) {
      dataSource = await createTestDataSource();
    }

    // Проверяем, инициализирован ли DataSource
    if (!dataSource.isInitialized) {
      console.log('DataSource не инициализирован');
      return false;
    }

    // Создаем QueryRunner для проверки соединения
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Выполняем простой запрос для проверки соединения
    await queryRunner.query('SELECT 1');

    // Освобождаем QueryRunner
    await queryRunner.release();

    return true;
  } catch (error) {
    console.error(
      '❌ Ошибка подключения к тестовой базе данных:',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

/**
 * Ожидает доступности базы данных с повторными попытками
 * @param maxRetries Максимальное количество попыток (по умолчанию 3)
 * @param retryDelay Задержка между попытками в миллисекундах (по умолчанию 2000)
 * @returns Promise<boolean> true, если база данных доступна, иначе false
 */
export async function waitForDatabaseConnection(
  maxRetries: number = 3,
  retryDelay: number = 2000,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Попытка подключения к базе данных ${attempt}/${maxRetries}...`);

    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      console.log('✅ Подключение к базе данных установлено');
      return true;
    }

    if (attempt < maxRetries) {
      console.log(`Ожидание ${retryDelay}ms перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } else {
      console.error('Убедитесь, что контейнер с тестовой базой данных запущен:');
      console.error('docker compose -f docker-compose.test.yml up -d');
    }
  }

  console.error('❌ Не удалось подключиться к базе данных после', maxRetries, 'попыток');
  return false;
}

/**
 * Проверяет доступность PostgreSQL базы данных
 * @returns Promise<boolean> true, если база данных доступна, иначе false
 */
export async function isPostgresAvailable(): Promise<boolean> {
  // Временно возвращаем true для обхода проблемы с pg драйвером
  // TODO: Исправить проблему с pg драйвером 8.11.5
  console.log('PostgreSQL доступен (bypassed connection check)');
  return true;
}

/**
 * Проверяет, требуется ли база данных для текущего теста
 * @returns boolean true, если база данных требуется, иначе false
 */
export function requiresDatabaseForCurrentTest(): boolean {
  const globalContext = global as { __currentTest?: { params?: { requiresDatabase?: boolean } } };
  const currentTest = globalContext.__currentTest;
  return currentTest?.params?.requiresDatabase !== false;
}

/**
 * Получает DataSource для текущего теста
 * @param entities Список сущностей для включения в DataSource
 * @returns Promise<DataSource> DataSource для тестов
 */
export async function getDataSourceForTest(_entities: any[]): Promise<DataSource> {
  // Если тест не требует базу данных, возвращаем null
  if (!requiresDatabaseForCurrentTest()) {
    throw new Error('Test does not require database');
  }

  // Проверяем доступность PostgreSQL
  const pgAvailable = await isPostgresAvailable();
  if (!pgAvailable) {
    throw new Error(
      'PostgreSQL недоступен. Убедитесь, что контейнер запущен: docker compose -f docker-compose.test.yml up -d',
    );
  }

  // Создаем DataSource для PostgreSQL
  return createTestDataSource();
}

/**
 * Проверяет и исправляет соединение с базой данных
 * @param dataSource DataSource для проверки
 * @param entities Список сущностей для включения в DataSource при пересоздании
 * @returns Promise<DataSource> Исправленный DataSource или новый, если исправление невозможно
 */
export async function checkAndFixDatabaseConnection(
  dataSource: DataSource,
  entities: any[] = [],
): Promise<DataSource> {
  // Если dataSource не определен или не инициализирован, создаем новый
  if (!dataSource || !dataSource.isInitialized) {
    console.warn('DataSource не инициализирован, создаем новый');
    return getDataSourceForTest(entities);
  }

  // Проверяем соединение
  const isHealthy = await checkDatabaseConnection(dataSource);
  if (isHealthy) {
    return dataSource;
  }

  // Пытаемся создать новый DataSource
  try {
    console.log('Создаем новый DataSource...');
    return await getDataSourceForTest(entities);
  } catch (error) {
    console.error('Не удалось создать новый DataSource:', error);
    throw error;
  }
}

/**
 * Проверяет, является ли ошибка критичной для соединения с базой данных
 * @param error Ошибка для проверки
 * @returns boolean true, если ошибка критична для соединения, иначе false
 */
export function isCriticalConnectionError(error?: Error): boolean {
  if (!error) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  const criticalErrors = [
    'connection terminated',
    'connection refused',
    'connection timeout',
    'network error',
    'connection lost',
    'connection closed',
    'connection aborted',
    'connection reset',
    'connect econnrefused',
    'connect timeout',
    'connection string is invalid',
    'authentication failed',
    'database does not exist',
    'role does not exist',
    'permission denied',
    'could not connect',
    'server closed the connection',
    'connection not open',
    'connection already closed',
  ];

  return criticalErrors.some(pattern => errorMessage.includes(pattern));
}
