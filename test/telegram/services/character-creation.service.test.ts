import { Test, TestingModule } from '@nestjs/testing';
import { CharacterCreationService } from '../../../src/telegram/services/character-creation.service';
import { CharacterManagementService } from '../../../src/character/services/core/character-management.service';
import { LogService } from '../../../src/logging/log.service';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

describe('CharacterCreationService', () => {
  let service: CharacterCreationService;
  let mockLogService: MockLogService;
  let mockCharacterManagementService: jest.Mocked<CharacterManagementService>;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly'],
      hobbies: ['reading'],
      fears: [],
      values: ['kindness'],
      musicTaste: [],
      strengths: ['empathy'],
      weaknesses: [],
    },
    age: 25,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    // Добавляем jest mock функции для тестирования
    (mockLogService as any).error = jest.fn();
    (mockLogService as any).log = jest.fn();

    mockCharacterManagementService = {
      createCharacter: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterCreationService,
        { provide: LogService, useValue: mockLogService },
        { provide: CharacterManagementService, useValue: mockCharacterManagementService },
      ],
    }).compile();

    service = module.get<CharacterCreationService>(CharacterCreationService);
  });

  describe('createCharacterWithArchetype', () => {
    it('должен создать персонажа с архетипом CAREGIVER', async () => {
      const userId = 123;
      const archetype = 'caregiver';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.CAREGIVER,
        name: 'Нежная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.CAREGIVER);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Нежная',
          archetype: CharacterArchetype.CAREGIVER,
          biography: expect.stringContaining('Добрая и мягкая личность'),
          age: 25,
          appearance: 'Привлекательная внешность, подходящая под архетип',
          // Проверяем только базовые поля, так как базовые настройки перезаписывают специфичные
          personality: expect.objectContaining({
            traits: ['дружелюбный', 'отзывчивый'],
            hobbies: ['общение'],
            values: ['дружба'],
            strengths: ['эмпатия'],
          }),
        }),
        userId,
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Персонаж Нежная (CAREGIVER) создан для пользователя 123'),
      );
    });

    it('должен создать персонажа с архетипом FEMME_FATALE', async () => {
      const userId = 456;
      const archetype = 'femme_fatale';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.FEMME_FATALE,
        name: 'Роковая женщина',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.FEMME_FATALE);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Роковая женщина',
          archetype: CharacterArchetype.FEMME_FATALE,
          biography: expect.stringContaining('Загадочная и соблазнительная личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом INTELLECTUAL', async () => {
      const userId = 789;
      const archetype = 'intellectual';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.INTELLECTUAL,
        name: 'Интеллектуал',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.INTELLECTUAL);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Интеллектуал',
          archetype: CharacterArchetype.INTELLECTUAL,
          biography: expect.stringContaining('Умная и образованная личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом EXPLORER', async () => {
      const userId = 101;
      const archetype = 'explorer';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.EXPLORER,
        name: 'Авантюрист',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.EXPLORER);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Авантюрист',
          archetype: CharacterArchetype.EXPLORER,
          biography: expect.stringContaining('Смелая и энергичная личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом SEDUCTRESS', async () => {
      const userId = 202;
      const archetype = 'seductress';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.SEDUCTRESS,
        name: 'Загадочная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.SEDUCTRESS);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Загадочная',
          archetype: CharacterArchetype.SEDUCTRESS,
          biography: expect.stringContaining('Таинственная личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом REBEL', async () => {
      const userId = 303;
      const archetype = 'rebel';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.REBEL,
        name: 'Бунтарка',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.REBEL);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Бунтарка',
          archetype: CharacterArchetype.REBEL,
          biography: expect.stringContaining('Независимая личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом LOVER', async () => {
      const userId = 404;
      const archetype = 'lover';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.LOVER,
        name: 'Романтичная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.LOVER);
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Романтичная',
          archetype: CharacterArchetype.LOVER,
          biography: expect.stringContaining('Мечтательная личность'),
        }),
        userId,
      );
    });

    it('должен создать персонажа с архетипом COMPANION', async () => {
      const userId = 505;
      const archetype = 'companion';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.COMPANION,
        name: 'Спутник',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.COMPANION);
    });

    it('должен обрабатывать архетип в разном регистре', async () => {
      const userId = 606;
      const archetype = 'CAREGIVER';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.CAREGIVER,
        name: 'Нежная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(result.archetype).toBe(CharacterArchetype.CAREGIVER);
    });

    it('должен выбрасывать ошибку для неизвестного архетипа', async () => {
      const userId = 707;
      const archetype = 'unknown_archetype';

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toThrow(
        'Неизвестный архетип: unknown_archetype',
      );

      expect(mockCharacterManagementService.createCharacter).not.toHaveBeenCalled();
      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка создания персонажа с архетипом',
        expect.objectContaining({
          archetype: 'unknown_archetype',
          userId: 707,
          error: 'Неизвестный архетип: unknown_archetype',
        }),
      );
    });

    it('должен обрабатывать ошибки от CharacterManagementService', async () => {
      const userId = 808;
      const archetype = 'caregiver';
      const error = new Error('Ошибка создания персонажа');

      mockCharacterManagementService.createCharacter.mockRejectedValue(error);

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toThrow(
        'Ошибка создания персонажа',
      );

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка создания персонажа с архетипом',
        expect.objectContaining({
          archetype: 'caregiver',
          userId: 808,
          error: 'Ошибка создания персонажа',
        }),
      );
    });

    it('должен обрабатывать нестандартные ошибки', async () => {
      const userId = 909;
      const archetype = 'caregiver';
      const error = 'Строковая ошибка';

      mockCharacterManagementService.createCharacter.mockRejectedValue(error);

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toBe(error);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка создания персонажа с архетипом',
        expect.objectContaining({
          archetype: 'caregiver',
          userId: 909,
          error: 'Строковая ошибка',
        }),
      );
    });
  });

  describe('getAvailableArchetypes', () => {
    it('должен возвращать список доступных архетипов', () => {
      const archetypes = service.getAvailableArchetypes();

      expect(archetypes).toBeDefined();
      expect(Array.isArray(archetypes)).toBe(true);
      expect(archetypes.length).toBeGreaterThan(0);

      // Проверяем структуру каждого элемента
      archetypes.forEach(item => {
        expect(item).toHaveProperty('archetype');
        expect(item).toHaveProperty('description');
        expect(typeof item.archetype).toBe('string');
        expect(typeof item.description).toBe('string');
      });
    });

    it('должен включать все основные архетипы', () => {
      const archetypes = service.getAvailableArchetypes();
      const archetypeNames = archetypes.map(item => item.archetype);

      expect(archetypeNames).toContain(CharacterArchetype.CAREGIVER);
      expect(archetypeNames).toContain(CharacterArchetype.FEMME_FATALE);
      expect(archetypeNames).toContain(CharacterArchetype.INTELLECTUAL);
      expect(archetypeNames).toContain(CharacterArchetype.EXPLORER);
      expect(archetypeNames).toContain(CharacterArchetype.SEDUCTRESS);
      expect(archetypeNames).toContain(CharacterArchetype.REBEL);
      expect(archetypeNames).toContain(CharacterArchetype.LOVER);
      // COMPANION не включен в список getAvailableArchetypes
    });

    it('должен возвращать описания для каждого архетипа', () => {
      const archetypes = service.getAvailableArchetypes();

      archetypes.forEach(item => {
        expect(item.description).toBeTruthy();
        expect(item.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('должен обрабатывать пустую строку как архетип', async () => {
      const userId = 111;
      const archetype = '';

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toThrow(
        'Неизвестный архетип: ',
      );
    });

    it('должен обрабатывать null как архетип', async () => {
      const userId = 222;
      const archetype = null as any;

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toThrow();
    });

    it('должен обрабатывать undefined как архетип', async () => {
      const userId = 333;
      const archetype = undefined as any;

      await expect(service.createCharacterWithArchetype(archetype, userId)).rejects.toThrow();
    });

    it('должен обрабатывать отрицательный userId', async () => {
      const userId = -1;
      const archetype = 'caregiver';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.CAREGIVER,
        name: 'Нежная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.any(Object),
        -1,
      );
    });

    it('должен обрабатывать нулевой userId', async () => {
      const userId = 0;
      const archetype = 'caregiver';

      mockCharacterManagementService.createCharacter.mockResolvedValue({
        ...mockCharacter,
        archetype: CharacterArchetype.CAREGIVER,
        name: 'Нежная',
      });

      const result = await service.createCharacterWithArchetype(archetype, userId);

      expect(result).toBeDefined();
      expect(mockCharacterManagementService.createCharacter).toHaveBeenCalledWith(
        expect.any(Object),
        0,
      );
    });
  });
});
