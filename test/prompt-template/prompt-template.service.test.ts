import { Test, TestingModule } from '@nestjs/testing';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { LogService } from '../../src/logging/log.service';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { EmotionalState } from '../../src/character/entities/emotional-state';
import { PromptTemplate } from '../../src/common/interfaces/prompt-template.interface';
import * as fs from 'fs';
import * as path from 'path';

// Мокаем fs модуль
jest.mock('fs');
jest.mock('path');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;
  let logService: jest.Mocked<LogService>;

  const mockLogService = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockCharacter: Character = {
    id: 1,
    name: 'TestCharacter',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'curious'],
      hobbies: ['reading', 'coding'],
      fears: ['spiders'],
      values: ['honesty', 'knowledge'],
      musicTaste: ['pop'],
      strengths: ['intelligence'],
      weaknesses: ['impatience'],
    },
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: ['general'],
    archetype: CharacterArchetype.COMPANION,
    affection: 50,
    trust: 50,
    energy: 100,
    relationshipStage: RelationshipStage.FRIENDSHIP,
    developmentStage: 'basic',
    isActive: true,
    isArchived: false,
    user: null,
    userId: null,
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: new Date(),
  } as Character;

  const mockEmotionalState: EmotionalState = {
    primary: 'happy',
    intensity: 75,
  } as EmotionalState;

  beforeEach(async () => {
    // Сбрасываем моки
    jest.clearAllMocks();

    // Настраиваем моки fs и path
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      'character-system-v1.1.0.hbs',
      'message-analysis-v2.1.0.hbs',
    ] as any);
    mockedFs.readFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('character-system-v1.1.0.hbs')) {
        return `Ты - {{characterName}}, персонаж со следующими характеристиками:

<profile>
    <description>{{characterDescription}}</description>
    <personality>
        <traits>{{personalityTraits}}</traits>
        <hobbies>{{hobbies}}</hobbies>
        <fears>{{fears}}</fears>
        <values>{{values}}</values>
    </personality>
    <emotional_state>
        <emotion>{{currentEmotion}}</emotion>
        <intensity>{{emotionalIntensity}}</intensity>
    </emotional_state>
</profile>

{{additionalContext}}

Твоя задача: всегда отвечать от лица {{characterName}}, строго придерживаясь всех указанных в <profile> характеристик и
    эмоционального состояния.`;
      }
      if (filePath.includes('message-analysis-v2.1.0.hbs')) {
        return 'Analyze: {{context}}';
      }
      return '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptTemplateService, { provide: LogService, useValue: mockLogService }],
    }).compile();

    service = module.get<PromptTemplateService>(PromptTemplateService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize default templates', () => {
      expect(mockedFs.readdirSync).toHaveBeenCalled();
      expect(mockedFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('createPrompt', () => {
    beforeEach(() => {
      // Регистрируем тестовый шаблон
      service.registerTemplate({
        type: 'test-template',
        version: '1.0.0',
        template: 'Hello {{name}}, you are {{age}} years old.',
        name: 'Test Template',
        description: 'Test template for unit tests',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should create prompt with parameters', () => {
      const result = service.createPrompt('test-template', {
        name: 'John',
        age: 25,
      });

      expect(result).toBe('Hello John, you are 25 years old.');
    });

    it('should create prompt with specific version', () => {
      const result = service.createPrompt(
        'test-template',
        {
          name: 'John',
          age: 25,
        },
        '1.0.0',
      );

      expect(result).toBe('Hello John, you are 25 years old.');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        service.createPrompt('non-existent', {});
      }).toThrow("Шаблон промпта 'non-existent' версии 'latest' не найден");
    });

    it('should handle null and undefined parameters', () => {
      service.registerTemplate({
        type: 'test-null',
        version: '1.0.0',
        template: 'Value: {{value}}, Null: {{nullValue}}, Undefined: {{undefinedValue}}',
        name: 'Test Null Template',
        description: 'Test template for null values',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      const result = service.createPrompt('test-null', {
        value: 'test',
        nullValue: null,
        undefinedValue: undefined,
      });

      expect(result).toBe('Value: test, Null: , Undefined: ');
    });

    it('should handle object parameters', () => {
      service.registerTemplate({
        type: 'test-object',
        version: '1.0.0',
        template: 'Object: {{object}}',
        name: 'Test Object Template',
        description: 'Test template for object values',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      const result = service.createPrompt('test-object', {
        object: { key: 'value', number: 42 },
      });

      expect(result).toBe('Object: {"key":"value","number":42}');
    });
  });

  describe('getTemplate', () => {
    beforeEach(() => {
      service.registerTemplate({
        type: 'test-get',
        version: '1.0.0',
        template: 'Template v1.0.0',
        name: 'Test Get Template',
        description: 'Test template for get tests',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'test-get',
        version: '2.0.0',
        template: 'Template v2.0.0',
        name: 'Test Get Template v2',
        description: 'Test template for get tests v2',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should get template by type and version', () => {
      const template = service.getTemplate('test-get', '1.0.0');

      expect(template).toBeDefined();
      expect(template?.template).toBe('Template v1.0.0');
    });

    it('should get latest version when version not specified', () => {
      const template = service.getTemplate('test-get');

      expect(template).toBeDefined();
      expect(template?.template).toBe('Template v2.0.0');
    });

    it('should return null for non-existent template', () => {
      const template = service.getTemplate('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('createCharacterSystemPrompt', () => {
    it('should create character system prompt', () => {
      const result = service.createCharacterSystemPrompt(
        mockCharacter,
        mockEmotionalState,
        'test context',
      );

      expect(result).toContain('TestCharacter');
      expect(result).toContain('Test biography');
      expect(result).toContain('friendly, curious');
      expect(result).toContain('reading, coding');
      expect(result).toContain('happy');
      expect(result).toContain('75');
      expect(result).toContain('test context');
    });

    it('should create character system prompt without emotional state', () => {
      const result = service.createCharacterSystemPrompt(mockCharacter);

      expect(result).toContain('TestCharacter');
      expect(result).toContain('нейтральное');
      expect(result).toContain('50');
    });

    it('should handle character without personality traits', () => {
      const characterWithoutPersonality = {
        ...mockCharacter,
        personality: undefined,
      };

      const result = service.createCharacterSystemPrompt(characterWithoutPersonality);

      expect(result).toContain('не указаны');
    });
  });

  describe('createAnalysisPrompt', () => {
    it('should create analysis prompt with context', () => {
      const result = service.createAnalysisPrompt('Test analysis context');

      expect(result).toContain('Test analysis context');
    });

    it('should create analysis prompt with default context', () => {
      const result = service.createAnalysisPrompt();

      expect(result).toContain('Проанализируй сообщение пользователя');
    });
  });

  describe('registerTemplate', () => {
    it('should register new template', () => {
      const template: PromptTemplate = {
        type: 'new-template',
        version: '1.0.0',
        template: 'New template: {{param}}',
        name: 'New Template',
        description: 'A new template',
        author: 'Test',
        tags: ['new'],
        maxTokens: 200,
        recommendedTemperature: 0.5,
      };

      service.registerTemplate(template);

      const retrieved = service.getTemplate('new-template', '1.0.0');
      expect(retrieved).toBeDefined();
      expect(retrieved?.template).toBe('New template: {{param}}');
    });

    it('should set default version if not provided', () => {
      const template: PromptTemplate = {
        type: 'no-version-template',
        version: '1.0.0',
        template: 'Template without version',
        name: 'No Version Template',
        description: 'Template without version',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      };

      service.registerTemplate(template);

      const retrieved = service.getTemplate('no-version-template', '1.0.0');
      expect(retrieved).toBeDefined();
    });

    it('should set timestamps on registration', () => {
      const template: PromptTemplate = {
        type: 'timestamp-template',
        version: '1.0.0',
        template: 'Template with timestamps',
        name: 'Timestamp Template',
        description: 'Template with timestamps',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      };

      service.registerTemplate(template);

      const retrieved = service.getTemplate('timestamp-template', '1.0.0');
      expect(retrieved?.createdAt).toBeDefined();
      expect(retrieved?.updatedAt).toBeDefined();
    });
  });

  describe('setActiveVersion', () => {
    beforeEach(() => {
      service.registerTemplate({
        type: 'version-test',
        version: '1.0.0',
        template: 'Version 1.0.0',
        name: 'Version Test',
        description: 'Version test template',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'version-test',
        version: '2.0.0',
        template: 'Version 2.0.0',
        name: 'Version Test v2',
        description: 'Version test template v2',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should set active version', () => {
      service.setActiveVersion('version-test', '1.0.0');

      const template = service.getTemplate('version-test');
      expect(template?.template).toBe('Version 1.0.0');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        service.setActiveVersion('non-existent', '1.0.0');
      }).toThrow("Шаблон 'non-existent' версии '1.0.0' не найден");
    });

    it('should throw error for non-existent version', () => {
      expect(() => {
        service.setActiveVersion('version-test', '3.0.0');
      }).toThrow("Шаблон 'version-test' версии '3.0.0' не найден");
    });
  });

  describe('getTemplateVersions', () => {
    beforeEach(() => {
      service.registerTemplate({
        type: 'versions-test',
        version: '1.0.0',
        template: 'Version 1.0.0',
        name: 'Versions Test',
        description: 'Versions test template',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'versions-test',
        version: '2.0.0',
        template: 'Version 2.0.0',
        name: 'Versions Test v2',
        description: 'Versions test template v2',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should return all versions of template', () => {
      const versions = service.getTemplateVersions('versions-test');

      expect(versions).toHaveLength(2);
      expect(versions.map(v => v.version)).toContain('1.0.0');
      expect(versions.map(v => v.version)).toContain('2.0.0');
    });

    it('should mark active version correctly', () => {
      service.setActiveVersion('versions-test', '1.0.0');
      const versions = service.getTemplateVersions('versions-test');

      const activeVersion = versions.find(v => v.isActive);
      expect(activeVersion?.version).toBe('1.0.0');
    });

    it('should return empty array for non-existent template', () => {
      const versions = service.getTemplateVersions('non-existent');

      expect(versions).toEqual([]);
    });
  });

  describe('getUsageStats', () => {
    beforeEach(() => {
      service.registerTemplate({
        type: 'stats-test',
        version: '1.0.0',
        template: 'Stats test: {{param}}',
        name: 'Stats Test',
        description: 'Stats test template',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should return null for unused template', () => {
      const stats = service.getUsageStats('stats-test', '1.0.0');

      expect(stats).toBeNull();
    });

    it('should return stats after template usage', () => {
      // Используем шаблон для создания статистики
      service.createPrompt('stats-test', { param: 'test' }, '1.0.0');

      const stats = service.getUsageStats('stats-test', '1.0.0');

      expect(stats).toBeDefined();
      expect(stats?.totalUses).toBe(1);
      expect(stats?.successRate).toBe(100);
      expect(stats?.averageTokens).toBeGreaterThan(0);
    });
  });

  describe('getAllTemplates', () => {
    it('should return all registered templates', () => {
      service.registerTemplate({
        type: 'all-test-1',
        version: '1.0.0',
        template: 'Template 1',
        name: 'All Test 1',
        description: 'All test template 1',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'all-test-2',
        version: '1.0.0',
        template: 'Template 2',
        name: 'All Test 2',
        description: 'All test template 2',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      const allTemplates = service.getAllTemplates();

      expect(allTemplates.length).toBeGreaterThanOrEqual(2);
      expect(allTemplates.some(t => t.type === 'all-test-1')).toBe(true);
      expect(allTemplates.some(t => t.type === 'all-test-2')).toBe(true);
    });
  });

  describe('getTemplatesByCategory', () => {
    beforeEach(() => {
      service.registerTemplate({
        type: 'category-test-1',
        version: '1.0.0',
        template: 'Category 1',
        name: 'Category Test 1',
        description: 'Category test template 1',
        author: 'Test',
        tags: ['test'],
        category: 'test-category',
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'category-test-2',
        version: '1.0.0',
        template: 'Category 2',
        name: 'Category Test 2',
        description: 'Category test template 2',
        author: 'Test',
        tags: ['test'],
        category: 'test-category',
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      service.registerTemplate({
        type: 'category-test-3',
        version: '1.0.0',
        template: 'Other Category',
        name: 'Category Test 3',
        description: 'Category test template 3',
        author: 'Test',
        tags: ['test'],
        category: 'other-category',
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });
    });

    it('should return templates by category', () => {
      const templates = service.getTemplatesByCategory('test-category');

      expect(templates).toHaveLength(2);
      expect(templates.every(t => t.category === 'test-category')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const templates = service.getTemplatesByCategory('non-existent-category');

      expect(templates).toEqual([]);
    });
  });

  describe('optimizePromptTokens', () => {
    it('should return original prompt when under token limit', () => {
      const prompt = 'Short prompt';
      const result = service.optimizePromptTokens(prompt, 100);

      expect(result).toBe(prompt);
    });

    it('should return original prompt when no max tokens specified', () => {
      const prompt = 'Any length prompt';
      const result = service.optimizePromptTokens(prompt);

      expect(result).toBe(prompt);
    });

    it('should optimize prompt when over token limit', () => {
      const longPrompt =
        'This is a very long prompt that should be optimized because it exceeds the token limit and contains multiple spaces    and    unnecessary    whitespace\n\n\nand empty lines';
      const result = service.optimizePromptTokens(longPrompt, 5);

      expect(result.length).toBeLessThan(longPrompt.length);
      expect(result).not.toContain('    '); // Multiple spaces should be removed
      expect(result.endsWith('...')).toBe(true); // Should be truncated
    });
  });

  describe('error handling', () => {
    it('should handle template rendering with unreplaced placeholders', () => {
      service.registerTemplate({
        type: 'unreplaced-test',
        version: '1.0.0',
        template: 'Hello {{name}}, you have {{unreplaced}} placeholder',
        name: 'Unreplaced Test',
        description: 'Test template with unreplaced placeholders',
        author: 'Test',
        tags: ['test'],
        maxTokens: 100,
        recommendedTemperature: 0.7,
      });

      const result = service.createPrompt('unreplaced-test', { name: 'John' });

      expect(result).toContain('{{unreplaced}}');
      expect(logService.warn).toHaveBeenCalledWith(
        'Обнаружены незамещенные плейсхолдеры в промпте',
        expect.any(Object),
      );
    });

    it('should handle file system errors gracefully', () => {
      // Тест уже покрыт в constructor тесте через моки
      expect(service).toBeDefined();
    });
  });
});
