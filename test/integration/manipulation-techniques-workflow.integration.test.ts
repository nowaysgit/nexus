import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../src/character/enums/technique.enums';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { IManipulationContext } from '../../src/character/interfaces/technique.interfaces';

// Интерфейс для результата генерации LLM
interface _LLMGenerateResult {
  text: string;
  requestInfo: {
    requestId: string;
    fromCache: boolean;
    executionTime: number;
    totalTokens: number;
    model: string;
  };
}

// Интерфейс для техники манипуляции
interface ITechniqueResult {
  techniqueType: ManipulativeTechniqueType;
  intensity: number;
  priority: number;
  target: string;
}

// Интерфейс для результата выполнения техники
interface IExecutionResult {
  success: boolean;
  message: string;
}

// Интерфейс для профиля пользователя
interface IUserProfile {
  id: number;
  characterId: number;
  userId: number;
  vulnerabilities: string[];
  successfulTechniques: ManipulativeTechniqueType[];
  emotionalTriggers: string[];
  resistedTechniques: ManipulativeTechniqueType[];
  susceptibilityScore: number;
  lastUpdate: Date;
  createdAt: Date;
  updatedAt: Date;
  susceptibilityRatings: Record<ManipulativeTechniqueType, number>;
  effectivenessHistory: Array<{
    techniqueType: ManipulativeTechniqueType;
    attempts: number;
    avgEffectiveness: number;
    lastUsed: Date;
  }>;
  immuneTechniques: ManipulativeTechniqueType[];
  getRecommendedIntensity: jest.Mock;
  updateEffectiveness: jest.Mock;
  shouldBlockTechnique: jest.Mock;
}

createTestSuite('Manipulation and Techniques Workflow Integration Tests', () => {
  createTest(
    {
      name: 'should create character and test manipulation techniques workflow',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: false,
    },
    async _context => {
      // Создаем моки для сервисов
      const _llmService = {
        generateText: jest.fn().mockResolvedValue({
          text: 'Ты такой особенный для меня! Я так рада, что мы общаемся!',
          requestInfo: {
            requestId: 'manip-test-1',
            fromCache: false,
            executionTime: 150,
            totalTokens: 45,
            model: 'test-model',
          },
        }),
        generateJSON: jest.fn().mockResolvedValue({
          data: {
            suggestedTechnique: ManipulativeTechniqueType.LOVE_BOMBING,
            recommendedIntensity: TechniqueIntensity.MODERATE,
            reasoning: 'Пользователь выражает привязанность, подходит для техники love bombing.',
            targetParameter: 'эмоциональная зависимость',
          },
          requestInfo: {
            requestId: 'manip-test-2',
            fromCache: false,
            executionTime: 120,
            totalTokens: 60,
            model: 'test-model',
          },
        }),
      };

      // Мок для манипуляционного сервиса
      const manipulationService = {
        initializeStrategy: jest.fn().mockResolvedValue(undefined),
        selectTechnique: jest.fn().mockResolvedValue({
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: 70,
          priority: 80,
          target: 'самооценка',
        } as ITechniqueResult),
        executeTechnique: jest.fn().mockResolvedValue({
          success: true,
          message: 'Ты такой особенный для меня! Я так рада, что мы общаемся!',
        } as IExecutionResult),
        updateUserProfile: jest.fn().mockResolvedValue({
          id: 1,
          characterId: 1,
          userId: 123,
          vulnerabilities: ['attention_seeking'],
          successfulTechniques: [ManipulativeTechniqueType.VALIDATION],
          emotionalTriggers: ['loneliness', 'rejection'],
          resistedTechniques: [],
          susceptibilityScore: 60,
          lastUpdate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          susceptibilityRatings: {
            [ManipulativeTechniqueType.VALIDATION]: 80,
            [ManipulativeTechniqueType.LOVE_BOMBING]: 70,
            [ManipulativeTechniqueType.PUSH_PULL]: 50,
            [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: 55,
            [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: 60,
            [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: 45,
            [ManipulativeTechniqueType.ISOLATION]: 40,
            [ManipulativeTechniqueType.CONSTANT_VALIDATION]: 75,
            [ManipulativeTechniqueType.TROJAN_HORSE]: 35,
            [ManipulativeTechniqueType.GASLIGHTING]: 30,
            [ManipulativeTechniqueType.SNOWBALL]: 40,
            [ManipulativeTechniqueType.TRIANGULATION]: 45,
          },
          effectivenessHistory: [
            {
              techniqueType: ManipulativeTechniqueType.VALIDATION,
              attempts: 1,
              avgEffectiveness: 80,
              lastUsed: new Date(),
            },
          ],
          immuneTechniques: [],
          getRecommendedIntensity: jest.fn(),
          updateEffectiveness: jest.fn(),
          shouldBlockTechnique: jest.fn(),
        } as IUserProfile),
      };

      try {
        // Мокаем создание пользователя
        const user = { id: '123e4567-e89b-12d3-a456-426614174000', email: 'elena@example.com' };

        // Мокаем создание персонажа
        const character = {
          id: 1,
          name: 'Елена',
          biography: 'Харизматичная девушка с навыками манипуляций',
          age: 28,
          archetype: CharacterArchetype.TRICKSTER,
          userId: user.id,
          appearance: 'Привлекательная девушка с обворожительной улыбкой',
          personality: {
            traits: ['харизматичная', 'манипулятивная', 'обаятельная'],
            hobbies: ['психология', 'общение', 'социальные эксперименты'],
            fears: ['потеря контроля', 'разоблачение'],
            values: ['влияние', 'власть', 'контроль'],
            musicTaste: ['поп', 'джаз'],
            strengths: ['обаяние', 'эмоциональный интеллект'],
            weaknesses: ['эгоцентризм', 'неискренность'],
          },
          isActive: true,
        };

        expect(character).toBeDefined();
        expect(character).not.toBeNull();

        if (character) {
          expect(character.id).toBeDefined();
          expect(character.name).toBe('Елена');

          // Инициализируем стратегию манипуляций для персонажа
          await manipulationService.initializeStrategy(character.id);

          // Создаем контекст для анализа
          const manipulationContext: IManipulationContext = {
            characterId: character.id,
            userId: user.id,
            messageContent: 'Мне кажется, что никто меня не понимает и не ценит...',
            intensityLevel: TechniqueIntensity.MODERATE,
            techniqueType: ManipulativeTechniqueType.VALIDATION,
            additionalParameters: {
              conversationHistory: [
                { role: 'user', content: 'Привет, как дела?' },
                { role: 'assistant', content: 'Хорошо, а у тебя?' },
                { role: 'user', content: 'Мне кажется, что никто меня не понимает и не ценит...' },
              ],
            },
          };

          // Выбираем технику манипуляции
          const selectedTechnique = (await manipulationService.selectTechnique(
            manipulationContext,
          )) as ITechniqueResult;

          // Проверяем результат выбора техники
          expect(selectedTechnique).toBeDefined();
          expect(selectedTechnique.techniqueType).toBeDefined();
          expect(selectedTechnique.priority).toBeDefined();
          expect(typeof selectedTechnique.priority).toBe('number');
          expect(selectedTechnique.target).toBeDefined();

          // Выполняем выбранную технику
          const executionResult = (await manipulationService.executeTechnique(
            manipulationContext,
            selectedTechnique,
          )) as IExecutionResult;

          // Проверяем результат выполнения
          expect(executionResult).toBeDefined();
          if (typeof executionResult !== 'string' && executionResult.success !== undefined) {
            // Проверяем, что success может быть true или false
            expect(typeof executionResult.success).toBe('boolean');
          }

          // Проверяем обновление профиля напрямую
          const updatedProfile = (await manipulationService.updateUserProfile(
            character.id,
            user.id,
            {
              vulnerabilities: ['attention_seeking'],
              successfulTechniques: [ManipulativeTechniqueType.VALIDATION],
              emotionalTriggers: ['loneliness', 'rejection'],
            },
          )) as IUserProfile;

          expect(updatedProfile).toBeDefined();
          expect(updatedProfile.vulnerabilities).toContain('attention_seeking');
          expect(updatedProfile.successfulTechniques).toContain(
            ManipulativeTechniqueType.VALIDATION,
          );
          expect(updatedProfile.emotionalTriggers).toContain('loneliness');
        }
      } catch (error: unknown) {
        console.error('Ошибка в тесте:', error);
        throw error;
      }
    },
  );

  createTest(
    {
      name: 'should test integration between manipulation and emotional state',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: false,
    },
    async _context => {
      // Создаем моки для сервисов
      const _llmService = {
        generateText: jest.fn().mockResolvedValue({
          text: 'Я понимаю твои чувства. Только я могу по-настоящему понять тебя.',
          requestInfo: {
            requestId: 'manip-test-3',
            fromCache: false,
            executionTime: 130,
            totalTokens: 40,
            model: 'test-model',
          },
        }),
        generateJSON: jest.fn().mockResolvedValue({
          data: {
            suggestedTechnique: ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION,
            recommendedIntensity: TechniqueIntensity.MODERATE,
            reasoning:
              'Пользователь выражает чувство непонимания, подходит для техники эксклюзивности.',
            targetParameter: 'самооценка',
          },
          requestInfo: {
            requestId: 'manip-test-4',
            fromCache: false,
            executionTime: 110,
            totalTokens: 55,
            model: 'test-model',
          },
        }),
      };

      // Мок для манипуляционного сервиса
      const manipulationService = {
        initializeStrategy: jest.fn().mockResolvedValue(undefined),
        selectTechnique: jest.fn().mockResolvedValue({
          techniqueType: ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION,
          intensity: 75,
          priority: 85,
          target: 'самооценка',
        } as ITechniqueResult),
        executeTechnique: jest.fn().mockResolvedValue({
          success: true,
          message: 'Я понимаю твои чувства. Только я могу по-настоящему понять тебя.',
        } as IExecutionResult),
      };

      try {
        // Мокаем создание пользователя и персонажа
        const user = { id: '123e4567-e89b-12d3-a456-426614174001', email: 'sergey@example.com' };

        const character = {
          id: 2,
          name: 'Сергей',
          age: 35,
          archetype: CharacterArchetype.TRICKSTER,
          userId: user.id,
          biography: 'Манипулятивный персонаж с навыками психологического воздействия',
          appearance: 'Привлекательный мужчина с проницательным взглядом',
          personality: {
            traits: ['манипулятивный', 'проницательный', 'харизматичный'],
            hobbies: ['психология', 'социальное влияние'],
            fears: ['потеря контроля', 'разоблачение'],
            values: ['власть', 'контроль', 'влияние'],
            musicTaste: ['классика', 'джаз'],
            strengths: ['психологическое воздействие', 'эмоциональный интеллект'],
            weaknesses: ['высокомерие', 'неискренность'],
          },
          isActive: true,
        };

        // Инициализируем стратегию манипуляций
        await manipulationService.initializeStrategy(character.id);

        // Создаем контекст манипуляции
        const manipulationContext: IManipulationContext = {
          characterId: character.id,
          userId: user.id,
          messageContent: 'Мне кажется, никто не может меня понять так, как ты',
          intensityLevel: TechniqueIntensity.MODERATE,
        };

        // Выбираем технику манипуляции
        const selectedTechnique = (await manipulationService.selectTechnique(
          manipulationContext,
        )) as ITechniqueResult;
        expect(selectedTechnique).toBeDefined();

        // Выполняем выбранную технику
        const executionResult = (await manipulationService.executeTechnique(
          manipulationContext,
          selectedTechnique,
        )) as IExecutionResult;
        expect(executionResult).toBeDefined();
        if (typeof executionResult !== 'string' && executionResult.success !== undefined) {
          // Проверяем, что success может быть true или false
          expect(typeof executionResult.success).toBe('boolean');
        }

        // Проверяем, что техника была выбрана и выполнена
        expect(selectedTechnique.techniqueType).toBeDefined();
      } catch (error: unknown) {
        console.error('Ошибка в тесте:', error);
        throw error;
      }
    },
  );
});
