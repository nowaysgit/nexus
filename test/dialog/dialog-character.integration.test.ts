/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Тест с моками */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

describe('Dialog-Character Integration', () => {
  let dialogService: DialogService;
  let dialogRepository: any;
  let characterRepository: any;

  const mockCharacter: Character = {
    id: 1,
    name: 'Тест',
    fullName: 'Тест Персонаж',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Тестовый персонаж',
    appearance: 'Обычная внешность',
    personality: {
      traits: ['friendly'],
      hobbies: ['reading'],
      fears: ['loneliness'],
      values: ['friendship'],
      musicTaste: ['pop'],
      strengths: ['communication'],
      weaknesses: ['sensitive'],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    energy: 80,
  } as Character;

  beforeEach(async () => {
    const dialogRepositoryMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const characterRepositoryMock = {
      findOne: jest.fn().mockResolvedValue(mockCharacter),
    };

    const cacheServiceMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DialogService,
        {
          provide: getRepositoryToken(Dialog),
          useValue: dialogRepositoryMock,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Character),
          useValue: characterRepositoryMock,
        },
        {
          provide: CacheService,
          useValue: cacheServiceMock,
        },
        {
          provide: LogService,
          useValue: new MockLogService(),
        },
        {
          provide: 'UserService',
          useValue: {
            getUserIdByTelegramId: jest.fn().mockResolvedValue(123),
          },
        },
      ],
    }).compile();

    dialogService = module.get<DialogService>(DialogService);
    dialogRepository = module.get(getRepositoryToken(Dialog));
    characterRepository = module.get(getRepositoryToken(Character));
  });

  it('должен быть определен', () => {
    expect(dialogService).toBeDefined();
  });

  it('должен создать диалог', async () => {
    const telegramId = '123456';
    const characterId = 1;

    // Мокируем что диалог не найден
    dialogRepository.findOne.mockResolvedValue(null);

    // Мокируем создание диалога
    const mockDialog = {
      id: 1,
      telegramId,
      characterId,
      character: mockCharacter,
      userId: '123',
      isActive: true,
      lastInteractionDate: new Date(),
    } as Dialog;

    dialogRepository.create.mockReturnValue(mockDialog);
    dialogRepository.save.mockResolvedValue(mockDialog);

    // Используем настоящий сервис с мок репозиториями
    const result = await dialogService.getOrCreateDialog(telegramId, characterId);

    // Проверки
    expect(result).toBeDefined();
    expect(result.telegramId).toBe(telegramId);
    expect(result.characterId).toBe(characterId);
    expect(result.character).toBe(mockCharacter);

    // Проверяем вызовы
    expect(characterRepository.findOne).toHaveBeenCalledWith({ where: { id: characterId } });
    expect(dialogRepository.create).toHaveBeenCalled();
    expect(dialogRepository.save).toHaveBeenCalledWith(mockDialog);
  });
});
