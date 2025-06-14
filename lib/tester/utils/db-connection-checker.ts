import { Client } from 'pg';

/**
 * Функция для проверки доступности базы данных
 * @returns Promise<boolean> true, если база данных доступна
 */
export async function checkDatabaseConnection(): Promise<boolean> {
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
    await client.query('SELECT 1');
    console.log('✅ Подключение к тестовой базе данных успешно установлено');
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
      // Игнорируем ошибку при закрытии соединения
    }
    return false;
  }
}

/**
 * Функция для проверки и ожидания доступности базы данных
 * @param maxRetries максимальное количество попыток
 * @param retryInterval интервал между попытками в миллисекундах
 * @returns Promise<boolean> true, если база данных стала доступна
 */
export async function waitForDatabaseConnection(
  maxRetries = 5,
  retryInterval = 2000,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      console.log(`Попытка подключения к базе данных ${i + 1}/${maxRetries}...`);
    }

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
}
