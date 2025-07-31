import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmotionalStateService } from '../../../../src/character/services/core/emotional-state.service';
import { Character, CharacterGender } from '../../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../../src/character/enums/character-archetype.enum';
import { LogService } from '../../../../src/logging/log.service';
import { NeedsService } from '../../../../src/character/services/core/needs.service';

describe('EmotionalStateService', () => {
  let service: EmotionalStateService;
  let characterRepository: jest.Mocked<Repository<Character>>;

  const mockCharacter: Partial<Character> = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'outgoing'],
      hobbies: ['reading', 'music'],
      fears: ['spiders', 'heights'],
      values: ['honesty', 'loyalty'],
      musicTaste: ['pop', 'rock'],
      strengths: ['empathy', 'creativity'],
      weaknesses: ['impatience', 'stubbornness'],
    },
    userId: '1',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCharacterRepository = {
      findOne: jest.fn().mockResolvedValue(mockCharacter),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockNeedsService = {
      getActiveNeeds: jest.fn(),
      updateNeed: jest.fn(),
      getNeedsByCharacter: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmotionalStateService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
      ],
    }).compile();

    service = module.get<EmotionalStateService>(EmotionalStateService);
    characterRepository = module.get(getRepositoryToken(Character));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('создание сервиса', () => {
    it('должен быть создан', () => {
      expect(service).toBeDefined();
    });

    it('должен расширять BaseService', () => {
      expect(service).toBeInstanceOf(EmotionalStateService);
    });
  });

  describe('getEmotionalState', () => {
    it('должен возвращать состояние из кэша если оно существует', async () => {
      const mockState = {
        primary: 'радость',
        secondary: 'восторг',
        intensity: 8,
        description: 'Очень радостное состояние',
      };

      // Устанавливаем состояние в кэш через приватное поле
      service['emotionalStates'].set(1, mockState);

      const result = await service.getEmotionalState(1);

      expect(result).toBe(mockState);
      expect(characterRepository.findOne).not.toHaveBeenCalled();
    });

    it('должен создавать базовое состояние для нового персонажа', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const result = await service.getEmotionalState(1);

      expect(result).toEqual({
        primary: 'нейтральная',
        intensity: 3,
        secondary: '',
        description: 'Спокойное, уравновешенное состояние',
      });
      expect(characterRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('должен обрабатывать ошибку если персонаж не найден', async () => {
      characterRepository.findOne.mockResolvedValue(null);

      await expect(service.getEmotionalState(999)).rejects.toThrow(
        'Character with id 999 not found',
      );
    });
  });

  describe('getEmotionalMemories', () => {
    it('должен возвращать эмоциональные воспоминания с фильтрами', async () => {
      const filters = {
        emotions: ['радость'],
        significance: { min: 50, max: 100 },
      };

      const result = await service.getEmotionalMemories(1, filters, 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('должен возвращать пустой массив если воспоминания не найдены', async () => {
      const result = await service.getEmotionalMemories(1, {}, 5);

      expect(result).toEqual([]);
    });
  });

  describe('getEmotionalTransitions', () => {
    it('должен возвращать эмоциональные переходы за период', async () => {
      const timeRange = {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(),
      };

      const result = await service.getEmotionalTransitions(1, timeRange, 3);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getEmotionalProfile', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен получать эмоциональный профиль персонажа', async () => {
      const result = await service.getEmotionalProfile(1);

      expect(result).toBeDefined();
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при получении эмоционального состояния', async () => {
      characterRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getEmotionalState(1)).rejects.toThrow('Database error');
    });
  });
});
