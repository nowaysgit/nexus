/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-vars, @typescript-eslint/no-redundant-type-constituents -- Database compatibility layer requires any type for generic entity operations */
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
  ObjectLiteral,
  Repository,
  UpdateEvent,
} from 'typeorm';

/**
 * Класс для обеспечения совместимости тестов с разными базами данных
 */
export class DbCompatibilityUtil {
  /**
   * Проверяет, использует ли DataSource SQLite
   * @param dataSource DataSource для проверки
   * @returns true, если используется SQLite, иначе false
   */
  public static isSqlite(dataSource: DataSource): boolean {
    return dataSource.options.type === 'sqlite';
  }

  /**
   * Проверяет, использует ли DataSource PostgreSQL
   * @param dataSource DataSource для проверки
   * @returns true, если используется PostgreSQL, иначе false
   */
  public static isPostgres(dataSource: DataSource): boolean {
    return dataSource.options.type === 'postgres';
  }

  /**
   * Возвращает SQL запрос для получения текущей даты и времени, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @returns SQL запрос для получения текущей даты и времени
   */
  public static getCurrentTimestampSql(dataSource: DataSource): string {
    return this.isSqlite(dataSource) ? "datetime('now')" : 'NOW()';
  }

  /**
   * Возвращает SQL запрос для получения даты и времени с указанным смещением, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param offsetMinutes Смещение в минутах (положительное или отрицательное)
   * @returns SQL запрос для получения даты и времени с указанным смещением
   */
  public static getTimestampWithOffsetSql(dataSource: DataSource, offsetMinutes: number): string {
    if (this.isSqlite(dataSource)) {
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const absOffset = Math.abs(offsetMinutes);
      return `datetime('now', '${sign}${absOffset} minutes')`;
    } else {
      return `NOW() + INTERVAL '${offsetMinutes} minutes'`;
    }
  }

  /**
   * Возвращает SQL запрос для преобразования строки в дату, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param dateString Строка с датой
   * @returns SQL запрос для преобразования строки в дату
   */
  public static getDateFromStringSql(dataSource: DataSource, dateString: string): string {
    return this.isSqlite(dataSource)
      ? `datetime('${dateString}')`
      : `TO_TIMESTAMP('${dateString}', 'YYYY-MM-DD HH24:MI:SS')`;
  }

  /**
   * Возвращает SQL запрос для получения разницы между двумя датами в минутах, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param date1 Первая дата (SQL выражение)
   * @param date2 Вторая дата (SQL выражение)
   * @returns SQL запрос для получения разницы между двумя датами в минутах
   */
  public static getDateDiffMinutesSql(
    dataSource: DataSource,
    date1: string,
    date2: string,
  ): string {
    if (this.isSqlite(dataSource)) {
      return `(strftime('%s', ${date1}) - strftime('%s', ${date2})) / 60`;
    } else {
      return `EXTRACT(EPOCH FROM (${date1} - ${date2})) / 60`;
    }
  }

  /**
   * Возвращает SQL запрос для получения случайного значения, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @returns SQL запрос для получения случайного значения от 0 до 1
   */
  public static getRandomSql(dataSource: DataSource): string {
    return this.isSqlite(dataSource) ? 'RANDOM() / 9223372036854775807.0' : 'RANDOM()';
  }

  /**
   * Возвращает SQL запрос для получения подстроки, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param str Строка или выражение
   * @param start Начальная позиция (с 1)
   * @param length Длина подстроки
   * @returns SQL запрос для получения подстроки
   */
  public static getSubstringSql(
    dataSource: DataSource,
    str: string,
    start: number,
    length: number,
  ): string {
    return this.isSqlite(dataSource)
      ? `SUBSTR(${str}, ${start}, ${length})`
      : `SUBSTRING(${str} FROM ${start} FOR ${length})`;
  }

  /**
   * Возвращает SQL запрос для конкатенации строк, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param strings Массив строк или выражений для конкатенации
   * @returns SQL запрос для конкатенации строк
   */
  public static getConcatSql(dataSource: DataSource, strings: string[]): string {
    if (this.isSqlite(dataSource)) {
      return strings.join(' || ');
    } else {
      return `CONCAT(${strings.join(', ')})`;
    }
  }

  /**
   * Возвращает SQL запрос для проверки существования таблицы, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param tableName Имя таблицы
   * @returns SQL запрос для проверки существования таблицы
   */
  public static getTableExistsSql(dataSource: DataSource, tableName: string): string {
    if (this.isSqlite(dataSource)) {
      return `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
    } else {
      const options = dataSource.options as { schema?: string };
      const schema = options.schema || 'public';
      return `SELECT tablename FROM pg_tables WHERE schemaname = '${schema}' AND tablename = '${tableName}'`;
    }
  }

  /**
   * Возвращает SQL запрос для получения списка всех таблиц, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @returns SQL запрос для получения списка всех таблиц
   */
  public static getAllTablesSql(dataSource: DataSource): string {
    if (this.isSqlite(dataSource)) {
      return `SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    } else {
      const options = dataSource.options as { schema?: string };
      const schema = options.schema || 'public';
      return `SELECT tablename as table_name FROM pg_tables WHERE schemaname = '${schema}'`;
    }
  }

  /**
   * Возвращает SQL запрос для очистки таблицы, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param tableName Имя таблицы
   * @returns SQL запрос для очистки таблицы
   */
  public static getCleanTableSql(dataSource: DataSource, tableName: string): string {
    if (this.isSqlite(dataSource)) {
      return `DELETE FROM "${tableName}"; DELETE FROM sqlite_sequence WHERE name='${tableName}';`;
    } else {
      return `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`;
    }
  }

  /**
   * Возвращает SQL запрос для создания временной таблицы, совместимый с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param tableName Имя таблицы
   * @param columns Описание столбцов
   * @returns SQL запрос для создания временной таблицы
   */
  public static getCreateTempTableSql(
    dataSource: DataSource,
    tableName: string,
    columns: string,
  ): string {
    if (this.isSqlite(dataSource)) {
      return `CREATE TEMPORARY TABLE "${tableName}" (${columns})`;
    } else {
      return `CREATE TEMPORARY TABLE "${tableName}" (${columns}) ON COMMIT DROP`;
    }
  }

  /**
   * Адаптирует репозиторий для работы с обеими базами данных
   * @param repository Репозиторий для адаптации
   * @param dataSource DataSource для проверки типа базы данных
   * @returns Адаптированный репозиторий
   */
  public static adaptRepository<T>(
    repository: Repository<T>,
    dataSource: DataSource,
  ): Repository<T> {
    // Если это SQLite, создаем прокси для адаптации методов
    if (this.isSqlite(dataSource)) {
      return new Proxy(repository, {
        get: (target, prop) => {
          // Оригинальный метод
          const originalMethod = target[prop as keyof Repository<T>];

          // Если это не функция или это специальный метод, возвращаем оригинал
          if (
            typeof originalMethod !== 'function' ||
            prop === 'constructor' ||
            prop === 'manager' ||
            prop === 'metadata'
          ) {
            return originalMethod;
          }

          // Адаптируем метод createQueryBuilder для SQLite
          if (prop === 'createQueryBuilder') {
            return function (...args: any[]) {
              const queryBuilder = originalMethod.apply(target, args);

              // Адаптируем методы QueryBuilder для SQLite
              const originalWhere = queryBuilder.where;
              queryBuilder.where = function (...whereArgs: any[]) {
                // Заменяем PostgreSQL-специфичные операторы на SQLite-совместимые
                if (typeof whereArgs[0] === 'string') {
                  whereArgs[0] = whereArgs[0]
                    .replace(/ILIKE/g, 'LIKE')
                    .replace(/\|\|/g, '||')
                    .replace(/::/g, '');
                }
                return originalWhere.apply(this, whereArgs);
              };

              return queryBuilder;
            };
          }

          // Для остальных методов возвращаем оригинал
          return originalMethod;
        },
      });
    }

    // Если это не SQLite, возвращаем оригинальный репозиторий
    return repository;
  }

  /**
   * Адаптирует EntityManager для работы с обеими базами данных
   * @param entityManager EntityManager для адаптации
   * @param dataSource DataSource для проверки типа базы данных
   * @returns Адаптированный EntityManager
   */
  public static adaptEntityManager(
    entityManager: EntityManager,
    dataSource: DataSource,
  ): EntityManager {
    // Если это SQLite, создаем прокси для адаптации методов
    if (this.isSqlite(dataSource)) {
      return new Proxy(entityManager, {
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

          // Адаптируем метод query для SQLite
          if (prop === 'query') {
            return function (query: string, ...args: any[]) {
              // Заменяем PostgreSQL-специфичные операторы на SQLite-совместимые
              query = query
                .replace(/ILIKE/g, 'LIKE')
                .replace(/NOW\(\)/g, "datetime('now')")
                .replace(/\|\|/g, '||')
                .replace(/::/g, '')
                .replace(/RETURNING/g, '; SELECT last_insert_rowid() AS id');

              return originalMethod.apply(target, [query, ...args]);
            };
          }

          // Адаптируем метод createQueryBuilder для SQLite
          if (prop === 'createQueryBuilder') {
            return function (...args: any[]) {
              const queryBuilder = originalMethod.apply(target, args);

              // Адаптируем методы QueryBuilder для SQLite
              const originalWhere = queryBuilder.where;
              queryBuilder.where = function (...whereArgs: any[]) {
                // Заменяем PostgreSQL-специфичные операторы на SQLite-совместимые
                if (typeof whereArgs[0] === 'string') {
                  whereArgs[0] = whereArgs[0]
                    .replace(/ILIKE/g, 'LIKE')
                    .replace(/\|\|/g, '||')
                    .replace(/::/g, '');
                }
                return originalWhere.apply(this, whereArgs);
              };

              return queryBuilder;
            };
          }

          // Для остальных методов возвращаем оригинал
          return originalMethod;
        },
      });
    }

    // Если это не SQLite, возвращаем оригинальный EntityManager
    return entityManager;
  }

  /**
   * Адаптирует SQL запрос для работы с обеими базами данных
   * @param dataSource DataSource для проверки типа базы данных
   * @param query SQL запрос для адаптации
   * @returns Адаптированный SQL запрос
   */
  public static adaptQuery(dataSource: DataSource, query: string): string {
    if (!this.isSqlite(dataSource)) {
      return query;
    }

    // Для SQLite адаптируем PostgreSQL-специфичные функции и операторы
    let adaptedQuery = query
      // Замена оператора ILIKE на LIKE (SQLite не поддерживает ILIKE)
      .replace(/\bILIKE\b/gi, 'LIKE')
      // Замена :: оператора приведения типа
      .replace(/::/g, ' ')
      // Замена NOW() на datetime('now')
      .replace(/\bNOW\(\)/gi, "datetime('now')")
      // Замена CURRENT_TIMESTAMP на datetime('now')
      .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
      // Замена EXTRACT(EPOCH FROM ...) на strftime('%s', ...)
      .replace(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+([^)]+)\)/gi, "strftime('%s', $1)")
      // Замена uuid_generate_v4() на hex(randomblob(16))
      .replace(/uuid_generate_v4\(\)/gi, 'hex(randomblob(16))')
      // Замена RETURNING на пустую строку (SQLite не поддерживает RETURNING)
      .replace(/\bRETURNING\s+[^;]*/gi, '')
      // Замена TO_CHAR на strftime
      .replace(/TO_CHAR\s*\(\s*([^,]+)\s*,\s*['"]([^'"]+)['"]\s*\)/gi, (_, col, format) => {
        // Преобразование формата PostgreSQL в формат SQLite
        const sqliteFormat = format
          .replace(/YYYY/g, '%Y')
          .replace(/MM/g, '%m')
          .replace(/DD/g, '%d')
          .replace(/HH24/g, '%H')
          .replace(/MI/g, '%M')
          .replace(/SS/g, '%S');
        return `strftime('${sqliteFormat}', ${col})`;
      });

    // Замена CONCAT на оператор ||
    adaptedQuery = adaptedQuery.replace(/CONCAT\s*\(([^)]+)\)/gi, (match, args) => {
      // Разделяем аргументы по запятой, но учитываем вложенные скобки
      const argsList = [];
      let currentArg = '';
      let depth = 0;

      for (let i = 0; i < args.length; i++) {
        const char = args[i];
        if (char === '(' || char === '[' || char === '{') {
          depth++;
          currentArg += char;
        } else if (char === ')' || char === ']' || char === '}') {
          depth--;
          currentArg += char;
        } else if (char === ',' && depth === 0) {
          argsList.push(currentArg.trim());
          currentArg = '';
        } else {
          currentArg += char;
        }
      }

      if (currentArg.trim()) {
        argsList.push(currentArg.trim());
      }

      // Соединяем аргументы оператором ||
      return argsList.join(' || ');
    });

    // Замена INTERVAL в различных контекстах
    // Сначала обрабатываем случаи вида: NOW() - INTERVAL '7 days'
    adaptedQuery = adaptedQuery.replace(
      /(\w+\(?[^)]*\)?)\s*-\s*INTERVAL\s*['"](\d+)\s+(\w+)['"]/gi,
      (_, col, num, unit) => {
        // Преобразование единиц измерения
        const sqliteUnit = unit.toLowerCase();
        return `datetime(${col}, '-${num} ${sqliteUnit}')`;
      },
    );

    // Затем обрабатываем случаи вида: NOW() + INTERVAL '7 days'
    adaptedQuery = adaptedQuery.replace(
      /(\w+\(?[^)]*\)?)\s*\+\s*INTERVAL\s*['"](\d+)\s+(\w+)['"]/gi,
      (_, col, num, unit) => {
        // Преобразование единиц измерения
        const sqliteUnit = unit.toLowerCase();
        return `datetime(${col}, '+${num} ${sqliteUnit}')`;
      },
    );

    // Замена DISTINCT ON на GROUP BY
    adaptedQuery = adaptedQuery
      .replace(/DISTINCT\s+ON\s*\(\s*([^)]+)\s*\)/gi, 'DISTINCT $1')
      // Замена FOR UPDATE на пустую строку (SQLite не поддерживает FOR UPDATE)
      .replace(/\bFOR\s+UPDATE\b/gi, '')
      // Замена CREATE INDEX CONCURRENTLY на CREATE INDEX
      .replace(/CREATE\s+INDEX\s+CONCURRENTLY/gi, 'CREATE INDEX')
      // Замена функции LOWER на lower
      .replace(/\bLOWER\s*\(/gi, 'lower(')
      // Замена функции UPPER на upper
      .replace(/\bUPPER\s*\(/gi, 'upper(');

    // Замена ON CONFLICT DO UPDATE на INSERT OR REPLACE
    if (adaptedQuery.includes('ON CONFLICT') && adaptedQuery.includes('DO UPDATE')) {
      adaptedQuery = adaptedQuery.replace(/INSERT\s+INTO/gi, 'INSERT OR REPLACE INTO');
      adaptedQuery = adaptedQuery.replace(/\s+ON\s+CONFLICT[^;]+DO\s+UPDATE\s+SET\s+[^;]+/gi, '');
    }

    // Замена ON CONFLICT DO NOTHING на INSERT OR IGNORE
    if (adaptedQuery.includes('ON CONFLICT') && adaptedQuery.includes('DO NOTHING')) {
      adaptedQuery = adaptedQuery.replace(/INSERT\s+INTO/gi, 'INSERT OR IGNORE INTO');
      adaptedQuery = adaptedQuery.replace(/\s+ON\s+CONFLICT[^;]+DO\s+NOTHING/gi, '');
    }

    return adaptedQuery;
  }

  /**
   * Адаптирует схему таблицы для совместимости с разными базами данных
   * @param tableName Имя таблицы
   * @param columns Описание колонок
   * @param dataSource DataSource для определения типа базы данных
   * @returns Адаптированная схема таблицы
   */
  public static adaptTableSchema(
    tableName: string,
    columns: Record<string, string>,
    dataSource: DataSource,
  ): string {
    const isSqlite = dataSource.options.type === 'sqlite';

    if (isSqlite) {
      // Адаптируем типы данных для SQLite
      const adaptedColumns = Object.entries(columns).map(([columnName, columnType]) => {
        const adaptedType = this.adaptDataType(columnType);
        return `"${columnName}" ${adaptedType}`;
      });

      return `CREATE TABLE IF NOT EXISTS "${tableName}" (${adaptedColumns.join(', ')})`;
    }

    // Для PostgreSQL возвращаем оригинальную схему
    const columnsDefinition = Object.entries(columns)
      .map(([columnName, columnType]) => `"${columnName}" ${columnType}`)
      .join(', ');

    return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnsDefinition})`;
  }

  /**
   * Адаптирует тип данных для совместимости с SQLite
   * @param postgresType Тип данных PostgreSQL
   * @returns Тип данных SQLite
   */
  public static adaptDataType(postgresType: string): string {
    // Преобразуем типы данных PostgreSQL в типы SQLite
    const typeMap: Record<string, string> = {
      integer: 'INTEGER',
      bigint: 'INTEGER',
      smallint: 'INTEGER',
      int: 'INTEGER',
      numeric: 'REAL',
      decimal: 'REAL',
      real: 'REAL',
      'double precision': 'REAL',
      float: 'REAL',
      boolean: 'INTEGER', // SQLite не имеет отдельного типа для boolean
      'character varying': 'TEXT',
      varchar: 'TEXT',
      character: 'TEXT',
      char: 'TEXT',
      text: 'TEXT',
      timestamp: 'TEXT',
      'timestamp without time zone': 'TEXT',
      'timestamp with time zone': 'TEXT',
      date: 'TEXT',
      time: 'TEXT',
      'time without time zone': 'TEXT',
      'time with time zone': 'TEXT',
      interval: 'TEXT',
      json: 'TEXT',
      jsonb: 'TEXT', // SQLite не имеет типа JSONB, используем TEXT
      uuid: 'TEXT',
      bytea: 'BLOB',
      citext: 'TEXT',
      point: 'TEXT',
      line: 'TEXT',
      lseg: 'TEXT',
      box: 'TEXT',
      path: 'TEXT',
      polygon: 'TEXT',
      circle: 'TEXT',
      cidr: 'TEXT',
      inet: 'TEXT',
      macaddr: 'TEXT',
      bit: 'TEXT',
      'bit varying': 'TEXT',
      tsvector: 'TEXT',
      tsquery: 'TEXT',
      xml: 'TEXT',
    };

    // Проверяем, есть ли точное соответствие
    for (const [pgType, sqliteType] of Object.entries(typeMap)) {
      if (postgresType.toLowerCase() === pgType) {
        return sqliteType;
      }
    }

    // Проверяем на частичное соответствие (например, varchar(255))
    for (const [pgType, sqliteType] of Object.entries(typeMap)) {
      if (postgresType.toLowerCase().startsWith(pgType)) {
        return sqliteType;
      }
    }

    // По умолчанию возвращаем TEXT
    return 'TEXT';
  }

  /**
   * Адаптирует данные JSON/JSONB для сохранения в SQLite
   * @param data Данные для адаптации
   * @param dataSource DataSource для определения типа базы данных
   * @returns Адаптированные данные
   */
  public static adaptJsonData(data: any, dataSource: DataSource): any {
    const isSqlite = dataSource.options.type === 'sqlite';

    if (isSqlite && data !== null && data !== undefined) {
      // Для SQLite преобразуем объекты в JSON-строки
      if (typeof data === 'object') {
        try {
          // Проверяем, не является ли data уже строкой JSON
          if (typeof data === 'string') {
            try {
              JSON.parse(data);
              return data; // Уже валидная JSON строка
            } catch {
              // Не JSON строка, продолжаем преобразование
            }
          }

          // Обрабатываем Date объекты отдельно
          if (data instanceof Date) {
            return data.toISOString();
          }

          // Преобразуем в JSON строку
          return JSON.stringify(data);
        } catch (error) {
          console.warn('Ошибка при преобразовании объекта в JSON:', error);
          // В случае ошибки возвращаем исходные данные
          return data;
        }
      }
    }

    return data;
  }

  /**
   * Адаптирует значение из базы данных для использования в приложении
   * @param value Значение из базы данных
   * @param dataSource DataSource для определения типа базы данных
   * @param expectedType Ожидаемый тип данных
   * @returns Адаптированное значение
   */
  public static adaptValueFromDatabase(
    value: any,
    dataSource: DataSource,
    expectedType: 'json' | 'boolean' | 'number' | 'date' | string = 'json',
  ): any {
    const isSqlite = dataSource.options.type === 'sqlite';

    if (isSqlite && value !== null && value !== undefined) {
      if (expectedType === 'json' && typeof value === 'string') {
        try {
          // Проверяем, является ли строка валидным JSON
          return JSON.parse(value);
        } catch (e) {
          console.warn('Ошибка при разборе JSON из SQLite:', e);
          return value;
        }
      } else if (expectedType === 'boolean') {
        // SQLite хранит boolean как 0 или 1
        if (value === 0 || value === '0' || value === false || value === 'false') {
          return false;
        }
        if (value === 1 || value === '1' || value === true || value === 'true') {
          return true;
        }
        return Boolean(value);
      } else if (expectedType === 'number') {
        // Преобразуем в число, если это возможно
        const num = Number(value);
        return isNaN(num) ? value : num;
      } else if (
        expectedType === 'date' &&
        (typeof value === 'string' || typeof value === 'number')
      ) {
        try {
          const date = new Date(value);
          // Проверяем, что дата валидна
          return isNaN(date.getTime()) ? value : date;
        } catch (e) {
          console.warn('Ошибка при преобразовании строки в дату:', e);
          return value;
        }
      }
    }

    return value;
  }

  /**
   * Преобразует тип колонки в TypeORM для совместимости с SQLite
   * @param columnOptions Опции колонки
   * @param dataSource DataSource для определения типа базы данных
   * @returns Преобразованные опции колонки
   */
  public static adaptColumnType(columnOptions: any, dataSource: DataSource): any {
    if (!this.isSqlite(dataSource)) {
      return columnOptions;
    }

    // Копируем опции, чтобы не изменять оригинальный объект
    const adaptedOptions = { ...columnOptions };

    // Преобразуем jsonb в json для SQLite
    if (adaptedOptions.type === 'jsonb') {
      adaptedOptions.type = 'json';
    }

    // Преобразуем enum в varchar для SQLite
    if (adaptedOptions.type === 'enum') {
      adaptedOptions.type = 'varchar';

      // Если не указана длина, добавляем её
      if (!adaptedOptions.length) {
        adaptedOptions.length = 50;
      }
    }

    // Преобразуем timestamp в datetime для SQLite
    if (adaptedOptions.type === 'timestamp') {
      adaptedOptions.type = 'datetime';
    }

    return adaptedOptions;
  }

  /**
   * Преобразует сущность для сохранения в SQLite
   * Автоматически преобразует все поля типа jsonb/json в строки
   * @param entity Сущность для преобразования
   * @param dataSource DataSource для определения типа базы данных
   * @param entityMetadata Метаданные сущности (опционально)
   * @returns Преобразованная сущность
   */
  public static transformEntityForSqlite<T extends Record<string, unknown>>(
    entity: T,
    dataSource: DataSource,
    entityMetadata?: { columns: Array<{ propertyName: string; type: string }> },
  ): T {
    if (!this.isSqlite(dataSource) || !entity) {
      return entity;
    }

    // Создаем копию сущности
    const transformedEntity = { ...entity };

    // Если переданы метаданные, используем их для определения типов полей
    if (entityMetadata?.columns) {
      for (const column of entityMetadata.columns) {
        const propertyName = column.propertyName;
        const columnType = column.type;

        // Если поле существует в сущности
        if (
          propertyName in transformedEntity &&
          transformedEntity[propertyName] !== null &&
          transformedEntity[propertyName] !== undefined
        ) {
          // Преобразуем JSON/JSONB поля
          if (columnType === 'json' || columnType === 'jsonb') {
            (transformedEntity as any)[propertyName] = this.adaptJsonData(
              (transformedEntity as any)[propertyName],
              dataSource,
            );
          }
          // Преобразуем boolean поля
          else if (columnType === 'boolean') {
            (transformedEntity as any)[propertyName] = (transformedEntity as any)[propertyName]
              ? 1
              : 0;
          }
        }
      }
    } else {
      // Если метаданные не переданы, преобразуем все объекты
      for (const key in transformedEntity) {
        if (
          Object.prototype.hasOwnProperty.call(transformedEntity, key) &&
          transformedEntity[key] !== null &&
          transformedEntity[key] !== undefined
        ) {
          // Преобразуем объекты в JSON строки
          const value = (transformedEntity as any)[key];
          if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            (transformedEntity as any)[key] = this.adaptJsonData(value, dataSource);
          }
        }
      }
    }

    return transformedEntity;
  }

  /**
   * Преобразует результаты запроса из SQLite
   * Автоматически преобразует строки JSON в объекты
   * @param results Результаты запроса
   * @param dataSource DataSource для определения типа базы данных
   * @param entityMetadata Метаданные сущности (опционально)
   * @returns Преобразованные результаты
   */
  public static transformResultsFromSqlite<T extends Record<string, unknown>>(
    results: T | T[],
    dataSource: DataSource,
    entityMetadata?: { columns: Array<{ propertyName: string; type: string }> },
  ): T | T[] {
    if (!this.isSqlite(dataSource) || !results) {
      return results;
    }

    // Функция для преобразования одной сущности
    const transformEntity = (entity: T): T => {
      const transformedEntity = { ...entity };

      // Если переданы метаданные, используем их для определения типов полей
      if (entityMetadata?.columns) {
        for (const column of entityMetadata.columns) {
          const propertyName = column.propertyName;
          const columnType = column.type;

          // Если поле существует в сущности
          if (
            propertyName in transformedEntity &&
            transformedEntity[propertyName] !== null &&
            transformedEntity[propertyName] !== undefined
          ) {
            // Преобразуем JSON/JSONB поля
            if (columnType === 'json' || columnType === 'jsonb') {
              (transformedEntity as any)[propertyName] = this.adaptValueFromDatabase(
                (transformedEntity as any)[propertyName],
                dataSource,
                'json',
              );
            }
            // Преобразуем boolean поля
            else if (columnType === 'boolean') {
              (transformedEntity as any)[propertyName] = this.adaptValueFromDatabase(
                (transformedEntity as any)[propertyName],
                dataSource,
                'boolean',
              );
            }
            // Преобразуем date поля
            else if (
              columnType === 'date' ||
              columnType === 'timestamp' ||
              columnType === 'datetime'
            ) {
              (transformedEntity as any)[propertyName] = this.adaptValueFromDatabase(
                (transformedEntity as any)[propertyName],
                dataSource,
                'date',
              );
            }
          }
        }
      } else {
        // Если метаданные не переданы, пытаемся преобразовать все строковые поля, похожие на JSON
        for (const key in transformedEntity) {
          if (
            Object.prototype.hasOwnProperty.call(transformedEntity, key) &&
            transformedEntity[key] !== null &&
            transformedEntity[key] !== undefined &&
            typeof transformedEntity[key] === 'string'
          ) {
            // Проверяем, похожа ли строка на JSON
            const value = transformedEntity[key] as string;
            if (
              (value.startsWith('{') && value.endsWith('}')) ||
              (value.startsWith('[') && value.endsWith(']'))
            ) {
              (transformedEntity as any)[key] = this.adaptValueFromDatabase(
                value,
                dataSource,
                'json',
              );
            }
          }
        }
      }

      return transformedEntity;
    };

    // Преобразуем массив или одну сущность
    if (Array.isArray(results)) {
      return results.map(transformEntity);
    } else {
      return transformEntity(results);
    }
  }
}

/**
 * Подписчик на события TypeORM для автоматического преобразования полей типа jsonb при работе с SQLite
 */
@EventSubscriber()
export class SqliteJsonSubscriber implements EntitySubscriberInterface {
  constructor(private dataSource: DataSource) {
    // Проверяем, является ли база данных SQLite
    if (DbCompatibilityUtil.isSqlite(dataSource)) {
      // Регистрируем подписчик
      dataSource.subscribers.push(this);
    }
  }

  /**
   * Вызывается перед вставкой сущности
   * @param event Событие вставки
   */
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    if (DbCompatibilityUtil.isSqlite(this.dataSource)) {
      this.processEntity(event.entity, event.metadata as any);
    }
  }

  /**
   * Вызывается перед обновлением сущности
   * @param event Событие обновления
   */
  beforeUpdate(event: UpdateEvent<Record<string, unknown>>): void {
    if (DbCompatibilityUtil.isSqlite(this.dataSource) && event.entity) {
      this.processEntity(event.entity, event.metadata as any);
    }
  }

  /**
   * Вызывается после загрузки сущности
   * @param event Событие загрузки
   */
  afterLoad(event: LoadEvent<Record<string, unknown>>): void {
    if (DbCompatibilityUtil.isSqlite(this.dataSource)) {
      this.processLoadedEntity(event.entity, event.metadata as any);
    }
  }

  /**
   * Обрабатывает сущность перед сохранением
   * @param entity Сущность
   * @param metadata Метаданные сущности
   */
  private processEntity(
    entity: Record<string, unknown>,
    metadata: { columns: Array<{ propertyName: string; type: string }> },
  ): void {
    if (!entity) return;

    // Перебираем все колонки
    for (const column of metadata.columns) {
      const { propertyName, type } = column;

      // Если это поле типа jsonb или json
      if ((type === 'jsonb' || type === 'json') && propertyName in entity) {
        const value = entity[propertyName];
        if (value !== null && value !== undefined) {
          // Преобразуем объект в строку JSON
          entity[propertyName] = DbCompatibilityUtil.adaptJsonData(value, this.dataSource);
        }
      }
    }
  }

  /**
   * Обрабатывает сущность после загрузки
   * @param entity Сущность
   * @param metadata Метаданные сущности
   */
  private processLoadedEntity(
    entity: Record<string, unknown>,
    metadata: { columns: Array<{ propertyName: string; type: string }> },
  ): void {
    if (!entity) return;

    // Перебираем все колонки
    for (const column of metadata.columns) {
      const { propertyName, type } = column;

      // Если это поле типа jsonb или json
      if ((type === 'jsonb' || type === 'json') && propertyName in entity) {
        const value = entity[propertyName];
        if (typeof value === 'string' && value !== '') {
          // Преобразуем строку JSON в объект
          try {
            entity[propertyName] = JSON.parse(value);
          } catch (e) {
            console.warn(`Ошибка при разборе JSON из поля ${propertyName}:`, e);
          }
        }
      }
    }
  }
}

/**
 * Регистрирует SqliteJsonSubscriber для автоматического преобразования полей типа jsonb
 * @param dataSource DataSource для регистрации подписчика
 */
export function registerSqliteJsonSubscriber(dataSource: DataSource): void {
  if (DbCompatibilityUtil.isSqlite(dataSource)) {
    new SqliteJsonSubscriber(dataSource);
    console.log(
      '[SqliteJsonSubscriber] Зарегистрирован для автоматического преобразования JSON полей',
    );
  }
}
