# Оптимизация тестов в проекте Nexus

В этом документе описаны утилиты и методы для оптимизации тестов в проекте Nexus. Эти утилиты помогают ускорить выполнение тестов, уменьшить потребление ресурсов и обеспечить совместимость с разными базами данных.

## Содержание

- [Управление соединениями с базой данных](#управление-соединениями-с-базой-данных)
- [Оптимизация очистки базы данных](#оптимизация-очистки-базы-данных)
- [Оптимизация работы с базой данных](#оптимизация-работы-с-базой-данных)
- [Совместимость с разными базами данных](#совместимость-с-разными-базами-данных)
- [Пакетное создание тестовых данных](#пакетное-создание-тестовых-данных)
- [Использование SQLite вместо PostgreSQL](#использование-sqlite-вместо-postgresql)

## Управление соединениями с базой данных

Утилита `DbConnectionManager` предоставляет методы для управления соединениями с базой данных в тестах. Она помогает избежать проблем с "too many clients" при параллельном выполнении тестов.

### Основные методы

- `registerConnection(dataSource: DataSource)` - регистрирует соединение для отслеживания
- `closeAllConnections()` - закрывает все соединения
- `getConnectionCount()` - возвращает количество активных соединений
- `getConnections()` - возвращает все активные соединения
- `clearConnections()` - очищает список соединений без их закрытия
- `optimizeConnections()` - оптимизирует соединения, закрывая неиспользуемые
- `hasActiveConnections()` - проверяет, есть ли активные соединения

### Пример использования

```typescript
import { DbConnectionManager } from '../../lib/tester/utils/db-connection-manager';
import { DataSource } from 'typeorm';

// Создание DataSource
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5433,
  username: 'test_user',
  password: 'test_password',
  database: 'nexus_test',
  entities: [...],
});

// Регистрация соединения
await dataSource.initialize();
DbConnectionManager.registerConnection(dataSource);

// После выполнения тестов
await DbConnectionManager.closeAllConnections();
```

## Оптимизация очистки базы данных

Утилита `DbCleanupUtil` предоставляет методы для быстрой очистки базы данных между тестами.

### Основные методы

- `fastCleanup(dataSource: DataSource)` - быстрая очистка всех таблиц с использованием TRUNCATE CASCADE
- `cleanupTables(dataSource: DataSource, tables: string[])` - очистка только указанных таблиц
- `createTemporarySchema(dataSource: DataSource, schemaName: string)` - создание временной схемы для изоляции тестов
- `dropTemporarySchema(dataSource: DataSource, schemaName: string)` - удаление временной схемы
- `tableExists(dataSource: DataSource, tableName: string)` - проверка существования таблицы
- `getAllTables(dataSource: DataSource)` - получение списка всех таблиц в схеме

### Пример использования

```typescript
import { DbCleanupUtil } from '../../lib/tester/utils/db-cleanup';
import { DataSource } from 'typeorm';

// Создание DataSource
const dataSource = new DataSource({...});
await dataSource.initialize();

// Быстрая очистка всех таблиц
await DbCleanupUtil.fastCleanup(dataSource);

// Очистка только указанных таблиц
await DbCleanupUtil.cleanupTables(dataSource, ['user', 'character', 'dialog']);

// Создание временной схемы для изоляции тестов
const schemaName = 'test_schema_' + Date.now();
await DbCleanupUtil.createTemporarySchema(dataSource, schemaName);

// После выполнения тестов
await DbCleanupUtil.dropTemporarySchema(dataSource, schemaName);
```

## Оптимизация работы с базой данных

Утилита `DbOptimizationUtil` предоставляет методы для оптимизации работы с базой данных в интеграционных тестах.

### Основные методы

- `executeQueryWithCache(dataSource: DataSource, query: string, parameters?: any[], cacheKey?: string)` - выполнение запроса с кешированием результата
- `executeQueriesInTransaction(dataSource: DataSource, queries: { query: string; parameters?: any[] }[])` - выполнение нескольких запросов в одной транзакции
- `batchInsert(dataSource: DataSource, tableName: string, columns: string[], values: any[][])` - пакетная вставка данных
- `batchUpdate(dataSource: DataSource, tableName: string, updateColumns: string[], whereColumn: string, updates: Array<{ where: any; values: any[] }>)` - пакетное обновление данных
- `getOptimizedRepository(dataSource: DataSource, entity: any)` - получение оптимизированного репозитория с кешированием
- `getOptimizedEntityManager(dataSource: DataSource)` - получение оптимизированного EntityManager с кешированием
- `clearCache()` - очистка кеша запросов
- `setCacheTTL(ttl: number)` - установка времени жизни кеша

### Пример использования

```typescript
import { DbOptimizationUtil } from '../../lib/tester/utils/db-optimization';
import { DataSource } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';

// Создание DataSource
const dataSource = new DataSource({...});
await dataSource.initialize();

// Выполнение запроса с кешированием
const users = await DbOptimizationUtil.executeQueryWithCache(
  dataSource,
  'SELECT * FROM "user" WHERE "isActive" = $1',
  [true],
);

// Выполнение нескольких запросов в одной транзакции
await DbOptimizationUtil.executeQueriesInTransaction(dataSource, [
  {
    query: 'INSERT INTO "user" (email, password) VALUES ($1, $2)',
    parameters: ['user1@example.com', 'password'],
  },
  {
    query: 'INSERT INTO "user" (email, password) VALUES ($1, $2)',
    parameters: ['user2@example.com', 'password'],
  },
]);

// Пакетная вставка данных
await DbOptimizationUtil.batchInsert(
  dataSource,
  'user',
  ['email', 'password', 'isActive'],
  [
    ['user3@example.com', 'password', true],
    ['user4@example.com', 'password', true],
  ],
);

// Получение оптимизированного репозитория
const userRepository = DbOptimizationUtil.getOptimizedRepository(dataSource, User);
const activeUsers = await userRepository.find({ where: { isActive: true } });

// Очистка кеша
DbOptimizationUtil.clearCache();
```

## Совместимость с разными базами данных

Утилита `DbCompatibilityUtil` предоставляет методы для обеспечения совместимости тестов с разными базами данных (PostgreSQL и SQLite).

### Основные методы

- `isSqlite(dataSource: DataSource)` - проверяет, использует ли DataSource SQLite
- `isPostgres(dataSource: DataSource)` - проверяет, использует ли DataSource PostgreSQL
- `getCurrentTimestampSql(dataSource: DataSource)` - возвращает SQL запрос для получения текущей даты и времени
- `getTimestampWithOffsetSql(dataSource: DataSource, offsetMinutes: number)` - возвращает SQL запрос для получения даты и времени с указанным смещением
- `getDateDiffMinutesSql(dataSource: DataSource, date1: string, date2: string)` - возвращает SQL запрос для получения разницы между двумя датами в минутах
- `getSubstringSql(dataSource: DataSource, str: string, start: number, length: number)` - возвращает SQL запрос для получения подстроки
- `getConcatSql(dataSource: DataSource, strings: string[])` - возвращает SQL запрос для конкатенации строк
- `adaptQuery(dataSource: DataSource, query: string)` - адаптирует SQL запрос для работы с обеими базами данных
- `adaptRepository(repository: Repository<T>, dataSource: DataSource)` - адаптирует репозиторий для работы с обеими базами данных
- `adaptEntityManager(entityManager: EntityManager, dataSource: DataSource)` - адаптирует EntityManager для работы с обеими базами данных

### Пример использования

```typescript
import { DbCompatibilityUtil } from '../../lib/tester/utils/db-compatibility';
import { DataSource } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';

// Создание DataSource
const dataSource = new DataSource({...});
await dataSource.initialize();

// Проверка типа базы данных
if (DbCompatibilityUtil.isSqlite(dataSource)) {
  console.log('Используется SQLite');
} else if (DbCompatibilityUtil.isPostgres(dataSource)) {
  console.log('Используется PostgreSQL');
}

// Получение SQL запроса для текущей даты и времени
const currentTimestamp = DbCompatibilityUtil.getCurrentTimestampSql(dataSource);
const result = await dataSource.query(`SELECT ${currentTimestamp} as now`);

// Адаптация SQL запроса
const query = `
  SELECT *
  FROM "user"
  WHERE "firstName" ILIKE 'test%'
  AND "createdAt" <= NOW()
`;
const adaptedQuery = DbCompatibilityUtil.adaptQuery(dataSource, query);
const users = await dataSource.query(adaptedQuery);

// Адаптация репозитория
const userRepository = dataSource.getRepository(User);
const adaptedRepository = DbCompatibilityUtil.adaptRepository(userRepository, dataSource);
const testUsers = await adaptedRepository
  .createQueryBuilder('user')
  .where('user.firstName ILIKE :name', { name: 'test%' })
  .getMany();
```

## Пакетное создание тестовых данных

Класс `FixtureManager` предоставляет методы для пакетного создания тестовых данных, что значительно ускоряет выполнение тестов.

### Основные методы

- `createUsers(count: number, options?: Partial<User>)` - создание нескольких пользователей
- `createCharacters(count: number, options?: Partial<Character>)` - создание нескольких персонажей
- `createDialogs(count: number, options?: Partial<Dialog>)` - создание нескольких диалогов
- `createMessages(dialogId: number, count: number)` - создание нескольких сообщений для диалога
- `createNeeds(characterId: number, count?: number, options?: Partial<Need>)` - создание потребностей для персонажа
- `createMotivations(characterId: number, count: number, options?: Partial<CharacterMotivation>)` - создание мотиваций для персонажа
- `createActions(characterId: number, count: number, options?: Partial<Action>)` - создание действий для персонажа
- `createManyMemories(characterId: number, count: number)` - создание воспоминаний для персонажа
- `createBatchUserCharacterDialog(options?: { userId?: number })` - создание пользователя, персонажа и диалога за один вызов
- `createOptimizedCharacterSetup(options?: { userId?: number })` - создание полного набора данных для персонажа за один вызов
- `createBatchTestData(options: { ... })` - создание полного набора тестовых данных для всего приложения за минимальное количество запросов
- `cleanDatabase()` - быстрая очистка базы данных с использованием оптимизированного метода

### Пример использования

```typescript
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { DataSource } from 'typeorm';

// Создание DataSource
const dataSource = new DataSource({...});
await dataSource.initialize();

// Создание FixtureManager
const fixtureManager = new FixtureManager(dataSource);

// Очистка базы данных
await fixtureManager.cleanDatabase();

// Создание пользователей
const users = await fixtureManager.createUsers(5);

// Создание персонажей для первого пользователя
const characters = await fixtureManager.createCharacters(3, { userId: users[0].id });

// Создание диалога
const dialog = await fixtureManager.createDialog({
  userId: users[0].id,
  characterId: characters[0].id,
});

// Создание сообщений для диалога
const messages = await fixtureManager.createMessages(dialog.id, 10);

// Создание полного набора данных для персонажа
const setup = await fixtureManager.createOptimizedCharacterSetup();

// Создание полного набора тестовых данных для всего приложения
const testData = await fixtureManager.createBatchTestData({
  usersCount: 2,
  charactersPerUser: 2,
  needsPerCharacter: 3,
  motivationsPerCharacter: 2,
  actionsPerCharacter: 2,
  dialogsPerCharacter: 1,
  messagesPerDialog: 5,
  memoriesPerCharacter: 5,
});
```

## Использование SQLite вместо PostgreSQL

Для ускорения выполнения тестов и обеспечения возможности запуска тестов без необходимости запуска Docker контейнеров, добавлена поддержка SQLite в памяти в качестве альтернативы PostgreSQL.

### Основные методы

- `createSqliteDataSource(entities: any[])` - создание DataSource для SQLite в памяти
- `createTestDataSource(entities?: any[])` - создание DataSource для тестов (автоматически выбирает тип базы данных)

### Пример использования

```typescript
import { createTestDataSource, createSqliteDataSource } from '../../lib/tester/utils/data-source';
import { User } from '../../src/user/entities/user.entity';

// Создание DataSource для SQLite
const sqliteDataSource = await createSqliteDataSource([User]);

// Создание DataSource с автоматическим выбором типа базы данных
// Если переменная окружения USE_SQLITE=true, будет использоваться SQLite
// Если PostgreSQL недоступен, будет использоваться SQLite
const dataSource = await createTestDataSource();

// Проверка типа базы данных
if (dataSource.options.type === 'sqlite') {
  console.log('Используется SQLite');
} else {
  console.log('Используется PostgreSQL');
}
```

### Запуск тестов с SQLite

```bash
# Запуск всех тестов с SQLite
USE_SQLITE=true yarn test:all

# Запуск только интеграционных тестов с SQLite
USE_SQLITE=true yarn test:integration

# Использование скриптов из package.json
yarn test:sqlite:all
yarn test:sqlite:integration
yarn test:sqlite:parallel
```

## Рекомендации по оптимизации тестов

1. **Используйте пакетное создание данных** - вместо создания каждого объекта по отдельности, используйте методы пакетного создания данных из `FixtureManager`
2. **Оптимизируйте очистку базы данных** - используйте `cleanDatabase()` из `FixtureManager` или `fastCleanup()` из `DbCleanupUtil` вместо удаления записей по одной
3. **Используйте кеширование запросов** - для часто выполняемых запросов используйте `executeQueryWithCache()` из `DbOptimizationUtil`
4. **Выполняйте запросы в транзакции** - для нескольких связанных запросов используйте `executeQueriesInTransaction()` из `DbOptimizationUtil`
5. **Используйте SQLite для простых тестов** - для большинства юнит-тестов и простых интеграционных тестов SQLite будет работать корректно и значительно быстрее
6. **Адаптируйте запросы для совместимости** - если ваши тесты должны работать как с PostgreSQL, так и с SQLite, используйте методы из `DbCompatibilityUtil`
7. **Управляйте соединениями** - используйте `DbConnectionManager` для отслеживания и закрытия соединений
8. **Используйте временные схемы** - для изоляции тестов используйте `createTemporarySchema()` из `DbCleanupUtil` 