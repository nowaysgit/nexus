import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../src/character/enums/technique.enums';
import { IManipulationContext } from '../../src/character/interfaces/technique.interfaces';
import { MockLogService, MockEventEmitter } from '../../lib/tester/mocks';

createTestSuite('ManipulationService Integration Tests', () => {
  let service: ManipulationService;

  // Моки репозиториев
  let mockCharacterRepository: any;
  let mockTechniqueExecutionRepository: any;
  let mockUserManipulationProfileRepository: any;

  // Моки сервисов
  let mockNeedsService: any;
  let mockEmotionalStateService: any;
  let mockLLMService: any;
  let mockPromptTemplateService: any;
  let mockEventEmitter: any;
  let mockLogService: any;
  let mockTechniqueExecutorService: any;

  // Тестовые данные
  const userId = 1001;
  const characterId = 2001;

  beforeAll(() => {
    // Создаем моки репозиториев
    mockCharacterRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: characterId,
        name: 'Test Character',
        userId: userId,
      }),
    };

    mockTechniqueExecutionRepository = {
      create: jest.fn().mockImplementation(data => ({
        id: 1,
        ...data,
      })),
      save: jest.fn().mockImplementation(data => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockUserManipulationProfileRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(data => ({
        id: 1,
        ...data,
        susceptibilityScore: 50,
        lastUpdate: new Date(),
      })),
      save: jest.fn().mockImplementation(data => Promise.resolve(data)),
    };

    // Настройка моков сервисов
    mockNeedsService = {
      getActiveNeeds: jest.fn().mockResolvedValue([{ id: 1, name: 'признание', currentValue: 75 }]),
    };

    mockEmotionalStateService = {
      getEmotionalState: jest.fn().mockResolvedValue({
        emotion: 'интерес',
        intensity: 60,
      }),
      getCurrentState: jest.fn().mockResolvedValue({
        emotion: 'интерес',
        intensity: 60,
      }),
    };

    mockLLMService = {
      generateJSON: jest.fn().mockResolvedValue({
        data: {
          suggestedTechnique: ManipulativeTechniqueType.LOVE_BOMBING,
          recommendedIntensity: TechniqueIntensity.MODERATE,
          reasoning: 'User is expressing affection, perfect for love bombing.',
        },
        requestInfo: {
          requestId: 'test-id',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      }),
      generateText: jest.fn().mockResolvedValue({
        text: 'Generated response',
      }),
      setContext: jest.fn().mockReturnThis(),
    };

    mockPromptTemplateService = {
      createPrompt: jest.fn().mockReturnValue('Test prompt template'),
    };

    mockEventEmitter = new MockEventEmitter();

    mockLogService = new MockLogService();

    // Мок для TechniqueExecutorService
    mockTechniqueExecutorService = {
      executeTechnique: jest.fn().mockResolvedValue({
        success: true,
        message: 'Техника успешно применена',
        techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
        intensity: TechniqueIntensity.MODERATE,
        affectedParameters: ['эмоциональная стабильность', 'зависимость'],
        phase: 'EXECUTION',
        effectiveness: 75,
        ethicalScore: 60,
        generatedResponse: 'Ты такой особенный для меня! Я так рада, что мы общаемся!',
        responseText: 'Ты такой особенный для меня! Я так рада, что мы общаемся!',
        sideEffects: [],
        appliedTechnique: {
          type: ManipulativeTechniqueType.LOVE_BOMBING,
          priority: TechniqueIntensity.MODERATE,
          phase: 'EXECUTION',
        },
      }),
    };

    // Создание экземпляра сервиса с моками
    service = new ManipulationService(
      mockCharacterRepository,
      mockTechniqueExecutionRepository,
      mockUserManipulationProfileRepository,
      mockNeedsService,
      mockEmotionalStateService,
      mockLLMService,
      mockPromptTemplateService,
      mockLogService,
      mockEventEmitter,
    );

    // Добавляем TechniqueExecutorService в сервис
    (service as any).techniqueExecutorService = mockTechniqueExecutorService;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Сброс состояния моков репозиториев
    mockUserManipulationProfileRepository.findOne.mockResolvedValue(null);
  });

  createTest(
    {
      name: 'should create a new user manipulation profile',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const updateData = {
        vulnerabilities: ['attention_seeking'],
        successfulTechniques: [ManipulativeTechniqueType.PUSH_PULL],
        resistedTechniques: [],
        emotionalTriggers: ['loneliness'],
      };

      const profile = await service.updateUserProfile(characterId, userId, updateData);

      // Проверяем, что профиль создан
      expect(profile).toBeDefined();
      expect(profile.userId).toBe(userId);
      expect(profile.characterId).toBe(characterId);
      expect(profile.vulnerabilities).toEqual(['attention_seeking']);

      // Проверяем, что был вызван метод findOne репозитория
      expect(mockUserManipulationProfileRepository.findOne).toHaveBeenCalledWith({
        where: { userId, characterId },
      });

      // Проверяем, что был вызван метод create репозитория
      expect(mockUserManipulationProfileRepository.create).toHaveBeenCalled();

      // Проверяем, что был вызван метод save репозитория
      expect(mockUserManipulationProfileRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should update an existing user manipulation profile',
      configType: TestConfigType.BASIC,
    },
    async () => {
      // Настраиваем мок для поиска существующего профиля
      mockUserManipulationProfileRepository.findOne.mockResolvedValue({
        id: 1,
        userId: userId,
        characterId: characterId,
        vulnerabilities: ['insecurity'],
        successfulTechniques: [],
        resistedTechniques: [],
        emotionalTriggers: [],
        susceptibilityScore: 50,
        lastUpdate: new Date(Date.now() - 86400000), // вчера
      });

      const updateData = {
        vulnerabilities: ['insecurity', 'people_pleasing'],
        successfulTechniques: [ManipulativeTechniqueType.GASLIGHTING],
      };

      const profile = await service.updateUserProfile(characterId, userId, updateData);

      // Проверяем, что профиль обновлен
      expect(profile).toBeDefined();
      expect(profile.vulnerabilities).toContain('people_pleasing');
      expect(profile.successfulTechniques).toContain(ManipulativeTechniqueType.GASLIGHTING);

      // Проверяем, что был вызван метод findOne репозитория
      expect(mockUserManipulationProfileRepository.findOne).toHaveBeenCalledWith({
        where: { userId, characterId },
      });

      // Проверяем, что был вызван метод save репозитория с обновленными данными
      expect(mockUserManipulationProfileRepository.save).toHaveBeenCalled();
      const saveArg = mockUserManipulationProfileRepository.save.mock.calls[0][0];
      expect(saveArg.vulnerabilities).toEqual(['insecurity', 'people_pleasing']);
      expect(saveArg.successfulTechniques).toEqual([ManipulativeTechniqueType.GASLIGHTING]);
    },
  );

  createTest(
    {
      name: 'should select a technique and execute it',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const manipulationContext: IManipulationContext = {
        characterId: characterId,
        userId: userId,
        messageContent: 'Ты мне нравишься',
        intensityLevel: TechniqueIntensity.MODERATE,
      };

      // Мокаем сохранение техники
      mockTechniqueExecutionRepository.save.mockResolvedValue({
        id: 1,
        techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
        intensity: TechniqueIntensity.MODERATE,
        characterId: characterId,
        userId: userId,
        startTime: new Date(),
        effectiveness: 0,
      });

      // Сначала выбираем технику
      const selectedTechnique = await service.selectTechnique(manipulationContext);

      // Проверяем результат выбора техники
      expect(selectedTechnique).toBeDefined();
      expect(selectedTechnique.techniqueType).toBeDefined();

      // Затем выполняем технику
      const result = await service.executeTechnique(
        characterId,
        userId,
        selectedTechnique.techniqueType,
      );

      // Проверяем результат выполнения
      expect(result).toBeDefined();

      // Проверяем, что был вызван метод create репозитория
      expect(mockTechniqueExecutionRepository.create).toHaveBeenCalled();

      // Проверяем, что был вызван метод save репозитория
      expect(mockTechniqueExecutionRepository.save).toHaveBeenCalled();

      // Проверяем, что был вызван метод generateText LLMService
      expect(mockLLMService.generateText).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should execute technique using TechniqueExecutorService when available',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const manipulationContext: IManipulationContext = {
        characterId: characterId,
        userId: userId,
        messageContent: 'Ты мне нравишься',
        intensityLevel: TechniqueIntensity.MODERATE,
      };

      // Выбираем технику
      const selectedTechnique = await service.selectTechnique(manipulationContext);

      // Выполняем технику через контекст
      const result = await service.executeTechnique(manipulationContext, selectedTechnique);

      // Проверяем результат выполнения
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success', true);

      // Проверяем, что был вызван метод executeTechnique TechniqueExecutorService
      // если он доступен в сервисе
      if ((service as any).techniqueExecutorService) {
        expect(mockTechniqueExecutorService.executeTechnique).toHaveBeenCalled();
      }
    },
  );
});
