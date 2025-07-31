import { DataSource } from 'typeorm';
import { cleanupTestDataSources } from '../lib/tester/utils/data-source';
import { isPostgresAvailable } from '../lib/tester/utils/db-connection-checker';

// Глобальный DataSource для переиспользования
let globalDataSource: DataSource | null = null;

/**
 * Глобальная настройка перед запуском всех тестов
 */
beforeAll(async () => {
  // Проверяем доступность PostgreSQL с retry механизмом
  let pgAvailable = false;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Попытка ${attempt}/${maxRetries} подключения к PostgreSQL...`);
    pgAvailable = await isPostgresAvailable();

    if (pgAvailable) {
      console.log('✅ PostgreSQL доступен, начинаем тесты');
      break;
    }

    if (attempt < maxRetries) {
      console.log('Ожидание 2 секунды перед следующей попыткой...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!pgAvailable) {
    console.warn('⚠️ PostgreSQL недоступен, тесты будут использовать мок DataSource');
    console.warn(
      'Для полного тестирования запустите: docker compose -f docker-compose.test.yml up -d',
    );
  }
}, 5000);

/**
 * Глобальная очистка после выполнения всех тестов
 */
afterAll(async () => {
  try {
    // Очищаем все тестовые DataSource
    await cleanupTestDataSources();

    // Закрываем глобальный DataSource
    if (globalDataSource && globalDataSource.isInitialized) {
      await globalDataSource.destroy();
      globalDataSource = null;
    }

    console.log('✅ Очистка тестового окружения завершена');
  } catch (error: unknown) {
    console.error('❌ Ошибка при очистке тестового окружения:', error);
  }
}, 5000);

/**
 * Настройка таймаутов для Jest
 */
jest.setTimeout(5000);

/**
 * Настройка обработчиков ошибок
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Очистка моков после каждого теста
 */
afterEach(() => {
  jest.clearAllMocks();
});

/**
 * Экспорт глобального DataSource для переиспользования в тестах
 */
export { globalDataSource };
