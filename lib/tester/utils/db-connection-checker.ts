import { Client } from 'pg';
import { BASE_TEST_CONFIG } from '..';

/**
 * Модуль для проверки подключения к базе данных
 */

/**
 * Проверяет подключение к базе данных
 * @returns true если подключение успешно, false в противном случае
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  // Проверяем, требуется ли база данных для текущего теста

  const currentTest = (global as any).__currentTest;
  const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

  // Если база данных не требуется, возвращаем false
  if (!requiresDatabase) {
    return false;
  }

  const client = new Client({
    host: BASE_TEST_CONFIG.database.host,
    port: BASE_TEST_CONFIG.database.port,
    user: BASE_TEST_CONFIG.database.username,
    password: BASE_TEST_CONFIG.database.password,
    database: BASE_TEST_CONFIG.database.database,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch (error) {
    console.error(
      '❌ Ошибка подключения к тестовой базе данных:',
      error instanceof Error ? error.message : String(error),
    );
    console.error('Убедитесь, что контейнер с тестовой базой данных запущен:');
    console.error('docker compose -f docker-compose.test.yml up -d');
    try {
      await client.end();
    } catch (_) {
      // Игнорируем ошибки при закрытии соединения
    }
    return false;
  }
};

/**
 * Ожидает подключения к базе данных с повторными попытками
 * @param maxRetries максимальное количество попыток
 * @param retryInterval интервал между попытками в мс
 * @returns true если подключение успешно, false в противном случае
 */
export const waitForDatabaseConnection = async (
  maxRetries = 5,
  retryInterval = 2000,
): Promise<boolean> => {
  // Проверяем, требуется ли база данных для текущего теста

  const currentTest = (global as any).__currentTest;
  const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

  // Если база данных не требуется, возвращаем false
  if (!requiresDatabase) {
    return false;
  }

  for (let i = 0; i < maxRetries; i++) {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      return true;
    }

    if (i < maxRetries - 1) {
      console.log(`Ожидание ${retryInterval / 1000} секунд перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }

  console.error(`❌ Не удалось подключиться к базе данных после ${maxRetries} попыток`);
  return false;
};
