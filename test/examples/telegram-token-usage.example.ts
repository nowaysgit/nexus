import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from '../../src/telegram/telegram.service';
import { TelegramModule } from '../../src/telegram/telegram.module';
import { TelegrafTokenProvider } from '../../lib/tester/mocks/telegraf-token.provider';
import { Module } from '@nestjs/common';

@Module({
  imports: [TelegramModule],
  providers: [],
})
class TestTelegramModule {}

createTestSuite('Пример использования TelegrafTokenProvider', () => {
  let telegramService: TelegramService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestTelegramModule],
      providers: [TelegrafTokenProvider],
    }).compile();
    telegramService = moduleRef.get<TelegramService>(TelegramService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  createTest(
    {
      name: 'TelegramService должен быть доступен с мок-токеном',
      configType: TestConfigType.BASIC,
    },
    async () => {
      expect(telegramService).toBeDefined();
    },
  );
});
