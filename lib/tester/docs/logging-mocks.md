# Моки для LogService и RollbarService

В этом документе описаны доступные моки для сервисов логирования и их использование в тестах.

## Доступные моки

### MockLogService

Мок для `LogService` с реализацией всех методов логирования.

```typescript
import { MockLogService } from '../../lib/tester/mocks';
```

**Особенности:**
- Выводит логи в консоль с префиксами `[MOCK LOG]`, `[MOCK INFO]` и т.д.
- Поддерживает контекст через методы `setContext`, `getContext` и `forContext`
- Возвращает 'TestContext' по умолчанию, если контекст не задан
- Полностью совместим с жизненным циклом NestJS

### MockRollbarService

Мок для `RollbarService` с реализацией всех методов логирования.

```typescript
import { MockRollbarService } from '../../lib/tester/mocks';
```

**Особенности:**
- Имеет свойство `enabled = false`, отключающее вывод логов
- Выводит логи в консоль с префиксами `[MOCK ROLLBAR]` при `enabled = true`
- Совместим с жизненным циклом NestJS через `onModuleInit`

## Способы использования

### 1. Прямое использование классов-моков

```typescript
import { Test } from '@nestjs/testing';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';

describe('MyService', () => {
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: RollbarService,
          useClass: MockRollbarService,
        },
      ],
    }).compile();
  });
});
```

### 2. Использование TestConfigurations.addLoggingMocks

```typescript
import { Test } from '@nestjs/testing';
import { TestConfigurations } from '../../lib/tester/test-configurations';

describe('MyService', () => {
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: TestConfigurations.addLoggingMocks([
        MyService,
        // другие провайдеры...
      ]),
    }).compile();
  });
});
```

### 3. Использование TestConfigurations.requiredMocksAdder в интеграционных тестах

```typescript
import { createTestSuite, createTest } from '../../lib/tester';
import { TestConfigurations } from '../../lib/tester/test-configurations';

createTestSuite('MyService Integration Tests', () => {
  createTest({ 
    name: 'should do something', 
    configType: 'integration',
    providers: TestConfigurations.requiredMocksAdder([
      MyService,
      // другие провайдеры...
    ]),
  }, async (context) => {
    // тест...
  });
});
```

## Автоматическое исправление проблем с моками

Для автоматического добавления моков в существующие тесты можно использовать скрипт `fix-logging-mocks.js`:

```bash
node scripts/fix-logging-mocks.js [путь к директории с тестами]
```

Например:

```bash
node scripts/fix-logging-mocks.js test/character
```

## Решение проблем

### Ошибка: Cannot find module 'nest-winston'

Если вы видите ошибку `Cannot find module 'nest-winston'`, добавьте следующий мок для `WINSTON_MODULE_PROVIDER`:

```typescript
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

// В провайдерах модуля
{
  provide: WINSTON_MODULE_PROVIDER,
  useValue: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
}
```

### Ошибка: Rollbar configuration is missing

Если вы видите ошибку `Rollbar configuration is missing`, убедитесь, что вы добавили мок для `ConfigService`:

```typescript
import { ConfigService } from '@nestjs/config';

// В провайдерах модуля
{
  provide: ConfigService,
  useValue: {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'logging.rollbar') {
        return {
          enabled: false,
          accessToken: 'test-token',
          environment: 'test',
          captureUncaught: false,
          captureUnhandledRejections: false,
        };
      }
      return null;
    }),
  },
}
```

Или используйте `TestConfigurations.addConfigServiceProvider()` для автоматического добавления мока `ConfigService`. 