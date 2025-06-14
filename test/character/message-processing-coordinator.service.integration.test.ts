import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { MessageAnalysisService } from '../../src/character/services/message-analysis.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { SpecializationService } from '../../src/character/services/specialization.service';
import { CharacterService } from '../../src/character/services/character.service';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tester } from '../../lib/tester';

createTestSuite('MessageProcessingCoordinator Integration Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.INTEGRATION);
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    await tester.forceCleanup();
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'test message processing',
      configType: TestConfigType.INTEGRATION,
      providers: [
        MessageProcessingCoordinator,
        MessageAnalysisService,
        NeedsService,
        CharacterBehaviorService,
        CharacterResponseService,
        EmotionalStateService,
        ManipulationService,
        TechniqueExecutorService,
        SpecializationService,
        CharacterService,
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Need),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get(MessageProcessingCoordinator);
      const characterRepo = context.get(getRepositoryToken(Character));
      const needRepo = context.get(getRepositoryToken(Need));
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({
        userId: Number(user.id),
      });

      characterRepo.findOne.mockResolvedValue(character);
      needRepo.find.mockResolvedValue([]);

      // Ensure userId is a number
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;

      const result = await service.processUserMessage(character, userId, 'Hello', []);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.analysis).toBeDefined();
    },
  );
});
