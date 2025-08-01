import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface LlamaGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

@Injectable()
export class LlamaProviderService {
  private readonly logger = new Logger(LlamaProviderService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_API_URL', 'http://localhost:11434');
    this.defaultModel = this.configService.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.2:3b');

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 секунд таймаут
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Initialized LlamaProviderService with base URL: ${this.baseUrl}`);
  }

  /**
   * Проверка здоровья Ollama API
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/version');
      this.logger.log(`Ollama API health check successful: ${JSON.stringify(response.data)}`);
      return true;
    } catch (error) {
      this.logger.error(`Ollama API health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Получение списка доступных моделей
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/api/tags');
      const models: OllamaModel[] = response.data.models || [];
      const modelNames = models.map(model => model.name);

      this.logger.log(`Available models: ${modelNames.join(', ')}`);
      return modelNames;
    } catch (error) {
      this.logger.error(`Failed to list models: ${error.message}`);
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  /**
   * Генерация текста с указанной моделью
   */
  async generateText(
    prompt: string,
    model: string = this.defaultModel,
    options: LlamaGenerationOptions = {},
  ): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    try {
      const requestData = {
        model,
        prompt,
        stream: false,
        options: {
          num_predict: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
        },
      };

      this.logger.log(
        `Generating text with model ${model} for prompt: ${prompt.substring(0, 100)}...`,
      );

      const response = await this.httpClient.post('/api/generate', requestData);

      if (response.data && response.data.response) {
        this.logger.log(
          `Text generation successful, response length: ${response.data.response.length}`,
        );
        return response.data.response;
      } else {
        throw new Error('Invalid response format from Ollama API');
      }
    } catch (error) {
      this.logger.error(`Text generation failed: ${error.message}`);

      if (error.response?.status === 404) {
        throw new Error(`Model '${model}' not found. Available models: ${await this.listModels()}`);
      }

      throw new Error(`Text generation failed: ${error.message}`);
    }
  }

  /**
   * Потоковая генерация текста
   */
  async generateTextStream(
    prompt: string,
    model: string = this.defaultModel,
    onChunk: (chunk: string) => void,
    options: LlamaGenerationOptions = {},
  ): Promise<void> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    try {
      const requestData = {
        model,
        prompt,
        stream: true,
        options: {
          num_predict: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
        },
      };

      this.logger.log(`Starting streaming generation with model ${model}`);

      const response = await this.httpClient.post('/api/generate', requestData, {
        responseType: 'stream',
      });

      let buffer = '';

      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                onChunk(parsed.response);
              }
            } catch (parseError) {
              this.logger.warn(`Failed to parse streaming chunk: ${parseError.message}`);
            }
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', () => {
          this.logger.log('Streaming generation completed');
          resolve();
        });

        response.data.on('error', (error: Error) => {
          this.logger.error(`Streaming generation failed: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Streaming generation setup failed: ${error.message}`);
      throw new Error(`Streaming generation failed: ${error.message}`);
    }
  }

  /**
   * Генерация текста для чата
   */
  async generateChatResponse(
    messages: Array<{ role: string; content: string }>,
    model: string = this.defaultModel,
    options: LlamaGenerationOptions = {},
  ): Promise<string> {
    try {
      const requestData = {
        model,
        messages,
        stream: false,
        options: {
          num_predict: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
        },
      };

      this.logger.log(`Generating chat response with model ${model}`);

      const response = await this.httpClient.post('/api/chat', requestData);

      if (response.data && response.data.message && response.data.message.content) {
        this.logger.log(`Chat response generation successful`);
        return response.data.message.content;
      } else {
        throw new Error('Invalid chat response format from Ollama API');
      }
    } catch (error) {
      this.logger.error(`Chat response generation failed: ${error.message}`);
      throw new Error(`Chat response generation failed: ${error.message}`);
    }
  }

  /**
   * Получение информации о модели
   */
  async getModelInfo(model: string): Promise<OllamaModel | null> {
    try {
      const models = await this.listModels();
      const response = await this.httpClient.get('/api/tags');
      const modelData: OllamaModel[] = response.data.models || [];

      return modelData.find(m => m.name === model) || null;
    } catch (error) {
      this.logger.error(`Failed to get model info: ${error.message}`);
      return null;
    }
  }

  /**
   * Загрузка новой модели
   */
  async pullModel(model: string): Promise<void> {
    try {
      this.logger.log(`Starting to pull model: ${model}`);

      const response = await this.httpClient.post(
        '/api/pull',
        { name: model },
        {
          timeout: 300000, // 5 минут для загрузки модели
        },
      );

      this.logger.log(`Model ${model} pulled successfully`);
    } catch (error) {
      this.logger.error(`Failed to pull model ${model}: ${error.message}`);
      throw new Error(`Failed to pull model ${model}: ${error.message}`);
    }
  }

  /**
   * Удаление модели
   */
  async deleteModel(model: string): Promise<void> {
    try {
      await this.httpClient.delete('/api/delete', { data: { name: model } });
      this.logger.log(`Model ${model} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete model ${model}: ${error.message}`);
      throw new Error(`Failed to delete model ${model}: ${error.message}`);
    }
  }
}
