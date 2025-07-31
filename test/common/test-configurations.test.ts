import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { LogService } from '../../src/logging/log.service';

class DummyService {
  hello() {
    return 'world';
  }
}

createTestSuite('TestConfigurations & TestModuleBuilder Unit Test', () => {
  createTest(
    { name: 'должен автоматически добавлять моки', configType: TestConfigType.BASIC },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withProviders([DummyService])
        .withRequiredMocks()
        .compile();

      const dummy = moduleRef.get(DummyService);
      const logService = moduleRef.get<LogService>(LogService);

      expect(dummy.hello()).toBe('world');
      expect(logService).toBeDefined();
      expect(typeof logService.log).toBe('function');

      await moduleRef.close();
    },
  );
});
