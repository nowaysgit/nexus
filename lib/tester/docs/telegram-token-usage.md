# Использование TelegrafTokenProvider в тестах

Для тестов, которые используют TelegramModule или зависят от него, необходимо добавить мок для TELEGRAF_TOKEN, чтобы избежать ошибки:

```
Nest can't resolve dependencies of the TelegramService (?, ConfigService, LogService). 
Please make sure that the argument TELEGRAF_TOKEN at index [0] is available in the TelegramModule context.
```

## Пример использования TelegrafTokenProvider:

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

## Интеграция с существующими тестами:

Если у вас уже есть тесты, которые используют `createTest`, добавьте `TelegrafTokenProvider` в список провайдеров:

```typescript
import { TelegrafTokenProvider } from '../../lib/tester/mocks/telegraf-token.provider';

providers: [
  // Другие провайдеры
  TelegrafTokenProvider, // Мок для TELEGRAF_TOKEN
]
```

## Использование mockTelegraf для проверок:

Файл TelegrafTokenProvider не только предоставляет провайдер для TELEGRAF_TOKEN, но и экспортирует mockTelegraf, который можно использовать для проверки вызовов методов:

```typescript
import { mockTelegraf } from '../../lib/tester/mocks/telegraf-token.provider';

// В тесте:
expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledWith('test_chat_id', 'Test message');
```

## Интеграция с MockTelegramModule

Если вы используете MockTelegramModule, TelegrafTokenProvider уже включен в него, поэтому нет необходимости добавлять его отдельно.

```typescript
import { MockTelegramModule } from '../../lib/tester/mocks';

// В тесте:
const module = await Test.createTestingModule({
  imports: [MockTelegramModule],
  // другие настройки
}).compile();
```

## Решение проблем

Если вы все еще получаете ошибку `TELEGRAF_TOKEN`, попробуйте следующие шаги:

1. Убедитесь, что TelegrafTokenProvider добавлен в провайдеры
2. Проверьте, что ваш TelegramModule правильно настроен для тестового окружения
3. Используйте MockTelegramModule вместо TelegramModule в тестах
4. Если вы используете динамический модуль (TelegramModule.forRoot()), убедитесь, что он правильно мокирован 