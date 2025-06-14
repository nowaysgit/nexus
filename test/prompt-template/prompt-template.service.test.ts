import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { LogService } from '../../src/logging/log.service';
import { Character } from '../../src/character/entities/character.entity';
import { IEmotionalState } from '../../src/character/interfaces/emotional-state.interface';
import { PromptTemplate } from '../../src/common/interfaces/prompt-template.interface';
import { EmotionalState } from '../../src/character/entities/emotional-state';

// Мок LogService
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

createTestSuite('PromptTemplateService Tests', () => {
  createTest(
    {
      name: 'should be defined',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should get template by name',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn().mockResolvedValue({
              name: 'test-template',
              content: 'Hello {{name}}!',
              version: '1.0.0',
            }),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const template = await service.getTemplate('test-template');

      expect(template).toBeDefined();
      expect(template.name).toBe('test-template');
      expect(template.content).toBe('Hello {{name}}!');
      expect(service.getTemplate).toHaveBeenCalledWith('test-template');
    },
  );

  createTest(
    {
      name: 'should render template with variables',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn().mockResolvedValue('Hello John!'),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const rendered = await service.renderTemplate('test-template', { name: 'John' });
      expect(rendered).toBe('Hello John!');
      expect(service.renderTemplate).toHaveBeenCalledWith('test-template', { name: 'John' });
    },
  );

  createTest(
    {
      name: 'should create new template',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn().mockResolvedValue({
              id: 'template-123',
              name: 'new-template',
              content: 'New template content',
              version: '1.0.0',
              createdAt: new Date(),
            }),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const templateData = {
        name: 'new-template',
        content: 'New template content',
        description: 'Test template',
      };

      const created = await service.createTemplate(templateData);

      expect(created).toBeDefined();
      expect(created.name).toBe('new-template');
      expect(created.content).toBe('New template content');
      expect(service.createTemplate).toHaveBeenCalledWith(templateData);
    },
  );

  createTest(
    {
      name: 'should list all templates',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn().mockResolvedValue([
              { name: 'template1', version: '1.0.0' },
              { name: 'template2', version: '1.1.0' },
            ]),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const templates = await service.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('template1');
      expect(templates[1].name).toBe('template2');
      expect(service.listTemplates).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should get template statistics',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn().mockResolvedValue({
              totalTemplates: 5,
              totalUsage: 150,
              averageTokens: 45,
              mostUsed: 'character-response',
            }),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const stats = await service.getTemplateStats();

      expect(stats).toBeDefined();
      expect(stats.totalTemplates).toBe(5);
      expect(stats.totalUsage).toBe(150);
      expect(stats.mostUsed).toBe('character-response');
      expect(service.getTemplateStats).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should handle template not found error',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn().mockRejectedValue(new Error('Template not found')),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      await expect(service.getTemplate('non-existent')).rejects.toThrow('Template not found');
      expect(service.getTemplate).toHaveBeenCalledWith('non-existent');
    },
  );

  createTest(
    {
      name: 'should update existing template',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'PromptTemplateService',
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            createTemplate: jest.fn(),
            updateTemplate: jest.fn().mockResolvedValue({
              id: 'template-123',
              name: 'updated-template',
              content: 'Updated content',
              version: '1.1.0',
              updatedAt: new Date(),
            }),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn(),
            getTemplateStats: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'CacheService',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('PromptTemplateService');

      const updateData = {
        content: 'Updated content',
        description: 'Updated description',
      };

      const updated = await service.updateTemplate('template-123', updateData);

      expect(updated).toBeDefined();
      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe('1.1.0');
      expect(service.updateTemplate).toHaveBeenCalledWith('template-123', updateData);
    },
  );

  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);
      expect(promptTemplateService).toBeDefined();
      expect(promptTemplateService).toBeInstanceOf(PromptTemplateService);
    },
  );

  createTest(
    {
      name: 'должен создать промпт на основе шаблона',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      // Регистрируем тестовый шаблон
      const testTemplate: PromptTemplate = {
        type: 'test-template',
        name: 'Тестовый шаблон',
        description: 'Шаблон для тестирования',
        template: 'Привет, {{name}}! Твой возраст: {{age}}',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      promptTemplateService.registerTemplate(testTemplate);

      const result = promptTemplateService.createPrompt('test-template', {
        name: 'Алиса',
        age: 25,
      });
      expect(result).toBe('Привет, Алиса! Твой возраст: 25');
    },
  );

  createTest(
    {
      name: 'должен создать системный промпт для персонажа',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        fullName: 'Анна Петрова',
        biography: 'Молодая художница',
        personality: {
          traits: ['творческая', 'эмоциональная'],
          hobbies: ['рисование', 'музыка'],
          fears: ['одиночество'],
          values: ['красота', 'свобода'],
        },
      } as Character;

      const mockEmotionalState: EmotionalState = {
        primary: 'радость',
        intensity: 0.7,
        secondary: 'спокойствие',
        description: 'Хорошее настроение',
      };

      const result = promptTemplateService.createCharacterSystemPrompt(
        mockCharacter,
        mockEmotionalState,
        'Дополнительный контекст',
      );

      expect(result).toContain('Анна');
      expect(result).toContain('художница');
      expect(result).toContain('радость');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    },
  );

  createTest(
    {
      name: 'должен создать промпт для анализа сообщений',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      const result = promptTemplateService.createAnalysisPrompt('Анализ тестового сообщения');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('аналитик');
      expect(result).toContain('JSON');
    },
  );

  createTest(
    {
      name: 'должен получить шаблон по типу',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      const testTemplate: PromptTemplate = {
        type: 'get-test-template',
        name: 'Тестовый шаблон для получения',
        description: 'Шаблон для тестирования получения',
        template: 'Тест: {{value}}',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      promptTemplateService.registerTemplate(testTemplate);

      const result = promptTemplateService.getTemplate('get-test-template');

      expect(result).toBeDefined();
      expect(result?.type).toBe('get-test-template');
      expect(result?.template).toBe('Тест: {{value}}');
    },
  );

  createTest(
    {
      name: 'должен управлять версиями шаблонов',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      // Регистрируем первую версию
      const template1: PromptTemplate = {
        type: 'version-test',
        name: 'Версионный тест',
        description: 'Тест версионирования',
        template: 'Версия 1.0: {{text}}',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Регистрируем вторую версию
      const template2: PromptTemplate = {
        type: 'version-test',
        name: 'Версионный тест',
        description: 'Тест версионирования',
        template: 'Версия 2.0: {{text}}',
        version: '2.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      promptTemplateService.registerTemplate(template1);
      promptTemplateService.registerTemplate(template2);

      // Проверяем получение версий
      const versions = promptTemplateService.getTemplateVersions('version-test');
      expect(versions).toHaveLength(2);
      expect(versions.some(v => v.version === '1.0.0')).toBe(true);
      expect(versions.some(v => v.version === '2.0.0')).toBe(true);

      // Устанавливаем активную версию
      promptTemplateService.setActiveVersion('version-test', '2.0.0');

      const activeTemplate = promptTemplateService.getTemplate('version-test');
      expect(activeTemplate?.version).toBe('2.0.0');
    },
  );

  createTest(
    {
      name: 'должен получать статистику использования',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      const testTemplate: PromptTemplate = {
        type: 'stats-test',
        name: 'Тест статистики',
        description: 'Шаблон для тестирования статистики',
        template: 'Статистика: {{data}}',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      promptTemplateService.registerTemplate(testTemplate);

      // Используем шаблон несколько раз
      promptTemplateService.createPrompt('stats-test', { data: 'тест1' });
      promptTemplateService.createPrompt('stats-test', { data: 'тест2' });
      const stats = promptTemplateService.getUsageStats('stats-test');
      expect(stats).toBeDefined();
      expect(stats?.totalUses).toBeGreaterThan(0);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отсутствии шаблона',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      expect(() => {
        promptTemplateService.createPrompt('non-existent-template', {});
      }).toThrow();

      expect(mockLogService.warn).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен оптимизировать токены промпта',
      configType: TestConfigType.BASIC,
      providers: [
        PromptTemplateService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const promptTemplateService = context.get(PromptTemplateService);

      const longText = 'Это очень длинный текст '.repeat(100);
      const optimized = promptTemplateService.optimizePromptTokens(longText, 50);

      expect(optimized.length).toBeLessThan(longText.length);
      expect(typeof optimized).toBe('string');
    },
  );
});
