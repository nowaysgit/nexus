import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { UserService } from '../../src/user/services/user.service';
import { TestingModule } from '@nestjs/testing';

describe('Telegram Unit Test', () => {
  it('should create fixtures correctly', async () => {
    // Создаем мок для UserService
    const mockUserService = {
      createUser: jest.fn().mockImplementation(async (userData: any) => {
        return {
          id: Math.floor(Math.random() * 1000),
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    };

    // Создаем модуль
    const moduleRef: TestingModule = await TestModuleBuilder.create()
      .withProviders([{ provide: UserService, useValue: mockUserService }])
      .compile();

    // Получаем сервисы
    const userService = moduleRef.get<UserService>(UserService);

    // Создаем пользователя
    const user = await userService.createUser({
      telegramId: '888999000',
      username: 'telegramuser',
      firstName: 'Иван',
      lastName: 'Телеграмов',
    });

    // Проверяем, что всё создалось корректно
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(mockUserService.createUser).toHaveBeenCalledWith({
      telegramId: '888999000',
      username: 'telegramuser',
      firstName: 'Иван',
      lastName: 'Телеграмов',
    });
  });
});
