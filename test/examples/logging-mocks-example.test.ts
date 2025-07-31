import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

createTestSuite('Пример использования моков для логирования', () => {
  let moduleRef: TestingModule;
  let logService: LogService;
  let _rollbarService: RollbarService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        { provide: LogService, useClass: MockLogService },
        { provide: RollbarService, useClass: MockRollbarService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: { info: jest.fn() } },
      ],
    }).compile();

    logService = moduleRef.get<LogService>(LogService);
    _rollbarService = moduleRef.get<RollbarService>(RollbarService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  createTest(
    { name: 'должен использовать мок LogService', configType: TestConfigType.BASIC },
    async () => {
      expect(logService).toBeDefined();
      expect(logService).toBeInstanceOf(MockLogService);
      logService.info('Тестовое сообщение');
    },
  );
});
