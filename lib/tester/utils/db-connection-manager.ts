import { DataSource } from 'typeorm';

/**
 * Менеджер соединений с базой данных для тестов
 * Отслеживает все соединения и закрывает их после завершения тестов
 */
export class DbConnectionManager {
  private static connections: DataSource[] = [];
  private static isCleanupRegistered = false;
  private static debug = false;
  private static maxConnectionRetries = 3;
  private static connectionRetryDelay = 1000; // мс

  /**
   * Включить/выключить режим отладки
   * @param enabled Включить отладку
   */
  public static setDebug(enabled: boolean): void {
    DbConnectionManager.debug = enabled;
  }

  /**
   * Установить максимальное количество повторных попыток подключения
   * @param retries Количество попыток
   */
  public static setMaxConnectionRetries(retries: number): void {
    DbConnectionManager.maxConnectionRetries = retries;
  }

  /**
   * Установить задержку между повторными попытками подключения
   * @param delay Задержка в миллисекундах
   */
  public static setConnectionRetryDelay(delay: number): void {
    DbConnectionManager.connectionRetryDelay = delay;
  }

  /**
   * Зарегистрировать соединение для автоматического закрытия
   * @param connection Соединение с базой данных
   */
  public static registerConnection(connection: DataSource): void {
    // Проверяем, есть ли уже такое соединение
    if (!connection || !connection.isInitialized) {
      if (DbConnectionManager.debug) {
        console.log(
          '[DbConnectionManager] Попытка зарегистрировать неинициализированное соединение',
        );
      }
      return;
    }

    if (!DbConnectionManager.connections.includes(connection)) {
      DbConnectionManager.connections.push(connection);

      if (DbConnectionManager.debug) {
        console.log(
          `[DbConnectionManager] Зарегистрировано новое соединение. Всего: ${DbConnectionManager.connections.length}`,
        );
      }

      // Регистрируем обработчик завершения процесса, если еще не зарегистрирован
      if (!DbConnectionManager.isCleanupRegistered) {
        process.on('exit', () => {
          DbConnectionManager.closeAllConnections();
        });

        // Также регистрируем обработчик для SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
          DbConnectionManager.closeAllConnections().finally(() => {
            process.exit(0);
          });
        });

        // Регистрируем обработчик для SIGTERM
        process.on('SIGTERM', () => {
          DbConnectionManager.closeAllConnections().finally(() => {
            process.exit(0);
          });
        });

        DbConnectionManager.isCleanupRegistered = true;

        if (DbConnectionManager.debug) {
          console.log('[DbConnectionManager] Зарегистрированы обработчики завершения процесса');
        }
      }
    }
  }

  /**
   * Получить количество активных соединений
   * @returns Количество соединений
   */
  public static getConnectionCount(): number {
    return DbConnectionManager.connections.length;
  }

  /**
   * Получить все активные соединения
   * @returns Массив соединений
   */
  public static getConnections(): DataSource[] {
    return [...DbConnectionManager.connections];
  }

  /**
   * Очистить список соединений без их закрытия
   * Используется в тестах для сброса состояния между тестами
   */
  public static clearConnections(): void {
    const count = DbConnectionManager.connections.length;
    DbConnectionManager.connections = [];

    if (DbConnectionManager.debug) {
      console.log(`[DbConnectionManager] Очищен список соединений. Было: ${count}`);
    }
  }

  /**
   * Закрыть все соединения с базой данных
   * @returns Promise, который разрешается, когда все соединения закрыты
   */
  public static async closeAllConnections(): Promise<void> {
    if (DbConnectionManager.connections.length === 0) {
      return;
    }

    if (DbConnectionManager.debug) {
      console.log(
        `[DbConnectionManager] Закрытие ${DbConnectionManager.connections.length} соединений...`,
      );
    }

    const closingPromises = DbConnectionManager.connections.map(async (connection, index) => {
      try {
        // Проверяем, инициализировано ли соединение и открыто ли оно
        if (connection && connection.isInitialized) {
          await connection.destroy();

          if (DbConnectionManager.debug) {
            console.log(`[DbConnectionManager] Соединение #${index + 1} успешно закрыто`);
          }
        }
      } catch (error) {
        console.error(`[DbConnectionManager] Ошибка при закрытии соединения #${index + 1}:`, error);
      }
    });

    await Promise.all(closingPromises);
    DbConnectionManager.connections = [];

    if (DbConnectionManager.debug) {
      console.log('[DbConnectionManager] Все соединения закрыты');
    }
  }

  /**
   * Оптимизировать соединения - закрыть неиспользуемые
   * @param keepLast Оставить последние N соединений
   * @returns Promise, который разрешается, когда соединения оптимизированы
   */
  public static async optimizeConnections(keepLast: number = 1): Promise<void> {
    if (DbConnectionManager.connections.length <= keepLast) {
      return;
    }

    if (DbConnectionManager.debug) {
      console.log(
        `[DbConnectionManager] Оптимизация соединений. Всего: ${DbConnectionManager.connections.length}, оставляем: ${keepLast}`,
      );
    }

    // Оставляем последние keepLast соединений
    const connectionsToClose = DbConnectionManager.connections.slice(
      0,
      DbConnectionManager.connections.length - keepLast,
    );
    const connectionsToKeep = DbConnectionManager.connections.slice(
      DbConnectionManager.connections.length - keepLast,
    );

    // Закрываем лишние соединения
    const closingPromises = connectionsToClose.map(async (connection, index) => {
      try {
        if (connection && connection.isInitialized) {
          await connection.destroy();

          if (DbConnectionManager.debug) {
            console.log(
              `[DbConnectionManager] Соединение #${index + 1} успешно закрыто при оптимизации`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[DbConnectionManager] Ошибка при закрытии соединения #${index + 1} при оптимизации:`,
          error,
        );
      }
    });

    await Promise.all(closingPromises);
    DbConnectionManager.connections = connectionsToKeep;

    if (DbConnectionManager.debug) {
      console.log(
        `[DbConnectionManager] Оптимизация завершена. Осталось соединений: ${DbConnectionManager.connections.length}`,
      );
    }
  }

  /**
   * Проверить, есть ли активные соединения
   * @returns true, если есть хотя бы одно активное соединение
   */
  public static hasActiveConnections(): boolean {
    return DbConnectionManager.connections.some(
      connection => connection && connection.isInitialized,
    );
  }

  /**
   * Проверить состояние соединений и переподключить неактивные
   * @returns Promise, который разрешается, когда все соединения проверены
   */
  public static async checkAndReconnectConnections(): Promise<void> {
    if (DbConnectionManager.connections.length === 0) {
      return;
    }

    if (DbConnectionManager.debug) {
      console.log(
        `[DbConnectionManager] Проверка состояния ${DbConnectionManager.connections.length} соединений...`,
      );
    }

    const reconnectPromises = DbConnectionManager.connections.map(async (connection, index) => {
      try {
        // Проверяем, инициализировано ли соединение
        if (!connection || !connection.isInitialized) {
          if (DbConnectionManager.debug) {
            console.log(
              `[DbConnectionManager] Соединение #${index + 1} не инициализировано, пытаемся переподключиться...`,
            );
          }

          // Пытаемся переподключиться
          await DbConnectionManager.reconnectWithRetry(connection, index);
        } else {
          // Проверяем, работает ли соединение
          try {
            // Выполняем простой запрос для проверки
            await connection.query('SELECT 1');
          } catch (error) {
            if (DbConnectionManager.debug) {
              console.log(
                `[DbConnectionManager] Соединение #${index + 1} не работает, пытаемся переподключиться...`,
              );
            }

            // Пытаемся переподключиться
            await DbConnectionManager.reconnectWithRetry(connection, index);
          }
        }
      } catch (error) {
        console.error(`[DbConnectionManager] Ошибка при проверке соединения #${index + 1}:`, error);
      }
    });

    await Promise.all(reconnectPromises);

    if (DbConnectionManager.debug) {
      console.log('[DbConnectionManager] Проверка соединений завершена');
    }
  }

  /**
   * Переподключиться с повторными попытками
   * @param connection Соединение для переподключения
   * @param index Индекс соединения для логирования
   * @returns Promise, который разрешается, когда соединение переподключено
   */
  private static async reconnectWithRetry(
    connection: DataSource,
    index: number,
  ): Promise<DataSource> {
    let retries = 0;

    while (retries < DbConnectionManager.maxConnectionRetries) {
      try {
        // Если соединение инициализировано, закрываем его
        if (connection && connection.isInitialized) {
          await connection.destroy();
        }

        // Пытаемся инициализировать соединение
        await connection.initialize();

        if (DbConnectionManager.debug) {
          console.log(
            `[DbConnectionManager] Соединение #${index + 1} успешно переподключено на попытке ${
              retries + 1
            }`,
          );
        }

        return connection;
      } catch (error) {
        retries++;

        if (retries >= DbConnectionManager.maxConnectionRetries) {
          console.error(
            `[DbConnectionManager] Не удалось переподключить соединение #${
              index + 1
            } после ${retries} попыток:`,
            error,
          );
          throw error;
        }

        if (DbConnectionManager.debug) {
          console.log(
            `[DbConnectionManager] Попытка ${retries}/${
              DbConnectionManager.maxConnectionRetries
            } переподключения соединения #${index + 1} не удалась, повторная попытка через ${
              DbConnectionManager.connectionRetryDelay
            }мс...`,
          );
        }

        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, DbConnectionManager.connectionRetryDelay));
      }
    }

    throw new Error(
      `[DbConnectionManager] Не удалось переподключить соединение #${
        index + 1
      } после ${DbConnectionManager.maxConnectionRetries} попыток`,
    );
  }
}
