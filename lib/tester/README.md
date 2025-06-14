# Библиотека для тестирования Nexus

## Введение

Nexus Tester - это библиотека для написания тестов в проекте Nexus. Она предоставляет набор инструментов для создания и управления тестовыми данными, а также для настройки тестового окружения.

## Основные компоненты

### Tester

Центральный класс, управляющий тестовым окружением. Доступ к нему осуществляется через синглтон:

```typescript
const tester = Tester.getInstance();
```

### FixtureManager

Класс для создания и управления тестовыми данными:

```typescript
const fixtureManager = new FixtureManager(dataSource);
```

### Функции для создания тестов

- `createTestSuite` - создает набор тестов
- `createTest` - создает отдельный тест внутри набора
- `createTestDataSource` - создает источник данных для тестов

## Настройка тестового окружения

### Базовая структура теста

```typescript
import { createTestSuite, createTest, TestConfigType, createTestDataSource } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';

createTestSuite('Название набора тестов', () => {
  let fixtureManager;
  let dataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.initialize();
    fixtureManager = new FixtureManager(dataSource);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'Название теста',
      configType: TestConfigType.DATABASE,
      imports: [/* модули для импорта */],
    },
    async (context) => {
      // Тестовый код
    }
  );
});
```

## Использование mock-сервисов

### MockUserService

В проекте реализован типизированный мок для UserService, который автоматически подключается при использовании DialogModule в тестах.

#### Пример использования mockUserService напрямую

```typescript
import { mockUserService } from '../../lib/tester/mocks/user-service.mock';

createTest(
  {
    name: 'тест с явным использованием mockUserService',
    configType: TestConfigType.DATABASE,
    imports: [/* нужные модули */],
    providers: [
      {
        provide: 'UserService',
        useValue: mockUserService
      }
    ]
  },
  async (context) => {
    // Тестовый код
  }
);
```

#### Автоматическое подключение mockUserService при использовании DialogModule

Для тестов с DialogModule рекомендуется использовать готовую конфигурацию:

```typescript
import { getDialogTestConfig } from '../../lib/tester/test-configurations/dialog-test.config';

createTest(
  {
    name: 'тест с DialogService',
    configType: TestConfigType.DATABASE,
    ...getDialogTestConfig(),
    imports: [DialogModule, /* другие нужные модули */]
  },
  async (context) => {
    const dialogService = context.get<DialogService>(DialogService);
    
    // Теперь в DialogService используется mockUserService
    const dialog = await dialogService.createDialog({
      userId: '123',
      characterId: 456
    });
    
    // Тестовый код
  }
);
```

### Особенности mockUserService

1. Поддерживает как string, так и number для ID пользователя
2. Генерирует тестовые данные пользователя с минимальными необходимыми полями
3. Имеет строгую типизацию через интерфейс MockUserService
4. Методы возвращают промисы для соответствия реальному UserService

## Типы в EmotionalState

При работе с EmotionalState в тестах обратите внимание на следующее:

1. В некоторых тестах (например, technique-executor.service.test.ts) ожидается наличие поля `current` в EmotionalState
2. В других местах используется формат с полями `primary`, `secondary`, `intensity` и `description`
3. Для обновления через EmotionalStateService можно использовать формат с полем `emotions` в виде объекта

Рекомендуется проверять, какой формат ожидается в конкретном тесте.

## Создание новых тестов

Для создания новых тестов рекомендуется использовать готовые шаблоны из директории `lib/tester/templates`:

1. Скопируйте шаблон интеграционного теста из `integration-test-template.ts`
2. Настройте импорты и тестовые случаи в соответствии с вашими требованиями
3. Для тестов с DialogService используйте `getDialogTestConfig()`
4. Убедитесь, что очищаете базу данных через `fixtureManager.cleanDatabase()` перед каждым тестом

## Рекомендации по тестированию

1. Используйте строгую типизацию во всех тестах
2. Создавайте фикстуры через методы FixtureManager
3. Проверяйте изменения в базе данных после выполнения операций
4. Для тестов с DialogService всегда используйте mockUserService
5. Обращайтесь к репозиториям через fixtureManager.getRepository()
6. Используйте поле `personality.musicTaste` при создании персонажей
7. При создании потребностей используйте поле `currentValue` вместо `currentLevel`

## Полезные ссылки

- [Jest документация](https://jestjs.io/docs/getting-started)
- [NestJS тестирование](https://docs.nestjs.com/fundamentals/testing)
- [TypeORM документация](https://typeorm.io/)

## Использование TelegrafTokenProvider в тестах

Для тестов, которые используют TelegramModule или зависят от него, необходимо добавить мок для TELEGRAF_TOKEN, чтобы избежать ошибки:

```
Nest can't resolve dependencies of the TelegramService (?, ConfigService, LogService). 
Please make sure that the argument TELEGRAF_TOKEN at index [0] is available in the TelegramModule context.
```

### Пример использования TelegrafTokenProvider:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TelegrafTokenProvider } from '../../lib/tester/mocks/telegraf-token.provider';

// В тесте:
const module = await Test.createTestingModule({
  imports: [/* ваши импорты */],
  providers: [
    // Ваши провайдеры
    TelegrafTokenProvider, // Добавляем провайдер для TELEGRAF_TOKEN
  ],
}).compile();
```

### Интеграция с существующими тестами:

Если у вас уже есть тесты, которые используют `createTest`, добавьте `TelegrafTokenProvider` в список провайдеров:

```typescript
import { TelegrafTokenProvider } from '../../lib/tester/mocks/telegraf-token.provider';

providers: [
  // Другие провайдеры
  TelegrafTokenProvider, // Мок для TELEGRAF_TOKEN
]
```

Важно: Файл TelegrafTokenProvider не только предоставляет провайдер для TELEGRAF_TOKEN, но и экспортирует mockTelegraf, который можно использовать для проверки вызовов методов:

```typescript
import { mockTelegraf } from '../../lib/tester/mocks/telegraf-token.provider';

// В тесте:
expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledWith('test_chat_id', 'Test message');
``` 