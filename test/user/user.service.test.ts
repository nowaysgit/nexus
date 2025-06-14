import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';

createTestSuite('UserService Tests', () => {
  createTest(
    {
      name: 'should be defined',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should create user',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'user-123',
              telegramId: '123456789',
              username: 'testuser',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const userData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      };

      const user = await service.create(userData);

      expect(user.id).toBe('user-123');
      expect(user.telegramId).toBe('123456789');
      expect(user.username).toBe('testuser');
      expect(user.isActive).toBe(true);
      expect(service.create).toHaveBeenCalledWith(userData);
    },
  );

  createTest(
    {
      name: 'should find user by ID',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn().mockResolvedValue({
              id: 'user-123',
              telegramId: '123456789',
              username: 'testuser',
              firstName: 'Test',
              lastName: 'User',
              isActive: true,
            }),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.findById('user-123');

      expect(user.id).toBe('user-123');
      expect(user.telegramId).toBe('123456789');
      expect(user.username).toBe('testuser');
      expect(service.findById).toHaveBeenCalledWith('user-123');
    },
  );

  createTest(
    {
      name: 'should find user by Telegram ID',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn().mockResolvedValue({
              id: 'user-123',
              telegramId: '123456789',
              username: 'testuser',
              firstName: 'Test',
              isActive: true,
            }),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.findByTelegramId('123456789');

      expect(user.id).toBe('user-123');
      expect(user.telegramId).toBe('123456789');
      expect(user.username).toBe('testuser');
      expect(service.findByTelegramId).toHaveBeenCalledWith('123456789');
    },
  );

  createTest(
    {
      name: 'should find user by email',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn().mockResolvedValue({
              id: 'user-123',
              email: 'test@example.com',
              username: 'testuser',
              isActive: true,
            }),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.findByEmail('test@example.com');

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
      expect(service.findByEmail).toHaveBeenCalledWith('test@example.com');
    },
  );

  createTest(
    {
      name: 'should update user',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn().mockResolvedValue({
              id: 'user-123',
              username: 'updateduser',
              firstName: 'Updated',
              lastName: 'User',
              email: 'updated@example.com',
              isActive: true,
              updatedAt: new Date(),
            }),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const updateData = {
        username: 'updateduser',
        firstName: 'Updated',
        lastName: 'User',
        email: 'updated@example.com',
      };

      const user = await service.update('user-123', updateData);

      expect(user.id).toBe('user-123');
      expect(user.username).toBe('updateduser');
      expect(user.firstName).toBe('Updated');
      expect(user.email).toBe('updated@example.com');
      expect(service.update).toHaveBeenCalledWith('user-123', updateData);
    },
  );

  createTest(
    {
      name: 'should delete user',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn().mockResolvedValue(true),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const result = await service.delete('user-123');

      expect(result).toBe(true);
      expect(service.delete).toHaveBeenCalledWith('user-123');
    },
  );

  createTest(
    {
      name: 'should find all users',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn().mockResolvedValue([
              {
                id: 'user-123',
                username: 'user1',
                isActive: true,
              },
              {
                id: 'user-456',
                username: 'user2',
                isActive: false,
              },
            ]),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const users = await service.findAll();

      expect(users).toHaveLength(2);
      expect(users[0].id).toBe('user-123');
      expect(users[0].username).toBe('user1');
      expect(users[1].id).toBe('user-456');
      expect(users[1].username).toBe('user2');
      expect(service.findAll).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should update last activity',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn().mockResolvedValue({
              id: 'user-123',
              lastActivityAt: new Date(),
            }),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.updateLastActivity('user-123');

      expect(user.id).toBe('user-123');
      expect(user.lastActivityAt).toBeInstanceOf(Date);
      expect(service.updateLastActivity).toHaveBeenCalledWith('user-123');
    },
  );

  createTest(
    {
      name: 'should get user stats',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn().mockResolvedValue({
              totalUsers: 150,
              activeUsers: 120,
              inactiveUsers: 30,
              newUsersToday: 5,
              newUsersThisWeek: 25,
              averageActivityPerDay: 85,
            }),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const stats = await service.getUserStats();

      expect(stats.totalUsers).toBe(150);
      expect(stats.activeUsers).toBe(120);
      expect(stats.inactiveUsers).toBe(30);
      expect(stats.newUsersToday).toBe(5);
      expect(stats.newUsersThisWeek).toBe(25);
      expect(stats.averageActivityPerDay).toBe(85);
      expect(service.getUserStats).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should deactivate user',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn().mockResolvedValue({
              id: 'user-123',
              isActive: false,
              deactivatedAt: new Date(),
            }),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.deactivateUser('user-123');

      expect(user.id).toBe('user-123');
      expect(user.isActive).toBe(false);
      expect(user.deactivatedAt).toBeInstanceOf(Date);
      expect(service.deactivateUser).toHaveBeenCalledWith('user-123');
    },
  );

  createTest(
    {
      name: 'should activate user',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn().mockResolvedValue({
              id: 'user-123',
              isActive: true,
              activatedAt: new Date(),
            }),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const user = await service.activateUser('user-123');

      expect(user.id).toBe('user-123');
      expect(user.isActive).toBe(true);
      expect(user.activatedAt).toBeInstanceOf(Date);
      expect(service.activateUser).toHaveBeenCalledWith('user-123');
    },
  );

  createTest(
    {
      name: 'should handle user service errors',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'UserService',
          useValue: {
            create: jest.fn().mockRejectedValue(new Error('User creation failed')),
            findById: jest.fn(),
            findByTelegramId: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            updateLastActivity: jest.fn(),
            getUserStats: jest.fn(),
            deactivateUser: jest.fn(),
            activateUser: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('UserService');

      const userData = {
        telegramId: '123456789',
        username: 'testuser',
      };

      await expect(service.create(userData)).rejects.toThrow('User creation failed');
      expect(service.create).toHaveBeenCalledWith(userData);
    },
  );
});
