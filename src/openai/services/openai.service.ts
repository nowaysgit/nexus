import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Configuration, OpenAIApi } from 'openai';
import { openaiConfig } from '../../config';
import { MessageAnalysis } from '../../character/interfaces/message-analysis.interface';

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAIApi;
  private readonly logger = new Logger(OpenaiService.name);
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly maxResponseTokens: number;
  private readonly systemTemperature: number;
  private readonly analysisModel: string;

  constructor(
    @Inject(openaiConfig.KEY)
    private config: ConfigType<typeof openaiConfig>,
  ) {
    const configuration = new Configuration({
      apiKey: this.config.apiKey,
    });

    this.openai = new OpenAIApi(configuration);
    this.model = this.config.model;
    this.defaultTemperature = this.config.defaultTemperature;
    this.maxResponseTokens = this.config.maxResponseTokens;
    this.systemTemperature = this.config.systemTemperature;
    this.analysisModel = this.config.analysisModel;
  }

  // ... существующие методы сервиса

  /**
   * Анализирует сообщение пользователя с помощью нейросети
   * @param prompt Запрос для анализа сообщения
   * @returns Результаты анализа сообщения
   */
  async analyzeUserMessage(prompt: string): Promise<MessageAnalysis> {
    try {
      const response = await this.openai.createChatCompletion({
        model: this.analysisModel,
        messages: [
          {
            role: 'system',
            content:
              'Ты - психологический аналитик, который оценивает влияние сообщений пользователя на потребности и эмоциональное состояние персонажа. Отвечай ТОЛЬКО в указанном JSON формате без комментариев.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.systemTemperature,
        max_tokens: 1000,
      });

      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Не получен ответ от API OpenAI');
      }

      try {
        // Попытка распарсить JSON из ответа
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error('Не найден JSON в ответе');
        }

        const jsonContent = jsonMatch[0];
        return JSON.parse(jsonContent) as MessageAnalysis;
      } catch (parseError) {
        this.logger.error(`Ошибка парсинга JSON из ответа: ${parseError.message}`);
        this.logger.debug(`Содержимое ответа: ${content}`);

        // Возвращаем базовый анализ при ошибке
        return {
          needsImpact: {},
          emotionalReaction: 'нейтральная',
          importance: 0.5,
          requiresActionChange: false,
        };
      }
    } catch (error) {
      this.logger.error(`Ошибка при анализе сообщения через OpenAI: ${error.message}`);

      // Возвращаем базовый анализ при ошибке
      return {
        needsImpact: {},
        emotionalReaction: 'нейтральная',
        importance: 0.5,
        requiresActionChange: false,
      };
    }
  }
}
