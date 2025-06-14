import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character } from '../../src/character/entities/character.entity';
import { User } from '../../src/user/entities/user.entity';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import { UserService } from '../../src/user/services/user.service';
import { MockLogService } from '../../lib/tester/mocks';

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  del: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  keys: jest.fn(),
  getStats: jest.fn(),
  getInfo: jest.fn(),
};

createTestSuite('DialogService Tests', () => {
  let service: DialogService;
  let moduleRef: TestingModule;
  let dialogRepository: Repository<Dialog>;
  let messageRepository: Repository<Message>;
  let characterRepository: Repository<Character>;
  let userService: UserService;

  beforeAll(async () => {
    const mockUserService = { findById: jest.fn().mockResolvedValue({ id: 1, telegramId: '123' }) };

    moduleRef = await Test.createTestingModule({
      providers: [
        DialogService,
        { provide: getRepositoryToken(Dialog), useClass: Repository },
        { provide: getRepositoryToken(Message), useClass: Repository },
        { provide: getRepositoryToken(Character), useClass: Repository },
        { provide: UserService, useValue: mockUserService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: LogService, useClass: MockLogService },
      ],
    }).compile();

    service = moduleRef.get<DialogService>(DialogService);
    dialogRepository = moduleRef.get<Repository<Dialog>>(getRepositoryToken(Dialog));
    messageRepository = moduleRef.get<Repository<Message>>(getRepositoryToken(Message));
    characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
    userService = moduleRef.get<UserService>(UserService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  createTest(
    { name: 'should get or create a dialog', configType: TestConfigType.BASIC },
    async () => {
      jest.spyOn(dialogRepository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(characterRepository, 'findOne').mockResolvedValueOnce({ id: 1 } as Character);
      jest
        .spyOn(dialogRepository, 'save')
        .mockResolvedValueOnce({ id: 1, telegramId: '123', characterId: 1 } as Dialog);

      const result = await service.getOrCreateDialog('123', 1);
      expect(result).toBeDefined();
      expect(result.characterId).toBe(1);
      expect(dialogRepository.save).toHaveBeenCalledWith({
        telegramId: '123',
        characterId: 1,
        isActive: true,
        isArchived: false,
      });
    },
  );
});
