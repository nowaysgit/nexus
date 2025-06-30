import { DataSource, QueryRunner } from 'typeorm';
import { DbConnectionHandler } from './db-connection-handler';

/**
 * Утилита для оптимизированной очистки базы данных в тестах
 */
export class DbCleanupUtil {
  /**
   * Включен ли режим отладки
   */
  private static debug = false;

  /**
   * Установка режима отладки
   * @param value true для включения отладки
   */
  public static setDebug(value: boolean): void {
    this.debug = value;
  }

  /**
   * Логирование в режиме отладки
   * @param message Сообщение для логирования
   * @param data Дополнительные данные
   */
  private static debugLog(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[DbCleanupUtil] ${message}`, data || '');
    }
  }

  /**
   * Быстрая очистка базы данных с использованием TRUNCATE CASCADE
   * @param dataSource DataSource для работы с базой данных
   * @param excludeTables Массив таблиц, которые нужно исключить из очистки
   * @returns Promise<void>
   */
  public static async fastCleanup(
    dataSource: DataSource,
    excludeTables: string[] = ['migrations', 'typeorm_metadata'],
  ): Promise<void> {
    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.fastCleanup: DataSource не инициализирован');
      return;
    }

    // Проверяем работоспособность соединения
    const isConnectionHealthy = await DbConnectionHandler.checkConnection(dataSource);
    if (!isConnectionHealthy) {
      this.debugLog('Соединение не работает, пытаемся восстановить');
      try {
        // Создаем ошибку для передачи в handleConnectionError
        const connectionError = new Error('Connection is not healthy');
        dataSource = await DbConnectionHandler.handleConnectionError(connectionError, dataSource);
        if (!dataSource || !dataSource.isInitialized) {
          console.warn('DbCleanupUtil.fastCleanup: Не удалось восстановить соединение');
          return;
        }
      } catch (error) {
        console.error('Ошибка при восстановлении соединения:', error);
        return;
      }
    }

    // Проверяем тип базы данных
    const isSqlite = dataSource.options?.type === 'sqlite';
    let queryRunner: QueryRunner | null = null;

    try {
      queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      if (isSqlite) {
        // Для SQLite используем другой подход
        this.debugLog('Используем SQLite очистку');
        await this.cleanupSqlite(queryRunner, excludeTables);
      } else {
        // Для PostgreSQL используем TRUNCATE CASCADE
        this.debugLog('Используем PostgreSQL очистку');
        await this.cleanupPostgres(queryRunner, excludeTables);
      }
    } catch (error) {
      console.error('Ошибка при оптимизированной очистке базы данных:', error);

      // Проверяем специфичные ошибки SQLite
      if (isSqlite && this.isSqliteError(error)) {
        this.debugLog('Обрабатываем специфичную ошибку SQLite', error);
        await this.handleSqliteError(dataSource, error);
      }
    } finally {
      // Освобождаем queryRunner
      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (releaseError) {
          console.warn('Ошибка при освобождении queryRunner:', releaseError);
        }
      }
    }
  }

  /**
   * Очистка базы данных SQLite
   * @param queryRunner QueryRunner для выполнения запросов
   * @param excludeTables Таблицы для исключения
   */
  private static async cleanupSqlite(
    queryRunner: QueryRunner,
    excludeTables: string[] = [],
  ): Promise<void> {
    try {
      // Проверяем наличие метода query в queryRunner.manager
      const hasManagerQueryMethod =
        queryRunner.manager && typeof queryRunner.manager.query === 'function';

      // Выбираем функцию для выполнения запросов
      const executeQuery = hasManagerQueryMethod
        ? (sql: string, params?: any[]) => queryRunner.manager.query(sql, params)
        : (sql: string, params?: any[]) => queryRunner.query(sql, params);

      // Получаем список таблиц
      const tables = await this.getSqliteTables(queryRunner, excludeTables);
      if (!tables || tables.length === 0) {
        this.debugLog('Нет таблиц для очистки в SQLite');
        return;
      }

      this.debugLog(`Очищаем ${tables.length} таблиц в SQLite`);

      // Отключаем проверку внешних ключей для SQLite
      await executeQuery('PRAGMA foreign_keys = OFF;');

      // Очищаем каждую таблицу отдельно
      for (const table of tables) {
        try {
          this.debugLog(`Очищаем таблицу ${table}`);
          await executeQuery(`DELETE FROM "${table}";`);
        } catch (error) {
          console.error(`Ошибка при очистке таблицы ${table}:`, error);
        }
      }

      // Включаем проверку внешних ключей
      await executeQuery('PRAGMA foreign_keys = ON;');
    } catch (error) {
      console.error('Ошибка при очистке базы данных SQLite:', error);
    }
  }

  /**
   * Получение списка таблиц SQLite
   * @param queryRunner QueryRunner для выполнения запросов
   * @param excludeTables Таблицы для исключения
   * @returns Promise<string[]> Список таблиц
   */
  private static async getSqliteTables(
    queryRunner: QueryRunner,
    excludeTables: string[] = [],
  ): Promise<string[]> {
    try {
      // Проверяем наличие метода query в queryRunner.manager
      const hasManagerQueryMethod =
        queryRunner.manager && typeof queryRunner.manager.query === 'function';

      // Выбираем функцию для выполнения запросов
      const executeQuery = hasManagerQueryMethod
        ? (sql: string, params?: any[]) => queryRunner.manager.query(sql, params)
        : (sql: string, params?: any[]) => queryRunner.query(sql, params);

      const result = await executeQuery(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      );
      return Array.isArray(result)
        ? result
            .map((row: any) => row.name as string)
            .filter((name: string) => !excludeTables.includes(name))
        : [];
    } catch (error) {
      console.error('Ошибка при получении списка таблиц SQLite:', error);
      return [];
    }
  }

  /**
   * Очистка базы данных PostgreSQL
   * @param queryRunner QueryRunner для выполнения запросов
   * @param excludeTables Таблицы для исключения
   */
  private static async cleanupPostgres(
    queryRunner: QueryRunner,
    excludeTables: string[] = [],
  ): Promise<void> {
    try {
      // Проверяем наличие метода query в queryRunner.manager
      const hasManagerQueryMethod =
        queryRunner.manager && typeof queryRunner.manager.query === 'function';

      // Выбираем функцию для выполнения запросов
      const executeQuery = hasManagerQueryMethod
        ? (sql: string, params?: any[]) => queryRunner.manager.query(sql, params)
        : (sql: string, params?: any[]) => queryRunner.query(sql, params);

      // Получаем все таблицы из текущей схемы
      const tablesResult: Array<{ tablename: string }> = await executeQuery(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = current_schema() 
        AND tablename NOT IN (${excludeTables.map(t => `'${t}'`).join(', ')})
      `);

      if (!tablesResult || tablesResult.length === 0) {
        this.debugLog('Нет таблиц для очистки в PostgreSQL');
        return;
      }

      this.debugLog(`Очищаем ${tablesResult.length} таблиц в PostgreSQL`);

      // Отключаем проверку внешних ключей
      await executeQuery('SET session_replication_role = replica;');

      // Очищаем каждую таблицу отдельно
      for (const row of tablesResult) {
        const tableName: string = row.tablename;
        this.debugLog(`Очищаем таблицу ${tableName}`);
        await executeQuery(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      }

      // Включаем проверку внешних ключей
      await executeQuery('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Ошибка при очистке базы данных PostgreSQL:', error);
    }
  }

  /**
   * Проверяет, является ли ошибка специфичной для SQLite
   * @param error Ошибка для проверки
   * @returns true, если это ошибка SQLite
   */
  private static isSqliteError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || '';
    return (
      errorMessage.includes('SQLITE_') ||
      errorMessage.includes('sqlite3_') ||
      errorMessage.includes('database is locked') ||
      errorMessage.includes('no such table')
    );
  }

  /**
   * Обрабатывает специфичные ошибки SQLite
   * @param dataSource DataSource для работы с базой данных
   * @param error Ошибка для обработки
   */
  private static async handleSqliteError(dataSource: DataSource, error: any): Promise<void> {
    const errorMessage = error.message || '';

    if (errorMessage.includes('database is locked')) {
      // Ошибка блокировки базы данных
      this.debugLog('Обрабатываем ошибку блокировки SQLite');

      // Ждем немного и пробуем снова
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Пробуем выполнить простой запрос для проверки
      try {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.manager.query('PRAGMA quick_check;');
        await queryRunner.release();
        this.debugLog('База данных разблокирована');
      } catch (checkError) {
        console.error('База данных все еще заблокирована:', checkError);
      }
    } else if (errorMessage.includes('no such table')) {
      // Ошибка отсутствия таблицы
      this.debugLog('Таблица не существует, возможно, база данных не синхронизирована');

      // Пробуем синхронизировать схему
      try {
        await dataSource.synchronize();
        this.debugLog('Схема базы данных синхронизирована');
      } catch (syncError) {
        console.error('Ошибка при синхронизации схемы:', syncError);
      }
    }
  }

  /**
   * Очистка только указанных таблиц
   * @param dataSource DataSource для работы с базой данных
   * @param tables Массив таблиц, которые нужно очистить
   * @returns Promise<void>
   */
  public static async cleanupTables(dataSource: DataSource, tables: string[]): Promise<void> {
    if (tables.length === 0) {
      return;
    }

    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.cleanupTables: DataSource не инициализирован');
      return;
    }

    const isSqlite = dataSource.options.type === 'sqlite';
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      if (isSqlite) {
        // Отключаем проверку внешних ключей для SQLite
        await queryRunner.manager.query('PRAGMA foreign_keys = OFF;');

        // Очищаем каждую таблицу отдельно
        for (const table of tables) {
          await queryRunner.manager.query(`DELETE FROM "${table}";`);
          // Сбрасываем счетчики автоинкремента
          await queryRunner.manager.query(`DELETE FROM sqlite_sequence WHERE name="${table}";`);
        }

        // Включаем проверку внешних ключей
        await queryRunner.manager.query('PRAGMA foreign_keys = ON;');
      } else {
        // Отключаем проверку внешних ключей для PostgreSQL
        await queryRunner.manager.query('SET session_replication_role = replica;');

        // Очищаем указанные таблицы
        const tableNames = tables.map(t => `"${t}"`).join(', ');
        await queryRunner.manager.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY;`);

        // Включаем проверку внешних ключей
        await queryRunner.manager.query('SET session_replication_role = DEFAULT;');
      }
    } catch (error) {
      console.error('Ошибка при очистке указанных таблиц:', error);
      throw error;
    } finally {
      // Освобождаем queryRunner
      await queryRunner.release();
    }
  }

  /**
   * Создание временной схемы для изоляции тестов
   * @param dataSource DataSource для работы с базой данных
   * @param schemaName Имя схемы (если не указано, будет сгенерировано случайное)
   * @returns Promise<string> Имя созданной схемы
   */
  public static async createTemporarySchema(
    dataSource: DataSource,
    schemaName?: string,
  ): Promise<string> {
    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.createTemporarySchema: DataSource не инициализирован');
      return 'default';
    }

    const isSqlite = dataSource.options.type === 'sqlite';
    if (isSqlite) {
      // SQLite не поддерживает схемы, возвращаем 'main'
      return 'main';
    }

    const schema = schemaName || `test_schema_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Создаем схему
      await queryRunner.manager.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);

      // Устанавливаем путь поиска схемы
      await queryRunner.manager.query(`SET search_path TO "${schema}", public;`);

      return schema;
    } catch (error) {
      console.error('Ошибка при создании временной схемы:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Удаление временной схемы
   * @param dataSource DataSource для работы с базой данных
   * @param schemaName Имя схемы для удаления
   * @returns Promise<void>
   */
  public static async dropTemporarySchema(
    dataSource: DataSource,
    schemaName: string,
  ): Promise<void> {
    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.dropTemporarySchema: DataSource не инициализирован');
      return;
    }

    const isSqlite = dataSource.options.type === 'sqlite';
    if (isSqlite) {
      // SQLite не поддерживает схемы, ничего не делаем
      return;
    }

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Сбрасываем путь поиска на public
      await queryRunner.manager.query(`SET search_path TO public;`);

      // Удаляем схему
      await queryRunner.manager.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    } catch (error) {
      console.error('Ошибка при удалении временной схемы:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Проверка существования таблицы в базе данных
   * @param dataSource DataSource для работы с базой данных
   * @param tableName Имя таблицы для проверки
   * @returns Promise<boolean> true, если таблица существует
   */
  public static async tableExists(dataSource: DataSource, tableName: string): Promise<boolean> {
    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.tableExists: DataSource не инициализирован');
      return false;
    }

    const isSqlite = dataSource.options.type === 'sqlite';
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      if (isSqlite) {
        const result = await queryRunner.manager.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
          [tableName],
        );
        return result.length > 0;
      } else {
        const result = await queryRunner.manager.query(
          `
          SELECT EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = current_schema()
            AND tablename = $1
          );
        `,
          [tableName],
        );

        return result[0].exists;
      }
    } catch (error) {
      console.error('Ошибка при проверке существования таблицы:', error);
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Получение списка всех таблиц в текущей схеме
   * @param dataSource DataSource для работы с базой данных
   * @param excludeTables Массив таблиц, которые нужно исключить из результата
   * @returns Promise<string[]> Массив имен таблиц
   */
  public static async getAllTables(
    dataSource: DataSource,
    excludeTables: string[] = ['migrations', 'typeorm_metadata'],
  ): Promise<string[]> {
    // Проверяем, инициализирован ли dataSource
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DbCleanupUtil.getAllTables: DataSource не инициализирован');
      return [];
    }

    const isSqlite = dataSource.options.type === 'sqlite';
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      if (isSqlite) {
        const result = await queryRunner.manager.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        );
        return result
          .map((row: any) => row.name)
          .filter((name: string) => !excludeTables.includes(name));
      } else {
        const tablesResult = await queryRunner.manager.query(`
          SELECT tablename FROM pg_tables 
          WHERE schemaname = current_schema() 
          AND tablename NOT IN (${excludeTables.map(t => `'${t}'`).join(', ')})
        `);

        return tablesResult.map((t: any) => t.tablename);
      }
    } catch (error) {
      console.error('Ошибка при получении списка таблиц:', error);
      return [];
    } finally {
      await queryRunner.release();
    }
  }
}
