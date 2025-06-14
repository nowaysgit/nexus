import { DataSource } from 'typeorm';
import { Tester, TestConfigType } from '../lib/tester';
import { DbConnectionManager } from '../lib/tester/utils/db-connection-manager';

/**
 * Настройка тестового окружения
 */
export const setupTests = async (): Promise<DataSource> => {
  try {
    // Настраиваем тестовое окружение с использованием Tester
    const tester = Tester.getInstance();
    const dataSource = await tester.setupTestEnvironment(TestConfigType.BASIC);

    // Регистрируем соединение в DbConnectionManager
    DbConnectionManager.registerConnection(dataSource);

    return dataSource;
  } catch (error) {
    console.error('Ошибка настройки тестового окружения:', error);
    throw error;
  }
};

/**
 * Глобальная очистка после всех тестов
 */
export const teardownTests = async (dataSource: DataSource): Promise<void> => {
  try {
    // Закрываем соединение с БД
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }

    // Закрываем все соединения через DbConnectionManager
    await DbConnectionManager.closeAllConnections();

    // Очищаем все таймеры
    for (let i = 1; i <= 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Даем время на завершение асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error('Ошибка при очистке тестового окружения:', error);
    throw error;
  }
};

// Настройка глобальных переменных для тестов
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_TEST = 'false'; // По умолчанию unit тесты

// Увеличиваем таймаут для всех тестов
jest.setTimeout(15000);

// Глобальная переменная для хранения dataSource
let globalDataSource: DataSource;

// Инициализация перед всеми тестами
beforeAll(async () => {
  globalDataSource = await setupTests();
});

// Глобальная очистка после всех тестов
afterAll(async () => {
  if (globalDataSource) {
    await teardownTests(globalDataSource);
  }
  // Принудительно закрываем все соединения Tester
  const tester = Tester.getInstance();
  await tester.forceCleanup();
});

// Обработка необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Обработка необработанных исключений
process.on('uncaughtException', error => {
  console.warn('Uncaught Exception:', error);
});
// Убираем принудительный exit, Jest самостоятельно завершит процесс
