import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { TestingModule } from '@nestjs/testing';

describe('DialogService Unit с автоматическим моком', () => {
  let service: DialogService;
  let mockUserService: any;

  beforeAll(async () => {
    mockUserService = {
      findById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      findByTelegramId: jest.fn(),
    };

    const moduleRef: TestingModule = await TestModuleBuilder.create()
      .withProviders([DialogService, { provide: UserService, useValue: mockUserService }])
      .compile();

    service = moduleRef.get<DialogService>(DialogService);
  });

  it('должен автоматически добавлять мок UserService', async () => {
    expect(service).toBeDefined();
    expect(mockUserService).toBeDefined();
    expect(mockUserService.findById).toBeDefined();
  });
});
