import { Tester, createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { IEmotionalState } from '../../src/character/interfaces/emotional-state.interface';
import { PromptTemplate } from '../../src/common/interfaces/prompt-template.interface';
import { DataSource } from 'typeorm';

createTestSuite('PromptTemplateService Integration Tests', () => {
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    const tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
    fixtureManager = new FixtureManager(dataSource);
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'должен создать экземпляр PromptTemplateService',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);
      expect(promptService).toBeDefined();
      expect(promptService).toBeInstanceOf(PromptTemplateService);

      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'должен создавать промпты на основе шаблонов',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);

      const testTemplate: PromptTemplate = {
        type: 'test-template',
        name: 'Тестовый шаблон',
        description: 'Шаблон для тестирования',
        template: 'Привет, {{name}}! Твой возраст: {{age}}.',
        version: '1.0.0',
        category: 'test',
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (promptService as any).registerTemplate(testTemplate);

      const prompt = (promptService as any).createPrompt('test-template', {
        name: 'Иван',
        age: 25,
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Привет, Иван!');
      expect(prompt).toContain('Твой возраст: 25');

      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'должен создавать системный промпт для персонажа',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);

      const character = new Character();
      character.id = 123456;
      character.name = 'Test Character';
      character.fullName = 'Test Character Full Name';
      character.biography = 'Test character biography for prompt template integration testing';
      character.archetype = CharacterArchetype.INNOCENT;
      character.age = 25;
      character.appearance = 'Привлекательная';
      character.personality = {
        traits: ['добрая', 'умная'],
        hobbies: ['чтение', 'музыка'],
        fears: ['темнота'],
        values: ['честность', 'дружба'],
        musicTaste: ['классика'],
        strengths: ['эмпатия'],
        weaknesses: ['доверчивость'],
      };

      const emotionalState: IEmotionalState = {
        primary: 'радость',
        secondary: 'спокойствие',
        intensity: 0.7,
      };

      const systemPrompt = (promptService as any).createCharacterSystemPrompt(
        character,
        emotionalState,
        'Дополнительный контекст',
      );

      expect(systemPrompt).toBeDefined();
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(0);

      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'должен создавать промпт для анализа сообщений',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);
      const analysisPrompt = (promptService as any).createAnalysisPrompt(
        'Анализ настроения пользователя',
      );
      expect(analysisPrompt).toBeDefined();
      expect(typeof analysisPrompt).toBe('string');
      expect(analysisPrompt.length).toBeGreaterThan(0);

      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'должен управлять версиями шаблонов',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);

      const template1: PromptTemplate = {
        type: 'versioned-template',
        name: 'Версионированный шаблон',
        description: 'Шаблон с версиями',
        template: 'Версия 1.0: {{content}}',
        version: '1.0.0',
        category: 'test',
        tags: ['versioned'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (promptService as any).registerTemplate(template1);

      const template2: PromptTemplate = {
        type: 'versioned-template',
        name: 'Версионированный шаблон',
        description: 'Шаблон с версиями',
        template: 'Версия 2.0: {{content}} (улучшенная)',
        version: '2.0.0',
        category: 'test',
        tags: ['versioned'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (promptService as any).registerTemplate(template2);

      const versions = (promptService as any).getTemplateVersions('versioned-template');
      expect(versions).toBeDefined();
      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBe(2);

      const activeVersion = versions.find(v => v.isActive);
      expect(activeVersion).toBeDefined();

      (promptService as any).setActiveVersion('versioned-template', '2.0.0');

      const prompt = (promptService as any).createPrompt('versioned-template', {
        content: 'тест',
      });
      expect(prompt).toContain('Версия 2.0');
      expect(prompt).toContain('улучшенная');

      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'должен получать шаблоны по типу и версии',
      requiresDatabase: true,
    },
    async () => {
      const moduleRef = await TestModuleBuilder.create()
        .withImports([PromptTemplateModule])
        .withRequiredMocks()
        .compile();

      const promptService = moduleRef.get(PromptTemplateService);

      const template: PromptTemplate = {
        type: 'get-template-test',
        name: 'Тест получения шаблона',
        description: 'Шаблон для тестирования получения',
        template: 'Содержимое: {{data}}',
        version: '1.5.0',
        category: 'test',
        tags: ['get'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (promptService as any).registerTemplate(template);

      const retrievedTemplate = (promptService as any).getTemplate('get-template-test', '1.5.0');
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate!.type).toBe('get-template-test');
      expect(retrievedTemplate!.version).toBe('1.5.0');
      expect(retrievedTemplate!.template).toBe('Содержимое: {{data}}');

      await moduleRef.close();
    },
  );
});
