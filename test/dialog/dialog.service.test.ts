import { createTestSuite, createTest } from '../../lib/tester';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character } from '../../src/character/entities/character.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CacheService } from '../../src/cache/cache.service';
import { UserService } from '../../src/user/services/user.service';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { mockUserService } from '../../lib/tester/mocks/user-service.mock';

// Мок для CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(true),
};

createTestSuite('DialogService Tests', () => {
  let service: DialogService;
  let dialogRepository: Repository<Dialog>;
  let messageRepository: Repository<Message>;
  let characterRepository: Repository<Character>;

  beforeAll(async () => {
    const moduleRef = await TestModuleBuilder.create()
      .withProviders([
        DialogService,
        { provide: getRepositoryToken(Dialog), useClass: Repository },
        { provide: getRepositoryToken(Message), useClass: Repository },
        { provide: getRepositoryToken(Character), useClass: Repository },
        { provide: 'UserService', useValue: mockUserService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: 'LogService', useClass: MockLogService },
      ])
      .compile();

    service = moduleRef.get<DialogService>(DialogService);
    dialogRepository = moduleRef.get<Repository<Dialog>>(getRepositoryToken(Dialog));
    messageRepository = moduleRef.get<Repository<Message>>(getRepositoryToken(Message));
    characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));

    // Устанавливаем process.env.NODE_ENV для тестового режима
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  createTest(
    {
      name: 'должен быть определен',
    },
    async () => {
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен создавать диалог с правильными параметрами',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 1,
        isActive: true,
        lastInteractionDate: new Date(),
      };

      const mockCharacter = {
        id: 1,
        name: 'Test Character',
      };

      jest.spyOn(characterRepository, 'findOne').mockResolvedValue(mockCharacter as Character);
      jest.spyOn(dialogRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(dialogRepository, 'create').mockReturnValue(mockDialog as Dialog);
      jest.spyOn(dialogRepository, 'save').mockResolvedValue(mockDialog as Dialog);

      const result = await service.getOrCreateDialog('123456789', 1);

      expect(result).toEqual(mockDialog);
      expect(dialogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramId: '123456789',
          characterId: 1,
          isActive: true,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен возвращать существующий диалог, если он уже существует',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 1,
        isActive: true,
      };

      jest.spyOn(dialogRepository, 'findOne').mockResolvedValue(mockDialog as Dialog);
      jest.spyOn(dialogRepository, 'create').mockClear();
      jest.spyOn(dialogRepository, 'save').mockClear();

      const result = await service.getOrCreateDialog('123456789', 1);

      expect(result).toEqual(mockDialog);
      expect(dialogRepository.create).not.toHaveBeenCalled();
      expect(dialogRepository.save).not.toHaveBeenCalled();
    },
  );
});
