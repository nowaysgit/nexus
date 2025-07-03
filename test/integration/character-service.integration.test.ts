import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';

// Services
import { CharacterService } from '../../src/character/services/character.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { MotivationService } from '../../src/character/services/motivation.service';
import { ActionService } from '../../src/character/services/action.service';
import { MemoryService } from '../../src/character/services/memory.service';
import { MemoryType } from '../../src/character/interfaces/memory.interfaces';

// Tester utilities
import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { MockTypeOrmModule } from '../../lib/tester/mocks/mock-typeorm.module';

createTestSuite('Character Service Integration Tests', () => {
  createTest(
    {
      name: 'should create, find and update character',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [
        MockTypeOrmModule.forFeature([CharacterMotivation, Character, Need, CharacterMemory]),
      ],
      providers: [CharacterService, NeedsService, MotivationService, ActionService, MemoryService],
    },
    async context => {
      const characterService = context.get<CharacterService>(CharacterService);
      const characterRepository = context.get<Repository<Character>>(getRepositoryToken(Character));

      // Create character
      const character = await characterService.create({
        name: 'Иван',
        age: 30,
        biography: 'Программист из Москвы',
        appearance: 'Высокий брюнет в очках',
        personality: {
          traits: ['умный', 'спокойный'],
          hobbies: ['программирование', 'чтение'],
          fears: ['публичные выступления'],
          values: ['знания', 'честность'],
          musicTaste: ['рок', 'классика'],
          strengths: ['логическое мышление'],
          weaknesses: ['замкнутость'],
        },
        isActive: true,
      });

      expect(character).toBeDefined();
      expect(character.id).toBeDefined();
      expect(character.name).toBe('Иван');
      expect(character.personality.traits).toContain('умный');

      // Find character
      const foundCharacter = await characterService.findOne(character.id);
      expect(foundCharacter).toBeDefined();
      expect(foundCharacter.id).toBe(character.id);
      expect(foundCharacter.name).toBe('Иван');

      // Update character
      const updatedCharacter = await characterService.update(character.id, {
        name: 'Иван Петров',
        biography: 'Опытный программист из Москвы',
      });

      expect(updatedCharacter).toBeDefined();
      expect(updatedCharacter.name).toBe('Иван Петров');
      expect(updatedCharacter.biography).toBe('Опытный программист из Москвы');
      expect(updatedCharacter.personality.traits).toContain('умный');

      // Delete character
      await characterService.delete(character.id);
      const deletedCharacter = await characterRepository.findOne({ where: { id: character.id } });
      expect(deletedCharacter).toBeNull();
    },
  );

  createTest(
    {
      name: 'should initialize character with default needs',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [
        MockTypeOrmModule.forFeature([CharacterMotivation, Character, Need, CharacterMemory]),
      ],
      providers: [CharacterService, NeedsService, MotivationService, ActionService, MemoryService],
    },
    async context => {
      const characterService = context.get<CharacterService>(CharacterService);
      const needsService = context.get<NeedsService>(NeedsService);

      const character = await characterService.create({
        name: 'Мария',
        age: 28,
        biography: 'Учительница из Петербурга',
        personality: {
          traits: ['добрая', 'терпеливая'],
          hobbies: ['рисование', 'путешествия'],
          fears: ['одиночество'],
          values: ['семья', 'образование'],
          musicTaste: ['поп', 'джаз'],
          strengths: ['эмпатия'],
          weaknesses: ['излишняя доброта'],
        },
        isActive: true,
      });

      await needsService.createDefaultNeeds(character.id);
      const needs = await needsService.getNeedsByCharacter(character.id);

      expect(needs).toBeDefined();
      expect(needs.length).toBeGreaterThan(0);
      expect(needs.some(need => need.type === CharacterNeedType.COMMUNICATION)).toBe(true);
      expect(needs.some(need => need.type === CharacterNeedType.REST)).toBe(true);

      await characterService.delete(character.id);
    },
  );

  createTest(
    {
      name: 'should handle character memories',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [
        MockTypeOrmModule.forFeature([CharacterMotivation, Character, Need, CharacterMemory]),
      ],
      providers: [CharacterService, NeedsService, MotivationService, ActionService, MemoryService],
    },
    async context => {
      const characterService = context.get<CharacterService>(CharacterService);
      const memoryService = context.get<MemoryService>(MemoryService);

      const character = await characterService.create({
        name: 'Алексей',
        age: 35,
        biography: 'Бизнесмен из Казани',
        personality: {
          traits: ['целеустремленный', 'амбициозный'],
          hobbies: ['гольф', 'шахматы'],
          fears: ['неудача'],
          values: ['успех', 'богатство'],
          musicTaste: ['джаз', 'классика'],
          strengths: ['стратегическое мышление'],
          weaknesses: ['трудоголизм'],
        },
        isActive: true,
      });

      // Преобразуем character.id в число для MemoryService
      const characterIdAsNumber =
        typeof character.id === 'string' ? parseInt(character.id, 10) : character.id;

      const memory = await memoryService.createMemory(
        characterIdAsNumber,
        'Встреча с важным клиентом',
        MemoryType.EVENT,
        8,
        { tags: ['работа', 'клиент'], emotionalResponse: 'волнение' },
      );

      expect(memory).toBeDefined();
      expect(memory.characterId).toBe(characterIdAsNumber);
      expect(memory.content).toBe('Встреча с важным клиентом');

      const memories = await memoryService.getRecentMemories(characterIdAsNumber);
      expect(memories).toHaveLength(1);
      expect(memories[0].content).toBe('Встреча с важным клиентом');

      await characterService.delete(character.id);
    },
  );
});
