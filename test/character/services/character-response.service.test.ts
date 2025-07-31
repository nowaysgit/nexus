import { Test, TestingModule } from '@nestjs/testing';
import { CharacterResponseService } from '../../../src/character/services/core/character-response.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

const createMockLLMService = () => ({
  generateText: jest.fn(),
  generateJSON: jest.fn(),
  getAvailableProviders: jest.fn(),
  switchToAvailableProvider: jest.fn(),
});

const createMockPromptTemplateService = () => ({
  createPrompt: jest.fn(),
  createCharacterSystemPrompt: jest.fn(),
  getTemplate: jest.fn(),
  validateTemplate: jest.fn(),
});

const createMockNeedsService = () => ({
  updateNeeds: jest.fn(),
  getCurrentNeeds: jest.fn(),
  analyzeNeedsSatisfaction: jest.fn(),
});

const createMockEmotionalStateService = () => ({
  getEmotionalState: jest.fn(),
  updateEmotionalState: jest.fn(),
  getEmotionalMemories: jest.fn(),
  getEmotionalTransitions: jest.fn(),
});

describe('CharacterResponseService', () => {
  let service: CharacterResponseService;
  let llmService: jest.Mocked<LLMService>;
  let promptTemplateService: jest.Mocked<PromptTemplateService>;
  let emotionalStateService: jest.Mocked<EmotionalStateService>;
  let logService: LogService;
  let mockNeedsService: jest.Mocked<NeedsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterResponseService,
        {
          provide: LLMService,
          useValue: createMockLLMService(),
        },
        {
          provide: PromptTemplateService,
          useValue: createMockPromptTemplateService(),
        },
        {
          provide: NeedsService,
          useValue: createMockNeedsService(),
        },
        {
          provide: EmotionalStateService,
          useValue: createMockEmotionalStateService(),
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    service = module.get<CharacterResponseService>(CharacterResponseService);
    llmService = module.get<LLMService>(LLMService) as jest.Mocked<LLMService>;
    promptTemplateService = module.get<PromptTemplateService>(
      PromptTemplateService,
    ) as jest.Mocked<PromptTemplateService>;
    mockNeedsService = module.get<NeedsService>(NeedsService) as jest.Mocked<NeedsService>;
    emotionalStateService = module.get<EmotionalStateService>(
      EmotionalStateService,
    ) as jest.Mocked<EmotionalStateService>;
    logService = module.get<LogService>(LogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have all dependencies injected', () => {
    expect(llmService).toBeDefined();
    expect(promptTemplateService).toBeDefined();
    expect(mockNeedsService).toBeDefined();
    expect(emotionalStateService).toBeDefined();
    expect(logService).toBeDefined();
  });

  describe('service initialization', () => {
    it('should initialize with proper dependencies', () => {
      expect(service).toBeInstanceOf(CharacterResponseService);
    });
  });
});
