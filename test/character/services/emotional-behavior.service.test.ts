import { createTest, createTestSuite, TestConfigType } from '../../../lib/tester';
import {
  EmotionalBehaviorService,
  FrustrationLevel,
} from '../../../src/character/services/emotional-behavior.service';
import { EmotionalStateService } from '../../../src/character/services/emotional-state.service';
import { NeedsService } from '../../../src/character/services/needs.service';
import { MemoryService } from '../../../src/character/services/memory.service';
import { ActionService } from '../../../src/character/services/action.service';
import { ActionExecutorService } from '../../../src/character/services/action-executor.service';
import { LogService } from '../../../src/logging/log.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Создаем моки для всех зависимостей
const createEmotionalStateServiceMock = () => ({
  getEmotionalState: jest.fn(),
  updateEmotionalState: jest.fn(),
  createEmotionalState: jest.fn(),
});

const createNeedsServiceMock = () => ({
  getUnfulfilledNeeds: jest.fn().mockResolvedValue([]),
  updateNeed: jest.fn(),
  getNeedsByType: jest.fn(),
});

const createMemoryServiceMock = () => ({
  getRecentMemoriesByType: jest.fn().mockResolvedValue([]),
  getRecentMemories: jest.fn().mockResolvedValue([]),
  createMemory: jest.fn(),
  getMemories: jest.fn(),
});

const createActionServiceMock = () => ({
  getRecentFailures: jest.fn().mockResolvedValue(0),
  executeAction: jest.fn(),
  getActionHistory: jest.fn(),
});

const createLogServiceMock = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
});

const createEventEmitterMock = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
});

// Мок репозитория персонажей
const createCharacterRepositoryMock = () => ({
  findOne: jest.fn().mockResolvedValue({
    id: 1,
    name: 'Test Character',
    userId: 1,
  }),
  find: jest.fn(),
  save: jest.fn(),
});

// Мок репозитория памяти
const createMemoryRepositoryMock = () => ({
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

createTestSuite('EmotionalBehaviorService Tests', () => {
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен анализировать фрустрацию без критических потребностей',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      const frustrationLevel = await service.analyzeFrustration(1);

      expect(frustrationLevel).toBe(FrustrationLevel.NONE);
    },
  );

  createTest(
    {
      name: 'должен определить умеренную фрустрацию при критических потребностях',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: {
            getUnfulfilledNeeds: jest.fn().mockResolvedValue([
              { type: 'social', value: 10 },
              { type: 'achievement', value: 15 },
              { type: 'security', value: 5 },
            ]),
            updateNeed: jest.fn(),
            getNeedsByType: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      const frustrationLevel = await service.analyzeFrustration(1);

      expect(frustrationLevel).toBe(FrustrationLevel.MODERATE);
    },
  );

  createTest(
    {
      name: 'должен применить фрустрацию к действию',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      // Без фрустрации успешность не изменяется
      let modifiedRate = service.applyFrustrationToAction(1, 0.8);
      expect(modifiedRate).toBe(0.8);

      // Анализируем фрустрацию с критическими потребностями
      const needsService = context.get(NeedsService);
      (needsService.getUnfulfilledNeeds as jest.Mock).mockResolvedValue([
        { type: 'social', value: 10 },
        { type: 'achievement', value: 15 },
        { type: 'security', value: 5 },
      ]);

      await service.analyzeFrustration(1);

      // Теперь фрустрация должна снизить успешность
      modifiedRate = service.applyFrustrationToAction(1, 0.8);
      expect(modifiedRate).toBeLessThan(0.8);
      expect(modifiedRate).toBeGreaterThanOrEqual(0.1); // Минимум 10%
    },
  );

  createTest(
    {
      name: 'должен получить уровень фрустрации',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      // По умолчанию нет фрустрации
      expect(service.getFrustrationLevel(1)).toBe(FrustrationLevel.NONE);

      // После анализа должен появиться уровень
      await service.analyzeFrustration(1);
      expect(service.getFrustrationLevel(1)).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен получить активные паттерны фрустрации',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      // По умолчанию нет активных паттернов
      expect(service.getActiveFrustrationPatterns(1)).toEqual([]);

      // После анализа с критическими потребностями должны появиться паттерны
      const needsService = context.get(NeedsService);
      (needsService.getUnfulfilledNeeds as jest.Mock).mockResolvedValue([
        { type: 'social', value: 10 },
        { type: 'achievement', value: 15 },
      ]);

      await service.analyzeFrustration(1);
      const patterns = service.getActiveFrustrationPatterns(1);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('type');
      expect(patterns[0]).toHaveProperty('level');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать изменение эмоционального состояния',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);
      const eventEmitter = context.get(EventEmitter2);

      const payload = {
        characterId: 1,
        oldState: {
          primary: 'neutral',
          secondary: '',
          intensity: 20,
          description: 'спокоен',
        },
        newState: {
          primary: 'angry',
          secondary: '',
          intensity: 80,
          description: 'очень злой',
        },
        trigger: 'test',
        source: 'test',
      };

      await service.handleEmotionalStateChanged(payload);

      // Проверяем что были сгенерированы события
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'behavior.pattern_adaptation_requested',
        expect.objectContaining({
          characterId: 1,
          changeType: 'negative',
          intensity: 'high',
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.emotional_initiative_requested',
        expect.objectContaining({
          characterId: 1,
          actionType: 'confrontational_message',
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен правильно определять позитивные и негативные эмоции',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        EmotionalBehaviorService,
        {
          provide: 'CharacterRepository',
          useValue: createCharacterRepositoryMock(),
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: createMemoryRepositoryMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: NeedsService,
          useValue: createNeedsServiceMock(),
        },
        {
          provide: MemoryService,
          useValue: createMemoryServiceMock(),
        },
        {
          provide: ActionService,
          useValue: createActionServiceMock(),
        },
        {
          provide: EventEmitter2,
          useValue: createEventEmitterMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(EmotionalBehaviorService);

      // Тестируем анализ изменения эмоций через обработчик
      const positivePayload = {
        characterId: 1,
        oldState: {
          primary: 'sad',
          secondary: '',
          intensity: 60,
          description: 'грустный',
        },
        newState: {
          primary: 'happy',
          secondary: '',
          intensity: 80,
          description: 'счастливый',
        },
        trigger: 'test',
        source: 'test',
      };

      await service.handleEmotionalStateChanged(positivePayload);

      const eventEmitter = context.get(EventEmitter2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'behavior.pattern_adaptation_requested',
        expect.objectContaining({
          changeType: 'positive',
          intensity: 'medium',
        }),
      );
    },
  );
});
