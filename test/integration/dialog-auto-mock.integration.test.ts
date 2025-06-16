import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { DialogModule } from '../../src/dialog/dialog.module';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { TestConfigurations } from '../../lib/tester/test-configurations';

createTestSuite('DialogService Integration с автоматическим моком', () => {
  let service: DialogService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    const mockUserService = { findById: jest.fn() };

    const rawImports = [DialogModule];
    const imports = TestConfigurations.prepareImportsForTesting(rawImports);

    const baseProviders = [{ provide: UserService, useValue: mockUserService }];

    const providers = TestConfigurations.requiredMocksAdder(imports, baseProviders);

    moduleRef = await Test.createTestingModule({
      imports,
      providers,
    }).compile();

    service = moduleRef.get<DialogService>(DialogService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  createTest(
    {
      name: 'должен автоматически добавлять мок UserService',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      expect(service).toBeDefined();
    },
  );
});
