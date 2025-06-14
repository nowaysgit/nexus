import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NeedsService } from '../../src/character/services/needs.service';
import { MotivationService } from '../../src/character/services/motivation.service';
import { ActionService } from '../../src/character/services/action.service';
import { CharacterService } from '../../src/character/services/character.service';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { Repository } from 'typeorm';
import { CharacterModule } from '../../src/character/character.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MonitoringModule } from '../../src/monitoring/monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';
import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';

createTestSuite('Needs and Motivation Workflow Integration Tests', () => {
  let moduleRef: TestingModule | null = null;
  let characterService: CharacterService;
  let needsService: NeedsService;
  let motivationService: MotivationService;
  let actionService: ActionService;
  let characterRepository: Repository<Character>;
  let needRepository: Repository<Need>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        CharacterModule,
        LLMModule,
        CacheModule,
        LoggingModule,
        MessageQueueModule,
        ValidationModule,
        MonitoringModule,
        PromptTemplateModule,
      ],
    }).compile();

    characterService = moduleRef.get<CharacterService>(CharacterService);
    needsService = moduleRef.get<NeedsService>(NeedsService);
    motivationService = moduleRef.get<MotivationService>(MotivationService);
    actionService = moduleRef.get<ActionService>(ActionService);
    characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
    needRepository = moduleRef.get<Repository<Need>>(getRepositoryToken(Need));
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should create character and initialize needs',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      const character = await characterService.create({
        name: 'Анна',
        age: 25,
        biography: 'Общительная девушка, которая любит внимание',
        appearance: 'Привлекательная девушка с яркой улыбкой',
        personality: {
          traits: ['общительная', 'эмоциональная', 'активная'],
          hobbies: ['общение', 'музыка', 'танцы'],
          fears: ['одиночество', 'игнорирование'],
          values: ['дружба', 'внимание', 'признание'],
          musicTaste: ['поп', 'танцевальная'],
          strengths: ['коммуникабельность', 'эмпатия'],
          weaknesses: ['зависимость от внимания'],
        },
        isActive: true,
      });
      expect(character).toBeDefined();
      expect(character.name).toBe('Анна');

      await needsService.createDefaultNeeds(character.id);

      const needs = await needsService.getNeedsByCharacter(character.id);
      expect(needs).toBeDefined();
      expect(needs.length).toBeGreaterThan(0);

      const communicationNeed = needs.find(need => need.type === CharacterNeedType.COMMUNICATION);
      expect(communicationNeed).toBeDefined();
      expect(communicationNeed.currentValue).toBeGreaterThanOrEqual(0);

      await needsService.updateNeed(character.id, {
        type: CharacterNeedType.COMMUNICATION,
        change: 50,
        reason: 'Тестовое накопление потребности',
      });
      const motivation = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Желание общаться',
        80,
        {
          thresholdValue: 70,
          accumulationRate: 1.5,
          resourceCost: 20,
          successProbability: 0.7,
        },
      );

      expect(motivation).toBeDefined();
      expect(motivation.characterId).toBe(character.id);

      await needRepository.delete({ characterId: character.id });
      await characterRepository.delete(character.id);
    },
  );

  createTest(
    { name: 'should handle action service integration', configType: TestConfigType.INTEGRATION },
    async () => {
      const character = await characterService.create({
        name: 'Виктор',
        biography: 'Активный парень, который любит действовать',
        personality: {
          traits: ['активный', 'целеустремленный'],
          hobbies: ['спорт', 'работа'],
          fears: ['бездействие'],
          values: ['достижения', 'прогресс'],
          musicTaste: ['рок', 'электронная'],
          strengths: ['энергичность'],
          weaknesses: ['нетерпеливость'],
        },
        isActive: true,
      });

      const action = await actionService.createActionWithResources(
        character.id,
        'SEND_MESSAGE' as any,
        {
          resourceCost: 10,
          successProbability: 0.8,
          potentialReward: { communication: 30 },
          description: 'Отправка сообщения',
        },
      );

      expect(action).toBeDefined();
      expect(action.id).toBeDefined();

      const actionContext = {
        character,
        action,
        metadata: { testExecution: true },
      };

      const canExecute = await actionService.canExecute(actionContext);
      expect(canExecute).toBe(true);

      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      await characterRepository.delete(character.id);
    },
  );
});
