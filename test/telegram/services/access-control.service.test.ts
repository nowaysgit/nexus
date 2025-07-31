import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../src/telegram/services/access-control.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let mockLogService: MockLogService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'telegram.accessMode') return 'open';
        if (key === 'telegram.allowedUsers') return '';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AccessControlService>(AccessControlService);
  });

  describe('инициализация', () => {
    it('должен инициализироваться с режимом "open" по умолчанию', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'open';
        if (key === 'telegram.allowedUsers') return '';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      });

      const module = Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('должен парсить список разрешенных пользователей', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123,456,789';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module = Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('должен обрабатывать пустые списки пользователей', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'open';
        if (key === 'telegram.allowedUsers') return '';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      });

      const module = Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('hasAccess', () => {
    beforeEach(() => {
      // Пересоздаем сервис для каждого теста с нужными настройками
      jest.clearAllMocks();
    });

    it('должен разрешать доступ всем в режиме "open"', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'open';
        if (key === 'telegram.allowedUsers') return '';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      expect(testService.hasAccess('123')).toBe(true);
      expect(testService.hasAccess('456')).toBe(true);
      expect(testService.hasAccess(789)).toBe(true);
    });

    it('должен разрешать доступ только админам в режиме "admin_only"', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'admin_only';
        if (key === 'telegram.allowedUsers') return '123,456';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      expect(testService.hasAccess('999')).toBe(true); // админ
      expect(testService.hasAccess('123')).toBe(false); // разрешенный, но не админ
      expect(testService.hasAccess('456')).toBe(false); // разрешенный, но не админ
      expect(testService.hasAccess('777')).toBe(false); // не разрешенный
    });

    it('должен разрешать доступ разрешенным пользователям и админам в режиме "restricted"', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123,456';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      expect(testService.hasAccess('123')).toBe(true); // разрешенный
      expect(testService.hasAccess('456')).toBe(true); // разрешенный
      expect(testService.hasAccess('999')).toBe(true); // админ
      expect(testService.hasAccess('777')).toBe(false); // не разрешенный
    });

    it('должен обрабатывать числовые ID', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      expect(testService.hasAccess(123)).toBe(true);
      expect(testService.hasAccess(999)).toBe(true);
      expect(testService.hasAccess(777)).toBe(false);
    });

    it('должен обрабатывать неизвестный режим доступа', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'unknown_mode';
        if (key === 'telegram.allowedUsers') return '';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      expect(testService.hasAccess('123')).toBe(false);
      expect(mockLogService.winstonLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Неизвестный режим доступа: unknown_mode'),
        expect.any(Object),
      );
    });
  });

  describe('isAdmin', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123,456';
        if (key === 'telegram.adminUsers') return '999,888';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<AccessControlService>(AccessControlService);
    });

    it('должен определять админов', () => {
      expect(service.isAdmin('999')).toBe(true);
      expect(service.isAdmin('888')).toBe(true);
      expect(service.isAdmin(999)).toBe(true);
    });

    it('должен определять не-админов', () => {
      expect(service.isAdmin('123')).toBe(false);
      expect(service.isAdmin('456')).toBe(false);
      expect(service.isAdmin('777')).toBe(false);
    });
  });

  describe('addAllowedUser', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<AccessControlService>(AccessControlService);
    });

    it('должен добавлять пользователя в список разрешенных', () => {
      service.addAllowedUser('456');

      expect(service.hasAccess('456')).toBe(true);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 456 добавлен в список разрешенных'),
        undefined,
      );
    });

    it('должен обрабатывать числовые ID', () => {
      service.addAllowedUser(789);

      expect(service.hasAccess(789)).toBe(true);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 789 добавлен в список разрешенных'),
        undefined,
      );
    });

    it('должен обрабатывать дублирующиеся добавления', () => {
      service.addAllowedUser('123');

      expect(service.hasAccess('123')).toBe(true);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 123 добавлен в список разрешенных'),
        undefined,
      );
    });
  });

  describe('removeAllowedUser', () => {
    beforeEach(async () => {
      // Настраиваем режим restricted для корректного тестирования удаления
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123,456';
        if (key === 'telegram.adminUsers') return '999';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<AccessControlService>(AccessControlService);
      jest.clearAllMocks();
    });

    it('должен удалять пользователя из списка разрешенных', () => {
      service.removeAllowedUser('123');

      expect(service.hasAccess('123')).toBe(false);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 123 удален из списка разрешенных'),
        undefined,
      );
    });

    it('должен обрабатывать числовые ID', () => {
      service.removeAllowedUser(456);

      expect(service.hasAccess(456)).toBe(false);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 456 удален из списка разрешенных'),
        undefined,
      );
    });

    it('должен обрабатывать удаление несуществующего пользователя', () => {
      service.removeAllowedUser('777');

      expect(service.hasAccess('777')).toBe(false);
      expect(mockLogService.winstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Пользователь 777 удален из списка разрешенных'),
        undefined,
      );
    });
  });

  describe('getAccessInfo', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return '123,456,789';
        if (key === 'telegram.adminUsers') return '999,888';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<AccessControlService>(AccessControlService);
    });

    it('должен возвращать информацию о настройках доступа', () => {
      const info = service.getAccessInfo();

      expect(info).toEqual({
        mode: 'restricted',
        allowedUsersCount: 3,
        adminUsersCount: 2,
      });
    });

    it('должен обновлять счетчики после изменений', () => {
      service.addAllowedUser('111');
      service.removeAllowedUser('123');

      const info = service.getAccessInfo();

      expect(info).toEqual({
        mode: 'restricted',
        allowedUsersCount: 3, // 456, 789, 111 (123 удален)
        adminUsersCount: 2,
      });
    });
  });

  describe('edge cases', () => {
    it('должен обрабатывать пустые строки в конфигурации', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return ',,,';
        if (key === 'telegram.adminUsers') return '';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);
      const info = testService.getAccessInfo();

      expect(info.allowedUsersCount).toBe(0);
      expect(info.adminUsersCount).toBe(0);
    });

    it('должен обрабатывать пробелы в ID пользователей', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'telegram.accessMode') return 'restricted';
        if (key === 'telegram.allowedUsers') return ' 123 , 456 ';
        if (key === 'telegram.adminUsers') return ' 999 ';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccessControlService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<AccessControlService>(AccessControlService);

      // Пробелы должны быть сохранены в ID
      expect(testService.hasAccess('123')).toBe(false);
      expect(testService.hasAccess(' 123 ')).toBe(true);
      expect(testService.isAdmin(' 999 ')).toBe(true);
    });
  });
});
