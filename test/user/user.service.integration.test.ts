import { Tester, createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { UserService } from '../../src/user/services/user.service';
import { CreateUserDto } from '../../src/user/dto/create-user.dto';
import { UpdateUserDto } from '../../src/user/dto/update-user.dto';
import { DataSource } from 'typeorm';

createTestSuite('UserService Integration Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE, {
      imports: [],
      providers: [],
      controllers: [],
    });
    fixtureManager = new FixtureManager(dataSource);
  });

  afterAll(async () => {
    await tester.close();
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'должен создать нового пользователя',
      configType: TestConfigType.DATABASE,
    },
    async _context => {
      // Не используем context в этом тесте, так как создаем пользователя через fixtureManager
      const createUserDto: CreateUserDto = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'ru',
      };

      const user = await fixtureManager.createUser(createUserDto);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.telegramId).toBe(createUserDto.telegramId);
      expect(user.username).toBe(createUserDto.username);
      expect(user.firstName).toBe(createUserDto.firstName);
      expect(user.lastName).toBe(createUserDto.lastName);
      expect(user.language).toBe(createUserDto.language);
      expect(user.isActive).toBe(true);
      expect(user.hasCompletedTest).toBe(false);
      expect(user.hasActivatedKey).toBe(false);
      expect(user.messagesCount).toBe(0);
    },
  );

  createTest(
    {
      name: 'должен найти пользователя по ID',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const createdUser = await fixtureManager.createUser({
        telegramId: '987654321',
        username: 'finduser',
        firstName: 'Find',
        lastName: 'User',
      });
      const foundUser = await userService.findUserById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.telegramId).toBe('987654321');
      expect(foundUser.username).toBe('finduser');
    },
  );

  createTest(
    {
      name: 'должен найти пользователя по Telegram ID',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const telegramId = '555666777';
      await fixtureManager.createUser({
        telegramId,
        username: 'telegramuser',
        firstName: 'Telegram',
        lastName: 'User',
      });
      const foundUser = await userService.findByTelegramId(telegramId);

      expect(foundUser).toBeDefined();
      expect(foundUser.telegramId).toBe(telegramId);
      expect(foundUser.username).toBe('telegramuser');
    },
  );

  createTest(
    {
      name: 'должен обновить данные пользователя',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const user = await fixtureManager.createUser({
        telegramId: '111222333',
        username: 'updateuser',
        firstName: 'Update',
        lastName: 'User',
      });
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'UserUpdated',
        language: 'en',
        preferences: {
          theme: 'dark',
          receiveNotifications: true,
        },
        communicationStyle: {
          formality: 3,
          emotionality: 2,
          verbosity: 4,
        },
      };

      const updatedUser = await userService.updateUser(user.id, updateDto);

      expect(updatedUser).toBeDefined();
      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('UserUpdated');
      expect(updatedUser.language).toBe('en');
      expect(updatedUser.preferences).toEqual(updateDto.preferences);
      expect(updatedUser.communicationStyle).toEqual(updateDto.communicationStyle);
    },
  );

  createTest(
    {
      name: 'должен удалить пользователя',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const user = await fixtureManager.createUser({
        telegramId: '999888777',
        username: 'deleteuser',
        firstName: 'Delete',
        lastName: 'User',
      });
      await userService.remove(user.id);

      await expect(userService.findUserById(user.id)).rejects.toThrow();
    },
  );

  createTest(
    {
      name: 'должен сгенерировать ключ доступа для пользователя',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const user = await fixtureManager.createUser({
        telegramId: '444555666',
        username: 'keyuser',
        firstName: 'Key',
        lastName: 'User',
      });
      const accessKey = await userService.generateAccessKey(user.id);

      expect(accessKey).toBeDefined();
      expect(typeof accessKey).toBe('string');
      expect(accessKey.length).toBeGreaterThan(10);
    },
  );

  createTest(
    {
      name: 'должен активировать ключ доступа',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const userService = context.get(UserService) as UserService;
      const user = await fixtureManager.createUser({
        telegramId: '777888999',
        username: 'activateuser',
        firstName: 'Activate',
        lastName: 'User',
      });
      const key = await userService.generateAccessKey(user.id);
      const result = await userService.activateAccessKey(user.id, key);

      expect(result).toBe(true);
      const updatedUser = await userService.findUserById(user.id);
      expect(updatedUser.hasActivatedKey).toBe(true);
    },
  );
});
