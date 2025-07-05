import { Test, TestingModule } from '@nestjs/testing';
import { EmotionalStateService } from '../../src/character/services/core/emotional-state.service';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../src/character/entities/character.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Need, NeedState } from '../../src/character/entities/need.entity';
import { EmotionalState } from '../../src/character/entities/emotional-state';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { LogService } from '../../src/logging/log.service';
import { MockLogService, MockNeedsService } from '../../lib/tester/mocks';
import { NeedsService } from '../../src/character/services/core/needs.service';

// Фабрика для создания полных моков Need, адаптированная из needs.service.test.ts
const createMockNeed = (override: Partial<Need> = {}): Need => {
  const need = new Need();
  need.id = Math.floor(Math.random() * 1000);
  need.characterId = 1;
  need.type = CharacterNeedType.AFFECTION;
  need.currentValue = 50;
  need.maxValue = 100;
  need.growthRate = 1;
  need.decayRate = 1;
  need.priority = 5;
  need.threshold = 80;
  need.lastUpdated = new Date();
  need.isActive = true;
  need.createdAt = new Date();
  need.individualAccumulationRate = 1.0;
  need.dynamicPriority = 1.0;
  need.frustrationLevel = 0; // Важно для тестов
  need.blockedUntil = null;
  need.blockReason = null;
  need.relatedNeeds = null;
  need.influenceCoefficients = null;
  need.state = NeedState.SATISFIED;
  need.lastFrustrationTime = null;
  need.consecutiveBlocksCount = 0;

  // Mock methods
  need.hasReachedThreshold = jest.fn().mockReturnValue(false);
  need.isBlocked = jest.fn().mockReturnValue(false);
  need.isCritical = jest.fn().mockReturnValue(false);
  need.grow = jest.fn();
  need.reset = jest.fn();
  need.updateLevel = jest.fn();
  need.blockFor = jest.fn();
  need.unblock = jest.fn();
  need.increaseFrustration = jest.fn();
  need.decreaseFrustration = jest.fn();
  need.getRelatedNeeds = jest.fn().mockReturnValue([]);
  need.setRelatedNeeds = jest.fn();
  need.getInfluenceCoefficients = jest.fn().mockReturnValue({});
  need.setInfluenceCoefficients = jest.fn();
  need.calculateInfluenceOnRelated = jest.fn().mockReturnValue({});

  return Object.assign(need, override);
};

const mockCharacter: Partial<Character> = {
  id: 1,
  name: 'Test Character',
  archetype: CharacterArchetype.SAGE,
  gender: CharacterGender.MALE,
  userId: 'test-user-id',
  needs: [],
  motivations: [],
  relationshipStage: RelationshipStage.ACQUAINTANCE,
  age: 25,
  biography: 'A test character.',
  appearance: 'A test appearance.',
  personality: {
    traits: [],
    hobbies: [],
    fears: [],
    values: [],
    musicTaste: [],
    strengths: [],
    weaknesses: [],
  },
};

describe('EmotionalStateService', () => {
  let service: EmotionalStateService;
  let mockCharacterRepository: {
    findOne: jest.Mock;
  };
  let module: TestingModule;

  beforeEach(async () => {
    mockCharacterRepository = {
      findOne: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        EmotionalStateService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: NeedsService,
          useClass: MockNeedsService,
        },
      ],
    }).compile();

    service = module.get<EmotionalStateService>(EmotionalStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Очистка состояний после каждого теста
    const states = service['emotionalStates'];
    if (states) states.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEmotionalState', () => {
    it('should create default state for new character', async () => {
      const characterId = 2;
      mockCharacterRepository.findOne.mockResolvedValue({
        ...mockCharacter,
        id: characterId,
      } as Character);

      const result = await service.getEmotionalState(characterId);

      expect(result.primary).toBe('нейтральная');
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: characterId },
      });
      expect(service['emotionalStates'].get(characterId)).toBeDefined();
    });

    it('should throw an error if character is not found', async () => {
      const characterId = 999;
      mockCharacterRepository.findOne.mockResolvedValue(null);

      await expect(service.getEmotionalState(characterId)).rejects.toThrow(
        `Character with id ${characterId} not found`,
      );
    });

    it('should return cached state if available', async () => {
      const characterId = 1;
      const cachedState: EmotionalState = {
        primary: 'радостная',
        intensity: 7,
        secondary: 'возбужденная',
        description: '',
      };
      service['emotionalStates'].set(characterId, cachedState);

      const result = await service.getEmotionalState(characterId);

      expect(result).toEqual(cachedState);
      expect(mockCharacterRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateEmotionalStateFromNeeds', () => {
    it('should update emotional state based on high frustration needs', async () => {
      const characterId = 1;
      // Используем фабрику для создания полных моков Need
      const needs = [
        createMockNeed({
          type: CharacterNeedType.COMMUNICATION,
          frustrationLevel: 90, // Высокая фрустрация
        }),
        createMockNeed({
          type: CharacterNeedType.ATTENTION,
          frustrationLevel: 80, // Высокая фрустрация
        }),
      ];
      mockCharacterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      // Инициализируем состояние перед обновлением
      await service.getEmotionalState(characterId);

      await service.updateEmotionalStateFromNeeds(characterId, needs);

      const newState = service['emotionalStates'].get(characterId);
      expect(newState).toBeDefined();
      expect(newState.primary).toBe('общительная');
      expect(newState.intensity).toBeGreaterThan(5);
    });
  });
});
