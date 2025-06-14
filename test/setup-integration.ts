// Настройка для интеграционных тестов
import { DataSource } from 'typeorm';
import { BASE_TEST_CONFIG, Tester } from '../lib/tester';
import { DbConnectionManager } from '../lib/tester/utils/db-connection-manager';

// Устанавливаем переменные окружения
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_TEST = 'true';

// Увеличиваем таймауты для Jest
jest.setTimeout(60000);

// Глобальная очистка после всех тестов
afterAll(async () => {
  try {
    // Закрываем все соединения через DbConnectionManager
    await DbConnectionManager.closeAllConnections();

    // Принудительно закрываем все соединения с БД
    const connections = (DataSource as any).connections || [];
    for (const connection of connections) {
      if (connection && connection.isInitialized) {
        try {
          // Отключаем внешние ключи перед очисткой
          await connection.query('SET session_replication_role = REPLICA;');

          // Очищаем все таблицы
          const entities = connection.entityMetadatas;
          for (const entity of entities.reverse()) {
            await connection.getRepository(entity.name).clear();
          }

          // Включаем внешние ключи обратно
          await connection.query('SET session_replication_role = DEFAULT;');

          // Закрываем соединение
          await connection.destroy();
        } catch (error) {
          console.warn('Ошибка при закрытии соединения:', error);
        }
      }
    }

    // Принудительно закрываем все соединения Tester
    const tester = Tester.getInstance();
    await tester.forceCleanup();

    // Очищаем все таймеры и интервалы
    for (let i = 1; i <= 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Принудительная сборка мусора если доступна
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }

    // Даем время на завершение асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error('Ошибка при глобальной очистке:', error);
    throw error;
  }
});
// Обработка необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Обработка необработанных исключений
process.on('uncaughtException', error => {
  console.warn('Uncaught Exception:', error);
});
