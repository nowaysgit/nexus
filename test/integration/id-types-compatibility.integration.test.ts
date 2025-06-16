import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
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
import { ActionType } from '../../src/character/enums/action-type.enum';

// Tester utilities
import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';

// Тесты для проверки совместимости различных типов ID в системе
createTestSuite('ID Types Compatibility Tests', () => {
  let moduleRef: TestingModule | null = null;
  let characterService: CharacterService;
  let needsService: NeedsService;
  let motivationService: MotivationService;
  let actionService: ActionService;
  let memoryService: MemoryService;
  let _characterRepository: Repository<Character>;

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
    motivationService = moduleRef.get<MotivationService>(MotivationService);
    actionService = moduleRef.get<ActionService>(ActionService);
    memoryService = moduleRef.get<MemoryService>(MemoryService);
    _characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should handle numeric and string IDs correctly',
      requiresDatabase: true,
    },
    async () => {
      // Создаем персонажа с числовым ID
      const character = await characterService.create({
        name: 'Тестовый персонаж',
        age: 30,
        biography: 'Биография для теста ID',
        personality: {
          traits: ['тестовый'],
          hobbies: ['тестирование'],
          fears: ['ошибки'],
          values: ['точность'],
          musicTaste: ['тишина'],
          strengths: ['внимательность'],
          weaknesses: ['педантичность'],
        },
        isActive: true,
      });

      // Проверяем, что ID числовой
      expect(character.id).toBeDefined();
      expect(typeof character.id).toBe('number');

      // Создаем потребности для персонажа
      await needsService.createDefaultNeeds(character.id);
      const needs = await needsService.getNeedsByCharacter(character.id);

      // Проверяем, что ID потребностей числовые и связь с персонажем корректная
      expect(needs.length).toBeGreaterThan(0);
      needs.forEach(need => {
        expect(typeof need.id).toBe('number');
        expect(need.characterId).toBe(character.id);
      });

      // Создаем мотивацию с числовым ID персонажа
      const motivation = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Тестовая мотивация',
        75,
        {
          thresholdValue: 70,
          accumulationRate: 1.0,
          resourceCost: 15,
          successProbability: 80,
        },
      );

      // Проверяем, что ID мотивации числовой и связь с персонажем корректная
      expect(typeof motivation.id).toBe('number');
      expect(motivation.characterId).toBe(character.id);

      // Проверяем преобразование строкового ID в числовой
      const stringId = String(character.id);
      const foundCharacter = await characterService.findOne(Number(stringId));

      // Проверяем, что персонаж найден по преобразованному ID
      expect(foundCharacter).toBeDefined();
      expect(foundCharacter.id).toBe(character.id);

      // Очистка
      await characterService.delete(character.id);
    },
  );

  createTest(
    {
      name: 'should handle ID conversion between services',
      requiresDatabase: true,
    },
    async () => {
      // Создаем персонажа
      const character = await characterService.create({
        name: 'Персонаж для теста конверсии ID',
        age: 25,
        biography: 'Тестирование преобразования ID между сервисами',
        personality: {
          traits: ['тестовый'],
          hobbies: ['проверка совместимости'],
          fears: ['несовместимость'],
          values: ['интеграция'],
          musicTaste: ['системные звуки'],
          strengths: ['адаптивность'],
          weaknesses: ['зависимость от типов'],
        },
        isActive: true,
      });

      // Создаем действие для персонажа
      const action = await actionService.createActionWithResources(
        character.id, // Используем числовой ID
        ActionType.SEND_MESSAGE,
        {
          resourceCost: 10,
          successProbability: 90,
          potentialReward: { test: 100 },
          description: 'Тестовое действие для проверки ID',
        },
      );

      // Проверяем, что действие создано
      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.SEND_MESSAGE);

      // Создаем воспоминание, используя разные форматы ID
      const stringId = String(character.id);
      const numericId = Number(stringId);

      const memory = await memoryService.createMemory(
        numericId,
        'Тестовое воспоминание для проверки совместимости ID',
        MemoryType.EVENT,
        5,
        { test: true },
      );

      // Проверяем, что воспоминание создано с правильным ID персонажа
      expect(memory.characterId).toBe(character.id);

      // Очистка
      await characterService.delete(numericId);
    },
  );
});
