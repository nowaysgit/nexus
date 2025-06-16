import { createTestSuite, createTest } from '../../lib/tester';
import { TestingModule } from '@nestjs/testing';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { DialogModule } from '../../src/dialog/dialog.module';
import { CacheModule } from '../../src/cache/cache.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { UserService } from '../../src/user/services/user.service';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { ConfigService } from '@nestjs/config';
import { mockConfigService } from '../../lib/tester/mocks';
import { DynamicModule } from '@nestjs/common';

const mockUserService = {
  findById: jest.fn().mockResolvedValue({ id: 123, telegramId: '12345' }),
};

createTestSuite('DialogService Fix Tests', () => {
  let service: DialogService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        DialogModule,
        CacheModule,
        MessageQueueModule,
        ValidationModule,
        {
          global: true,
          module: class MockConfigModule {},
          providers: [{ provide: ConfigService, useValue: mockConfigService }],
          exports: [ConfigService],
        } as DynamicModule,
      ])
      .withProviders([{ provide: UserService, useValue: mockUserService }])
      .withRequiredMocks()
      .compile();

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
    },
    async () => {
      expect(service).toBeDefined();
    },
  );
});
