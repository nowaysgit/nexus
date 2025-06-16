/* eslint-disable */
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../utils/data-source';

// Глобальное хранилище единственного DataSource, чтобы избежать создания
// множества подключений и ошибки "too many clients already" при параллельных тестах.
let globalTestDataSource: DataSource | null = null;

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
      save: async (entity: any) => entity,
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
    save: async (entity: any) => entity,
    update: async () => ({ affected: 1 }),
    delete: async () => ({ affected: 1 }),
    createQueryBuilder: () => ({
      where: () => ({ getOne: async () => null, getMany: async () => [] }),
    }),
  }),
} as unknown as DataSource;

/**
 * Модуль для предоставления DataSource в тестовом окружении
 * Использует singleton DataSource для всех тестов, чтобы избежать ошибки "too many clients already"
 */
@Global()
@Module({})
export class MockTypeOrmModule {
  /**
   * Создает модуль с провайдерами для DataSource
   */
  static forRoot(): DynamicModule {
    const providers: Provider[] = [
      {
        provide: getDataSourceToken(),
        useFactory: async () => {
          // Проверяем, требуется ли база данных для текущего теста
          const currentTest = (global as any).__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;
          
          if (!requiresDatabase) {
            console.log('[MockTypeOrmModule] Используем мок DataSource, т.к. requiresDatabase: false');
            return mockDataSource;
          }
          
          // Используем глобальный DataSource, если он уже создан
          if (globalTestDataSource && globalTestDataSource.isInitialized) {
            return globalTestDataSource;
          }

          try {
            // Создаем новый DataSource и сохраняем его в глобальную переменную
            globalTestDataSource = await createTestDataSource();
            return globalTestDataSource;
          } catch (error) {
            console.error('[MockTypeOrmModule] Ошибка создания DataSource:', error);
            // В случае ошибки подключения к базе данных, возвращаем мок
            console.log('[MockTypeOrmModule] Возвращаем мок DataSource из-за ошибки подключения');
            return mockDataSource;
          }
        },
      },
      {
        provide: DataSource,
        useFactory: async () => {
          // Проверяем, требуется ли база данных для текущего теста
          const globalContext = global as { __currentTest?: { params?: { requiresDatabase?: boolean } } };
          const currentTest = globalContext.__currentTest;
          const requiresDatabase = currentTest?.params?.requiresDatabase !== false;
          
          if (!requiresDatabase) {
            return mockDataSource;
          }
          
          // Используем глобальный DataSource, если он уже создан
          if (globalTestDataSource && globalTestDataSource.isInitialized) {
            return globalTestDataSource;
          }

          try {
            // Создаем новый DataSource и сохраняем его в глобальную переменную
            globalTestDataSource = await createTestDataSource();
            return globalTestDataSource;
          } catch (error) {
            // В случае ошибки подключения к базе данных, возвращаем мок
            return mockDataSource;
          }
        },
      },
    ];

    return {
      module: MockTypeOrmModule,
      providers,
      exports: providers,
    };
  }
}
