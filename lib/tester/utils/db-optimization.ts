import { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { DbConnectionManager } from './db-connection-manager';
import { DbCleanupUtil } from './db-cleanup';

/**
 * Класс для оптимизации работы с базой данных в интеграционных тестах
 */
export class DbOptimizationUtil {
  // Кеш для хранения результатов запросов
  private static queryCache = new Map<string, { data: any; timestamp: number }>();

  // Максимальное время жизни кеша в миллисекундах (по умолчанию 1 секунда)
  private static cacheTTL = 1000;

  /**
   * Установить время жизни кеша
   * @param ttl Время жизни кеша в миллисекундах
   */
  public static setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Очистить кеш запросов
   */
  public static clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Выполнить запрос с кешированием результата
   * @param dataSource DataSource для выполнения запроса
   * @param query SQL запрос
   * @param parameters Параметры запроса
   * @param cacheKey Ключ для кеширования (по умолчанию - сам запрос + параметры)
   * @returns Результат запроса
   */
  public static async executeQueryWithCache<T>(
    dataSource: DataSource,
    query: string,
    parameters?: any[],
    cacheKey?: string,
  ): Promise<T> {
    // Если ключ не указан, используем запрос + параметры
    const key = cacheKey || `${query}_${JSON.stringify(parameters || [])}`;

    // Проверяем, есть ли результат в кеше и не устарел ли он
    const cachedResult = this.queryCache.get(key);
    if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTTL) {
      return cachedResult.data;
    }

    // Выполняем запрос
    const result = await dataSource.query(query, parameters);

    // Сохраняем результат в кеше
    this.queryCache.set(key, { data: result, timestamp: Date.now() });

    return result;
  }

  /**
   * Выполнить несколько запросов в одной транзакции
   * @param dataSource DataSource для выполнения запросов
   * @param queries Массив объектов с запросами и параметрами
   * @returns Массив результатов запросов
   */
  public static async executeQueriesInTransaction<T>(
    dataSource: DataSource,
    queries: { query: string; parameters?: any[] }[],
  ): Promise<T[]> {
    // Создаем QueryRunner для транзакции
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Выполняем все запросы
      const results: T[] = [];
      for (const { query, parameters } of queries) {
        const result = await queryRunner.query(query, parameters);
        results.push(result);
      }

      // Коммитим транзакцию
      await queryRunner.commitTransaction();

      return results;
    } catch (error) {
      // В случае ошибки откатываем транзакцию
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Освобождаем QueryRunner
      await queryRunner.release();
    }
  }

  /**
   * Создать временную таблицу для тестов
   * @param dataSource DataSource для создания таблицы
   * @param tableName Имя таблицы
   * @param columns Описание столбцов таблицы
   * @returns Promise<void>
   */
  public static async createTemporaryTable(
    dataSource: DataSource,
    tableName: string,
    columns: string,
  ): Promise<void> {
    // Проверяем тип базы данных
    const isSqlite = dataSource.options.type === 'sqlite';

    // Для SQLite используем обычную таблицу, для PostgreSQL - временную
    const tableType = isSqlite ? '' : 'TEMPORARY';

    // Создаем таблицу
    await dataSource.query(`CREATE ${tableType} TABLE ${tableName} (${columns})`);
  }

  /**
   * Выполнить пакетную вставку данных
   * @param dataSource DataSource для вставки данных
   * @param tableName Имя таблицы
   * @param columns Список столбцов
   * @param values Массив значений для вставки
   * @returns Promise<void>
   */
  public static async batchInsert(
    dataSource: DataSource,
    tableName: string,
    columns: string[],
    values: any[][],
  ): Promise<void> {
    // Проверяем тип базы данных
    const isSqlite = dataSource.options.type === 'sqlite';

    if (isSqlite) {
      // Для SQLite используем несколько INSERT запросов
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const row of values) {
          const placeholders = row.map(() => '?').join(', ');
          await queryRunner.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            row,
          );
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      // Для PostgreSQL используем один INSERT запрос с несколькими VALUES
      const valueStrings = values
        .map(row => {
          const placeholders = row.map((_, index) => `$${index + 1}`).join(', ');
          return `(${placeholders})`;
        })
        .join(', ');

      await dataSource.query(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valueStrings}`,
        values.flat(),
      );
    }
  }

  /**
   * Выполнить пакетное обновление данных
   * @param dataSource DataSource для обновления данных
   * @param tableName Имя таблицы
   * @param updateColumns Список столбцов для обновления
   * @param whereColumn Столбец для условия WHERE
   * @param updates Массив объектов с данными для обновления
   * @returns Promise<void>
   */
  public static async batchUpdate<T extends ObjectLiteral>(
    dataSource: DataSource,
    tableName: string,
    updateColumns: string[],
    whereColumn: string,
    updates: Array<{ where: any; values: any[] }>,
  ): Promise<void> {
    // Проверяем тип базы данных
    const isSqlite = dataSource.options.type === 'sqlite';

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const update of updates) {
        const setClause = updateColumns.map((col, index) => `${col} = ?`).join(', ');
        await queryRunner.query(`UPDATE ${tableName} SET ${setClause} WHERE ${whereColumn} = ?`, [
          ...update.values,
          update.where,
        ]);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Получить оптимизированный репозиторий с кешированием
   * @param dataSource DataSource для получения репозитория
   * @param entity Сущность для репозитория
   * @returns Репозиторий с кешированием
   */
  public static getOptimizedRepository<Entity extends ObjectLiteral>(
    dataSource: DataSource,
    entity: any,
  ): Repository<Entity> {
    // Получаем оригинальный репозиторий
    const originalRepository = dataSource.getRepository<Entity>(entity);

    // Создаем прокси для репозитория с кешированием
    const cachedRepository = new Proxy(originalRepository, {
      get: (target, prop) => {
        // Оригинальный метод
        const originalMethod = target[prop as keyof Repository<Entity>];

        // Если это не функция или это специальный метод, возвращаем оригинал
        if (
          typeof originalMethod !== 'function' ||
          prop === 'constructor' ||
          prop === 'manager' ||
          prop === 'metadata'
        ) {
          return originalMethod;
        }

        // Возвращаем функцию-обертку с кешированием для методов find, findOne, findBy, findOneBy
        if (prop === 'find' || prop === 'findOne' || prop === 'findBy' || prop === 'findOneBy') {
          return function (...args: any[]) {
            const cacheKey = `${String(prop)}_${entity.name}_${JSON.stringify(args)}`;

            // Проверяем кеш
            const cachedResult = DbOptimizationUtil.queryCache.get(cacheKey);
            if (cachedResult && Date.now() - cachedResult.timestamp < DbOptimizationUtil.cacheTTL) {
              return cachedResult.data;
            }

            // Выполняем оригинальный метод
            const result = originalMethod.apply(target, args);

            // Если результат - Promise, обрабатываем его
            if (result instanceof Promise) {
              return result.then(data => {
                // Сохраняем результат в кеше
                DbOptimizationUtil.queryCache.set(cacheKey, { data, timestamp: Date.now() });
                return data;
              });
            }

            // Сохраняем результат в кеше
            DbOptimizationUtil.queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
          };
        }

        // Для остальных методов возвращаем оригинал
        return originalMethod;
      },
    });

    return cachedRepository;
  }

  /**
   * Оптимизировать соединения с базой данных
   * @param dataSource DataSource для оптимизации
   * @returns Promise<void>
   */
  public static async optimizeConnections(dataSource: DataSource): Promise<void> {
    // Используем DbConnectionManager для оптимизации соединений
    return DbConnectionManager.optimizeConnections();
  }

  /**
   * Создать оптимизированный EntityManager с кешированием
   * @param dataSource DataSource для создания EntityManager
   * @returns EntityManager с кешированием
   */
  public static getOptimizedEntityManager(dataSource: DataSource): EntityManager {
    // Получаем оригинальный EntityManager
    const originalManager = dataSource.manager;

    // Создаем прокси для EntityManager с кешированием
    const cachedManager = new Proxy(originalManager, {
      get: (target, prop) => {
        // Оригинальный метод
        const originalMethod = target[prop as keyof EntityManager];

        // Если это не функция или это специальный метод, возвращаем оригинал
        if (
          typeof originalMethod !== 'function' ||
          prop === 'constructor' ||
          prop === 'connection'
        ) {
          return originalMethod;
        }

        // Возвращаем функцию-обертку с кешированием для методов find, findOne, findBy, findOneBy
        if (prop === 'find' || prop === 'findOne' || prop === 'findBy' || prop === 'findOneBy') {
          return function (entityClass: any, ...args: any[]) {
            const cacheKey = `${String(prop)}_${entityClass.name}_${JSON.stringify(args)}`;

            // Проверяем кеш
            const cachedResult = DbOptimizationUtil.queryCache.get(cacheKey);
            if (cachedResult && Date.now() - cachedResult.timestamp < DbOptimizationUtil.cacheTTL) {
              return cachedResult.data;
            }

            // Выполняем оригинальный метод
            const result = originalMethod.apply(target, [entityClass, ...args]);

            // Если результат - Promise, обрабатываем его
            if (result instanceof Promise) {
              return result.then(data => {
                // Сохраняем результат в кеше
                DbOptimizationUtil.queryCache.set(cacheKey, { data, timestamp: Date.now() });
                return data;
              });
            }

            // Сохраняем результат в кеше
            DbOptimizationUtil.queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
          };
        }

        // Для остальных методов возвращаем оригинал
        return originalMethod;
      },
    });

    return cachedManager;
  }
}
