import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { DialogModule } from '../../src/dialog/dialog.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { CacheModule } from '../../src/cache/cache.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { ConfigModule } from '@nestjs/config';
import { UserService } from '../../src/user/services/user.service';

const mockUserService = {
  findById: jest.fn().mockResolvedValue({ id: 123, telegramId: '12345' }),
};

createTestSuite('DialogService Fix Tests', () => {
  let service: DialogService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        DialogModule,
        LoggingModule,
        CacheModule,
        MessageQueueModule,
        ValidationModule,
        ConfigModule.forRoot({ isGlobal: true }),
      ],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    service = moduleRef.get<DialogService>(DialogService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'должен корректно инициализироваться с моком UserService',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      expect(service).toBeDefined();
    },
  );
});
