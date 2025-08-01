import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LlamaProviderService } from '../../../src/llm/providers/llama-provider.service';

describe('LlamaProviderService (Integration)', () => {
  let service: LlamaProviderService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test.llm', '.env.local.llm'],
        }),
      ],
      providers: [LlamaProviderService],
    }).compile();

    service = module.get<LlamaProviderService>(LlamaProviderService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Local LLM Integration', () => {
    it('should connect to Ollama API', async () => {
      const isHealthy = await service.checkHealth();
      expect(isHealthy).toBe(true);
    }, 10000);

    it('should generate text with llama3.2:3b model', async () => {
      const prompt = 'Hello, what is your name?';
      const result = await service.generateText(prompt, 'llama3.2:3b');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('error');
    }, 30000);

    it('should list available models', async () => {
      const models = await service.listModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Проверяем, что есть наша модель
      const hasLlama3b = models.some(model => model.includes('llama3.2:3b'));
      expect(hasLlama3b).toBe(true);
    }, 10000);

    it('should handle streaming responses', async () => {
      const prompt = 'Count from 1 to 5';
      let streamedText = '';

      await service.generateTextStream(prompt, 'llama3.2:3b', chunk => {
        streamedText += chunk;
      });

      expect(streamedText).toBeDefined();
      expect(streamedText.length).toBeGreaterThan(0);
    }, 30000);

    it('should respect generation parameters', async () => {
      const prompt = 'Say hello in exactly 3 words';
      const result = await service.generateText(prompt, 'llama3.2:3b', {
        maxTokens: 10,
        temperature: 0.1,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.trim().split(' ').length).toBeLessThanOrEqual(5); // Учитываем погрешность
    }, 20000);
  });

  describe('Error Handling', () => {
    it('should handle invalid model names gracefully', async () => {
      const prompt = 'Hello';

      await expect(service.generateText(prompt, 'non-existent-model')).rejects.toThrow();
    }, 10000);

    it('should handle empty prompts', async () => {
      await expect(service.generateText('', 'llama3.2:3b')).rejects.toThrow();
    }, 10000);
  });

  describe('Performance Tests', () => {
    it('should generate text within reasonable time', async () => {
      const startTime = Date.now();
      const prompt = 'Hello';

      await service.generateText(prompt, 'llama3.2:3b');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Должно быть быстрее 30 секунд для простого промпта
      expect(duration).toBeLessThan(30000);
    }, 35000);
  });
});
