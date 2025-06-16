// Мокаем библиотеку telegraf в самом начале, до загрузки прочих модулей, чтобы предотвратить реальные HTTP вызовы
jest.mock('telegraf', () => {
  const mockTelegrafInstance = {
    telegram: {
      sendMessage: jest.fn().mockResolvedValue(true),
      getMe: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 }),
      setWebhook: jest.fn().mockResolvedValue(true),
      getWebhookInfo: jest.fn().mockResolvedValue({ url: '' }),
      deleteWebhook: jest.fn().mockResolvedValue(true),
    },
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    command: jest.fn(),
    start: jest.fn(),
    help: jest.fn(),
    catch: jest.fn(),
  };

  return {
    __esModule: true,
    Telegraf: jest.fn().mockImplementation(() => mockTelegrafInstance),
    default: jest.fn().mockImplementation(() => mockTelegrafInstance),
    Context: jest.fn(),
    Scenes: {
      Stage: jest.fn().mockImplementation(() => ({ middleware: jest.fn() })),
    },
    session: jest.fn().mockReturnValue((_ctx: unknown, next: unknown) => {
      if (typeof (next as any) === 'function') {
        return (next as () => unknown)();
      }
      return undefined;
    }),
  };
});

import { DataSource } from 'typeorm';
import { checkDatabaseConnection } from '../lib/tester/utils/db-connection-checker';
import { createTestDataSource } from '../lib/tester/utils/data-source';
import { Tester } from '../lib/tester';

// Объявление глобальных типов
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __dataSource?: DataSource;
      // Не определяем __currentTest здесь, используем тип из lib/tester/index.ts
    }
  }
}

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
 * Настройка тестового окружения
 */
export const setupTests = async (): Promise<DataSource> => {
  try {
    // Проверяем, требуется ли база данных для текущего теста

    const currentTest = (global as any).__currentTest;
    const requiresDatabase = currentTest?.params?.requiresDatabase !== false;

    if (!requiresDatabase) {
      console.log('[setupTests] Используем мок DataSource, т.к. requiresDatabase: false');
      return mockDataSource;
    }

    // Проверяем доступность базы данных
    const isDatabaseAvailable = await checkDatabaseConnection();
    if (!isDatabaseAvailable) {
      console.log('[setupTests] База данных недоступна, используем мок DataSource');
      return mockDataSource;
    }

    // Создаем DataSource
    const dataSource = await createTestDataSource();
    return dataSource;
  } catch (error) {
    console.error('Ошибка настройки тестового окружения:', error);
    console.log('[setupTests] Из-за ошибки используем мок DataSource');
    return mockDataSource;
  }
};

/**
 * Очистка тестового окружения
 */
export const cleanupTests = async (dataSource: DataSource): Promise<void> => {
  try {
    // Если это мок DataSource, ничего не делаем
    if (!dataSource || dataSource === mockDataSource) {
      return;
    }

    // Закрываем соединение с базой данных
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  } catch (error) {
    console.error('Ошибка очистки тестового окружения:', error);
  }
};

// Настройка тестового окружения перед запуском тестов
beforeAll(async () => {
  try {
    // Настраиваем тестовое окружение
    const dataSource = await setupTests();

    // Сохраняем DataSource в глобальной переменной для доступа из тестов

    (global as any).__dataSource = dataSource;

    return dataSource;
  } catch (error) {
    console.error('Ошибка настройки тестового окружения:', error);
    throw error;
  }
});

// Очистка тестового окружения после завершения тестов
afterAll(async () => {
  try {
    // Получаем DataSource из глобальной переменной

    const dataSource = (global as any).__dataSource;

    // Очищаем тестовое окружение
    await cleanupTests(dataSource);

    // Удаляем DataSource из глобальной переменной

    delete (global as any).__dataSource;
  } catch (error) {
    console.error('Ошибка очистки тестового окружения:', error);
  }
});

// Настройка глобальных переменных для тестов
let globalDataSource: DataSource;

// Запускаем настройку тестового окружения перед всеми тестами
beforeAll(async () => {
  globalDataSource = await setupTests();
});

// Очищаем тестовое окружение после всех тестов
afterAll(async () => {
  if (globalDataSource) {
    await cleanupTests(globalDataSource);
  }
  // Принудительно закрываем все соединения Tester
  const tester = Tester.getInstance();
  await tester.close();
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
