import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
import { Need } from '../../src/character/entities/need.entity';
import { Action } from '../../src/character/entities/action.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { StoryEvent } from '../../src/character/entities/story-event.entity';
import { StoryPlan, StoryMilestone } from '../../src/character/entities/story-plan.entity';

// Services
import { CharacterService } from '../../src/character/services/character.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { MotivationService } from '../../src/character/services/motivation.service';
import { ActionService } from '../../src/character/services/action.service';
import { MemoryService } from '../../src/character/services/memory.service';
import { MemoryType } from '../../src/character/interfaces/memory.interfaces';

// Tester utilities
import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';

createTestSuite('Character Service Integration Tests', () => {
  let moduleRef: TestingModule | null = null;
  let characterService: CharacterService;
  let needsService: NeedsService;
  let _motivationService: MotivationService;
  let _actionService: ActionService;
  let memoryService: MemoryService;
  let characterRepository: Repository<Character>;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forFeature([
          Character,
          Need,
          CharacterMotivation,
          Action,
          CharacterMemory,
          StoryEvent,
          StoryPlan,
          StoryMilestone,
        ]),
      ] as any[])
      .withProviders([
        CharacterService,
        NeedsService,
        MotivationService,
        ActionService,
        MemoryService,
      ])
      .withRequiredMocks()
      .compile();

    characterService = moduleRef.get<CharacterService>(CharacterService);
    needsService = moduleRef.get<NeedsService>(NeedsService);
    _motivationService = moduleRef.get<MotivationService>(MotivationService);
    _actionService = moduleRef.get<ActionService>(ActionService);
    memoryService = moduleRef.get<MemoryService>(MemoryService);
    characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should create, find and update character',
    },
    async () => {
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
    },
    async () => {
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
    },
    async () => {
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

      const memory = await memoryService.createMemory(
        character.id,
        'Встреча с важным клиентом',
        MemoryType.EVENT,
        8,
        { tags: ['работа', 'клиент'], emotionalResponse: 'волнение' },
      );

      expect(memory).toBeDefined();
      expect(memory.characterId).toBe(character.id);
      expect(memory.content).toBe('Встреча с важным клиентом');

      const memories = await memoryService.getRecentMemories(character.id);
      expect(memories).toHaveLength(1);
      expect(memories[0].content).toBe('Встреча с важным клиентом');

      await characterService.delete(character.id);
    },
  );
});
