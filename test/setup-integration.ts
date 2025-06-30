// Настройка для интеграционных тестов
import 'reflect-metadata';
import { DbConnectionManager } from '../lib/tester/utils/db-connection-manager';
import { DataSource } from 'typeorm';
import { cleanupTestDataSources } from '../lib/tester/utils/data-source';
import { isPostgresAvailable } from '../lib/tester/utils/db-connection-checker';

// Глобальный счетчик для тестов
let testCounter = 0;

// Глобальный DataSource для переиспользования в интеграционных тестах
let globalIntegrationDataSource: DataSource | null = null;

/**
 * Глобальная настройка перед запуском всех интеграционных тестов
 */
beforeAll(async () => {
  // Проверяем доступность PostgreSQL
  const pgAvailable = await isPostgresAvailable();
  if (!pgAvailable) {
    console.error('❌ PostgreSQL недоступен! Убедитесь, что контейнер запущен:');
    console.error('docker compose -f docker-compose.test.yml up -d');
    process.exit(1);
  }

  console.log('✅ PostgreSQL доступен, начинаем интеграционные тесты');

  // Увеличиваем таймаут для Jest
  jest.setTimeout(60000);
});

// Перед каждым тестом
beforeEach(() => {
  testCounter++;
  // Сохраняем информацию о текущем тесте в глобальном контексте
  const globalContext = global as {
    __currentTest?: { index: number; startTime: number; params: Record<string, unknown> };
  };
  globalContext.__currentTest = {
    index: testCounter,
    startTime: Date.now(),
    params: { requiresDatabase: true }, // По умолчанию для интеграционных тестов
  };
});

// После каждого теста
afterEach(async () => {
  const globalContext = global as {
    __currentTest?: { index: number; startTime: number; params: Record<string, unknown> };
  };
  const currentTest = globalContext.__currentTest;
  const testDuration = Date.now() - (currentTest?.startTime || 0);

  // Логируем длительные тесты (более 5 секунд)
  if (testDuration > 5000) {
    console.log(
      `[SLOW TEST] Интеграционный тест #${currentTest?.index} выполнялся ${testDuration}ms`,
    );
  }

  // Очищаем тестовые данные
  globalContext.__currentTest = undefined;

  // Проверяем и закрываем соединения с базой данных
  const connections = DbConnectionManager.getConnections();
  if (connections.length > 0) {
    for (const connection of connections) {
      if (connection.isInitialized) {
        try {
          await connection.destroy();
        } catch (error) {
          console.error('Ошибка при закрытии соединения:', error);
        }
      }
    }
    DbConnectionManager.clearConnections();
  }

  // Принудительно очищаем память
  if (global.gc) {
    global.gc();
  }

  // Очистка моков после каждого интеграционного теста
  jest.clearAllMocks();
});

/**
 * Глобальная очистка после выполнения всех интеграционных тестов
 */
afterAll(async () => {
  try {
    // Очищаем все тестовые DataSource
    await cleanupTestDataSources();

    // Закрываем глобальный DataSource
    if (globalIntegrationDataSource && globalIntegrationDataSource.isInitialized) {
      await globalIntegrationDataSource.destroy();
      globalIntegrationDataSource = null;
    }

    console.log('✅ Очистка интеграционного тестового окружения завершена');
  } catch (error) {
    console.error('❌ Ошибка при очистке интеграционного тестового окружения:', error);
  }

  // Даем время на завершение всех асинхронных операций
  await new Promise(resolve => setTimeout(resolve, 500));

  // Выводим общую статистику
  console.log('\nВсе интеграционные тесты завершены');

  // Принудительно очищаем память
  if (global.gc) {
    global.gc();
  }
});

/**
 * Настройка обработчиков ошибок для интеграционных тестов
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Integration Test at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception in Integration Test:', error);
  process.exit(1);
});

/**
 * Экспорт глобального DataSource для переиспользования в интеграционных тестах
 */
export { globalIntegrationDataSource };
