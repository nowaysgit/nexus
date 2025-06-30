import { DataSource } from 'typeorm';
import { DbConnectionManager } from './db-connection-manager';
import { createTestDataSource } from './data-source';
import { ALL_TEST_ENTITIES } from '../entities';
import { checkDatabaseConnection, isCriticalConnectionError } from './db-connection-checker';

/**
 * Класс для обработки проблем с соединениями в тестах
 */
export class DbConnectionHandler {
  private static maxReconnectAttempts = 3;
  private static reconnectDelay = 2000; // мс
  private static debug = process.env.NODE_ENV === 'test';
  private static connectionMonitorInterval: NodeJS.Timeout | null = null;
  private static monitoringActive = false;

  /**
   * Включить/выключить режим отладки
   * @param enabled Включить отладку
   */
  public static setDebug(enabled: boolean): void {
    DbConnectionHandler.debug = enabled;
  }

  /**
   * Установить максимальное количество попыток переподключения
   * @param attempts Количество попыток
   */
  public static setMaxReconnectAttempts(attempts: number): void {
    DbConnectionHandler.maxReconnectAttempts = attempts;
  }

  /**
   * Установить задержку между попытками переподключения
   * @param delay Задержка в миллисекундах
   */
  public static setReconnectDelay(delay: number): void {
    DbConnectionHandler.reconnectDelay = delay;
  }

  /**
   * Проверяет соединение с базой данных
   * @param dataSource DataSource для проверки
   * @returns Promise<boolean> true, если соединение работает, иначе false
   */
  public static async checkConnection(dataSource: DataSource): Promise<boolean> {
    return checkDatabaseConnection(dataSource);
  }

  /**
   * Обработать ошибку соединения с базой данных
   * @param error Ошибка соединения
   * @param dataSource DataSource, с которым произошла ошибка
   * @returns Promise<DataSource> Новый или восстановленный DataSource
   */
  public static async handleConnectionError(
    error: Error,
    dataSource: DataSource,
  ): Promise<DataSource> {
    if (DbConnectionHandler.debug) {
      console.error('[DbConnectionHandler] Ошибка соединения:', error.message);
    }

    // Проверяем, является ли ошибка критичной для соединения
    const isCriticalError = isCriticalConnectionError(error);

    if (!isCriticalError) {
      if (DbConnectionHandler.debug) {
        console.log(
          '[DbConnectionHandler] Ошибка не критична для соединения, возвращаем текущий DataSource',
        );
      }
      return dataSource;
    }

    // Пытаемся переподключиться
    try {
      const reconnectedDataSource = await this.reconnectWithRetry(dataSource);
      return reconnectedDataSource;
    } catch (reconnectError) {
      if (DbConnectionHandler.debug) {
        console.error(
          '[DbConnectionHandler] Не удалось переподключиться:',
          reconnectError instanceof Error ? reconnectError.message : String(reconnectError),
        );
      }

      // Если не удалось переподключиться, создаем новый DataSource
      const newDataSource = await createTestDataSource();
      return newDataSource;
    }
  }

  /**
   * Обеспечивает наличие рабочего соединения с базой данных
   * @param dataSource DataSource для проверки
   * @returns Promise<DataSource> Рабочий DataSource
   */
  public static async ensureConnection(dataSource: DataSource): Promise<DataSource> {
    // Проверяем текущее соединение
    const isHealthy = await this.checkConnection(dataSource);

    if (isHealthy) {
      return dataSource;
    }

    // Если соединение не работает, создаем новое
    if (DbConnectionHandler.debug) {
      console.log('[DbConnectionHandler] Создаем новое соединение');
    }

    return await createTestDataSource();
  }

  /**
   * Переподключается к базе данных с повторными попытками
   * @param dataSource DataSource для переподключения
   * @param maxRetries Максимальное количество попыток (по умолчанию 3)
   * @returns Promise<DataSource> Переподключенный DataSource
   */
  private static async reconnectWithRetry(
    dataSource: DataSource,
    maxRetries: number = 3,
  ): Promise<DataSource> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (DbConnectionHandler.debug) {
          console.log(`[DbConnectionHandler] Попытка переподключения ${attempt}/${maxRetries}`);
        }

        // Закрываем текущее соединение, если оно открыто
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }

        // Пытаемся переинициализировать
        await dataSource.initialize();

        // Проверяем соединение
        const isHealthy = await this.checkConnection(dataSource);
        if (isHealthy) {
          if (DbConnectionHandler.debug) {
            console.log('[DbConnectionHandler] Переподключение успешно');
          }
          return dataSource;
        }
      } catch (error) {
        if (DbConnectionHandler.debug) {
          console.error(
            `[DbConnectionHandler] Попытка ${attempt} неудачна:`,
            error instanceof Error ? error.message : String(error),
          );
        }

        if (attempt === maxRetries) {
          throw error;
        }

        // Ждем перед следующей попыткой
        await new Promise<void>(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Не удалось переподключиться после всех попыток');
  }

  /**
   * Восстанавливает соединение с базой данных
   * @param dataSource DataSource для восстановления
   * @param entities Список сущностей для включения в новый DataSource
   * @param error Ошибка, которая привела к необходимости восстановления
   * @returns Promise<DataSource> Восстановленный или новый DataSource
   */
  public static async recoverConnection(
    dataSource: DataSource,
    entities: unknown[] = [],
    error?: Error,
  ): Promise<DataSource> {
    if (DbConnectionHandler.debug) {
      console.log('[DbConnectionHandler] Восстановление соединения');
      if (error) {
        console.error('[DbConnectionHandler] Причина восстановления:', error.message);
      }
    }

    // Сначала пытаемся переподключиться к существующему DataSource
    try {
      const reconnectedDataSource = await this.reconnectWithRetry(dataSource);
      return reconnectedDataSource;
    } catch (reconnectError) {
      if (DbConnectionHandler.debug) {
        console.error(
          '[DbConnectionHandler] Переподключение не удалось:',
          reconnectError instanceof Error ? reconnectError.message : String(reconnectError),
        );
      }
    }

    // Если переподключение не удалось, создаем новый DataSource
    try {
      const newDataSource = await createTestDataSource();

      if (DbConnectionHandler.debug) {
        console.log('[DbConnectionHandler] Создан новый DataSource');
      }

      return newDataSource;
    } catch (createError) {
      if (DbConnectionHandler.debug) {
        console.error(
          '[DbConnectionHandler] Не удалось создать новый DataSource:',
          createError instanceof Error ? createError.message : String(createError),
        );
      }
      throw createError;
    }
  }

  /**
   * Запустить мониторинг соединений
   * @param checkInterval Интервал проверки в миллисекундах
   */
  public static startConnectionMonitoring(checkInterval = 30000): void {
    if (DbConnectionHandler.monitoringActive) {
      return;
    }

    DbConnectionHandler.monitoringActive = true;

    if (DbConnectionHandler.debug) {
      console.log(
        `[DbConnectionHandler] Запуск мониторинга соединений с интервалом ${checkInterval}мс`,
      );
    }

    // Запускаем периодическую проверку соединений
    DbConnectionHandler.connectionMonitorInterval = setInterval(() => {
      void (async () => {
        try {
          await DbConnectionManager.checkAndReconnectConnections();
        } catch (error) {
          if (DbConnectionHandler.debug) {
            console.error('[DbConnectionHandler] Ошибка при проверке соединений:', error);
          }
        }
      })();
    }, checkInterval);
  }

  /**
   * Остановить мониторинг соединений
   */
  public static stopConnectionMonitoring(): void {
    if (!DbConnectionHandler.monitoringActive) {
      return;
    }

    if (DbConnectionHandler.connectionMonitorInterval) {
      clearInterval(DbConnectionHandler.connectionMonitorInterval);
      DbConnectionHandler.connectionMonitorInterval = null;
    }

    DbConnectionHandler.monitoringActive = false;

    if (DbConnectionHandler.debug) {
      console.log('[DbConnectionHandler] Мониторинг соединений остановлен');
    }
  }

  /**
   * Проверить, является ли ошибка критической ошибкой соединения
   * @param error Ошибка для проверки
   * @returns boolean true, если ошибка критическая
   */
  private static isCriticalConnectionError(error: Error): boolean {
    const criticalErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'Connection terminated',
      'Connection lost',
      'server closed the connection unexpectedly',
      'Connection is not established',
      'DataSource is not initialized',
    ];

    return criticalErrors.some(
      errorType => error.message.includes(errorType) || error.name.includes(errorType),
    );
  }

  /**
   * Выполнить запрос с автоматической обработкой ошибок соединения
   * @param dataSource DataSource для выполнения запроса
   * @param query SQL запрос
   * @param parameters Параметры запроса
   * @returns Promise<any> Результат запроса
   */
  public static async executeQueryWithErrorHandling(
    dataSource: DataSource,
    query: string,
    parameters: any[] = [],
  ): Promise<any> {
    try {
      return await dataSource.query(query, parameters);
    } catch (error) {
      if (error instanceof Error && this.isCriticalConnectionError(error)) {
        // Если ошибка связана с соединением, пытаемся переподключиться
        const reconnectedDataSource = await this.handleConnectionError(error, dataSource);

        // Повторяем запрос с новым соединением
        return await reconnectedDataSource.query(query, parameters);
      }

      // Если ошибка не связана с соединением, пробрасываем её дальше
      throw error;
    }
  }

  /**
   * Проверить работоспособность соединения
   * @param dataSource DataSource для проверки
   * @returns Promise<boolean> true, если соединение работает
   */
  public static async isConnectionHealthy(dataSource: DataSource): Promise<boolean> {
    if (!dataSource || !dataSource.isInitialized) {
      return false;
    }

    try {
      // Выполняем простой запрос для проверки
      await dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      if (DbConnectionHandler.debug) {
        console.error('[DbConnectionHandler] Соединение не работает:', error);
      }
      return false;
    }
  }

  /**
   * Выполняет запрос с автоматическим восстановлением соединения при ошибке
   * @param dataSource DataSource для выполнения запроса
   * @param queryFn Функция запроса
   * @param entities Список сущностей для включения в DataSource при пересоздании
   * @returns Promise<T> Результат выполнения запроса
   */
  public static async executeWithReconnect<T>(
    dataSource: DataSource,
    queryFn: (ds: DataSource) => Promise<T>,
    entities: any[] = [],
  ): Promise<T> {
    try {
      // Проверяем соединение перед выполнением запроса
      const isConnected = await this.checkConnection(dataSource);
      if (!isConnected) {
        // Если соединение не работает, восстанавливаем его
        dataSource = await this.recoverConnection(dataSource, entities);
      }

      // Выполняем запрос
      return await queryFn(dataSource);
    } catch (error) {
      // Если произошла ошибка, пробуем восстановить соединение и повторить запрос
      console.warn(
        'Ошибка при выполнении запроса, пробуем восстановить соединение:',
        error instanceof Error ? error.message : String(error),
      );
      dataSource = await this.recoverConnection(
        dataSource,
        entities,
        error instanceof Error ? error : undefined,
      );
      return await queryFn(dataSource);
    }
  }

  /**
   * Проверяет наличие метода query и добавляет его, если необходимо
   * @param dataSource DataSource для проверки
   */
  private static async ensureQueryMethodExists(dataSource: DataSource): Promise<void> {
    if (!dataSource || !dataSource.isInitialized) {
      return;
    }

    // Проверяем наличие метода query в DataSource напрямую
    if (typeof dataSource.query !== 'function') {
      console.warn('Метод query не найден в dataSource, добавляем его');

      // Добавляем метод query в DataSource
      dataSource.query = async function <T = unknown>(
        query: string,
        parameters?: unknown[],
      ): Promise<T> {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
          const result = await queryRunner.query(query, parameters);
          return result as T;
        } finally {
          await queryRunner.release();
        }
      };
    }

    // Проверяем наличие метода query в EntityManager
    if (dataSource.manager && typeof dataSource.manager.query !== 'function') {
      console.warn('Метод query не найден в dataSource.manager, добавляем его');

      // Добавляем метод query в EntityManager
      dataSource.manager.query = async function <T = any>(
        query: string,
        parameters?: any[],
      ): Promise<T> {
        return dataSource.query(query, parameters);
      };
    }

    // Дополнительно проверяем QueryRunner
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      if (queryRunner.manager && typeof queryRunner.manager.query !== 'function') {
        console.warn('Метод query не найден в queryRunner.manager, добавляем его');

        // Добавляем метод query в QueryRunner.manager
        queryRunner.manager.query = async function <T = any>(
          query: string,
          parameters?: any[],
        ): Promise<T> {
          return queryRunner.query(query, parameters) as Promise<T>;
        };
      }
    } finally {
      await queryRunner.release();
    }
  }
}
