import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { Test } from '@nestjs/testing';
import { TestConfigurations } from '../../lib/tester/test-configurations';
import { DataSource } from 'typeorm';

import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { UserService } from '../../src/user/services/user.service';
import { UserModule } from '../../src/user/user.module';
import { CharacterModule } from '../../src/character/character.module';
import { DialogModule } from '../../src/dialog/dialog.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { MockLoggingModule } from '../../lib/tester/mocks/mock-logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MonitoringModule } from '../../src/monitoring/monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';
import { MockTelegramModule } from '../../lib/tester/mocks/mock-telegram.module';

createTestSuite('Telegram Integration Test', () => {
  createTest(
    { name: 'should create fixtures correctly', configType: TestConfigType.INTEGRATION },
    async () => {
      // Подготавливаем импорты для тестирования
      const imports = TestConfigurations.prepareImportsForTesting([
        CharacterModule,
        UserModule,
        DialogModule,
        LLMModule,
        CacheModule,
        MockLoggingModule.forRoot(),
        MessageQueueModule,
        ValidationModule,
        MonitoringModule,
        PromptTemplateModule,
        // Добавляем MockTelegramModule.forRoot() вместо TelegramModule
        MockTelegramModule.forRoot(),
      ]);

      // Подготавливаем провайдеры, автоматически добавляя все необходимые моки (ConfigService, LogService, RollbarService, TelegrafToken и др.)
      const providers = TestConfigurations.requiredMocksAdder(imports);

      // Создаем модуль
      const moduleRef = await Test.createTestingModule({
        imports,
        providers,
      }).compile();

      // Получаем сервисы
      const userService = moduleRef.get<UserService>(UserService);
      const dataSource = moduleRef.get<DataSource>('DATA_SOURCE');

      // Создаем фикстуры
      const fixtureManager = new FixtureManager(dataSource);
      await fixtureManager.cleanDatabase();

      // Создаем пользователя
      const user = await userService.createUser({
        telegramId: '888999000',
        username: 'telegramuser',
        firstName: 'Иван',
        lastName: 'Телеграмов',
      });
      // Создаем персонажа
      const character = await fixtureManager.createCharacter({
        name: 'Катя',
        age: 25,
        biography: 'Дружелюбная девушка, активная в Telegram',
        appearance: 'Привлекательная девушка с каштановыми волосами и карими глазами',
        archetype: CharacterArchetype.COMPANION,
        user: user,
      });
      // Проверяем, что всё создалось корректно
      expect(user).toBeDefined();
      expect(character).toBeDefined();
      expect(character.id).toBeDefined();

      // Очищаем БД
      await fixtureManager.cleanDatabase();
    },
  );
});
