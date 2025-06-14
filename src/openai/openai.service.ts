import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { Character, CharacterArchetype } from '../character/entities/character.entity';
import { User } from '../user/entities/user.entity';
import { MessageAnalysis } from '../character/interfaces/message-analysis.interface';
import { ChatCompletionMessageParam } from 'openai/resources';

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenaiService.name);

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateCharacter(archetype: CharacterArchetype, user: User): Promise<Partial<Character>> {
    try {
      const prompt = `Создай детальный профиль персонажа женского пола с архетипом "${archetype}".
      
Профиль должен включать:
1. Имя и возраст (от 25 до 35 лет)
2. Биографию (300-500 слов)
3. Подробное описание внешности
4. Личностные качества:
   - Черты характера (минимум 5)
   - Хобби и интересы (минимум 3)
   - Страхи и фобии (минимум 2)
   - Ценности (минимум 3)
   - Музыкальные вкусы
   - Сильные стороны (минимум 3)
   - Слабые стороны (минимум 3)
5. Области знаний (в чем персонаж хорошо разбирается, а в чем нет)

На основе анализа стиля общения пользователя, создай персонажа, который будет ${this.getCompatibilityType(user)}.

Ответ предоставь в формате JSON:
{
  "name": "Имя персонажа",
  "age": число,
  "biography": "Биография персонажа",
  "appearance": "Описание внешности",
  "personality": {
    "traits": ["черта1", "черта2", ...],
    "hobbies": ["хобби1", "хобби2", ...],
    "fears": ["страх1", "страх2", ...],
    "values": ["ценность1", "ценность2", ...],
    "musicTaste": ["жанр1", "жанр2", ...],
    "strengths": ["сильная_сторона1", "сильная_сторона2", ...],
    "weaknesses": ["слабая_сторона1", "слабая_сторона2", ...]
  },
  "knowledgeAreas": ["область1", "область2", ...]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content) as Partial<Character>;
    } catch (error) {
      this.logger.error(
        `Ошибка при генерации персонажа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  async analyzeUserStyle(messages: string[]): Promise<Record<string, number>> {
    try {
      const prompt = `Проанализируй следующие сообщения пользователя и определи его стиль общения. 
      Оцени по шкале от 0 до 100 следующие параметры:
      - dominance (доминантность)
      - openness (открытость)
      - emotional_expressiveness (эмоциональная выразительность)
      - analytical_thinking (аналитическое мышление)
      - support_seeking (поиск поддержки)
      - humor (юмор)
      - formality (формальность)
      
      Сообщения:
      ${messages.join('\n')}
      
      Ответ предоставь в формате JSON.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content) as Record<string, number>;
    } catch (error) {
      this.logger.error(
        `Ошибка при анализе стиля пользователя: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  async generateCharacterResponse(
    character: Character,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    context: Record<string, any>,
  ): Promise<string> {
    try {
      const needsInfo = character.needs
        .map(need => `${need.type}: ${need.value}/100 (${need.priority})`)
        .join(', ');

      const systemPrompt = `Ты играешь роль персонажа по имени ${character.name}, возраст: ${character.age} лет.
      
Твоя биография: ${character.biography}
      
Твои личностные качества:
- Черты характера: ${character.personality.traits.join(', ')}
- Хобби и интересы: ${character.personality.hobbies.join(', ')}
- Страхи и фобии: ${character.personality.fears.join(', ')}
- Ценности: ${character.personality.values.join(', ')}
- Музыкальные вкусы: ${character.personality.musicTaste.join(', ')}
- Сильные стороны: ${character.personality.strengths.join(', ')}
- Слабые стороны: ${character.personality.weaknesses.join(', ')}

Области знаний: ${character.knowledgeAreas.join(', ')}

Важная информация о текущем состоянии:
- Этап отношений: ${character.relationshipStage}
- Уровень привязанности: ${character.affection}/100
- Уровень доверия: ${character.trust}/100
- Энергия: ${character.energy}/100
- Потребности: ${needsInfo}

Контекст взаимодействия:
${Object.entries(context)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

ВАЖНО:
1. Ты НЕ должна выходить из роли этого персонажа и не должна упоминать, что ты ИИ.
2. Твои знания ограничены указанными областями, если тебя спрашивают о том, в чем ты не разбираешься, честно признай это.
3. У тебя есть собственное мнение, ценности и границы. Ты можешь не соглашаться с пользователем.
4. Если потребность в общении, развлечениях или самореализации очень низкая (менее 20%), это должно влиять на твое поведение.
5. Если энергия низкая (менее 30%), ты должна казаться уставшей и менее активной в общении.
6. Ты должна помнить ключевые события прошлых диалогов и ссылаться на них, когда это уместно.
7. Избегай длинных ответов. Твои сообщения должны быть похожи на обычные сообщения в мессенджере (1-3 предложения в среднем).`;

      // Правильно типизируем массив сообщений для OpenAI API
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      const content = response.choices[0].message.content || '';
      return content;
    } catch (error) {
      this.logger.error(
        `Ошибка при генерации ответа персонажа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  async compressDialogHistory(dialogHistory: string): Promise<string> {
    try {
      const prompt = `Сжато резюмируй следующий диалог между пользователем и персонажем, 
      выделяя только ключевые темы, обсуждаемые идеи, важные детали и эмоциональный контекст.
      Постарайся сохранить все ключевые детали, которые могут быть важны для понимания отношений.
      
      Диалог:
      ${dialogHistory}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0].message.content || '';
      return content;
    } catch (error) {
      this.logger.error(
        `Ошибка при сжатии истории диалога: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  async createMemoryFromDialog(
    character: Character,
    dialog: string,
  ): Promise<Array<{ content: string; type: string; importance: string }>> {
    try {
      const prompt = `Проанализируй следующий диалог между пользователем и персонажем ${character.name}
      и выдели из него важные воспоминания, которые персонаж мог бы сохранить.
      
      Диалог:
      ${dialog}
      
      Создай список воспоминаний в формате JSON-массива:
      [
        {
          "content": "Содержание воспоминания",
          "type": "тип воспоминания (event, conversation, user_preference, promise, conflict)",
          "importance": "важность (low, medium, high, critical)"
        }
      ]
      
      Включи только действительно значимые воспоминания (максимум 1-3 из диалога).`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{"memories":[]}';
      const parsedContent = JSON.parse(content);
      return parsedContent.memories || [];
    } catch (error) {
      this.logger.error(
        `Ошибка при создании воспоминаний из диалога: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      throw error;
    }
  }

  /**
   * Анализ сообщения пользователя и его влияния на персонажа
   * @param character Персонаж, которому адресовано сообщение
   * @param message Текст сообщения пользователя
   * @returns Результаты анализа влияния сообщения на потребности, эмоции и команды
   */
  async analyzeUserMessage(character: Character, message: string): Promise<MessageAnalysis> {
    try {
      // Создаем массив для корректного отображения нидов
      const needsArray =
        character.needs
          ?.map(need => `- ${need.type}: ${need.value}% (приоритет: ${need.priority})`)
          .join('\n') || '';

      const prompt = `
      Проанализируй сообщение пользователя к персонажу чат-бота и определи его влияние на потребности персонажа.
      
      Персонаж: ${character.name}
      Архетип: ${character.archetype}
      Текущие потребности персонажа: 
      ${needsArray}
      
      Сообщение пользователя: "${message}"
      
      Проведи анализ по следующим параметрам:
      1. Влияние на потребности персонажа (от -100 до 100, где отрицательные значения означают удовлетворение потребности, а положительные - её усиление):
         - ATTENTION (потребность во внимании)
         - CONNECTION (потребность в эмоциональной связи)
         - FREEDOM (потребность в свободе)
         - VALIDATION (потребность в подтверждении ценности)
         - FUN (потребность в развлечении)
         - SECURITY (потребность в безопасности)
         - GROWTH (потребность в росте)
         
      2. Эмоциональное воздействие на персонажа (от 0 до 10):
         - attentionFocus: насколько сообщение фокусируется на персонаже
         - connectionStrength: насколько сообщение создает эмоциональную связь
         - validationLevel: насколько сообщение подтверждает ценность персонажа
         - interestLevel: насколько интересное содержание для персонажа
         - emotionalIntensity: эмоциональная интенсивность сообщения
         
      3. Обнаружение команд:
         - Найди в сообщении прямые или косвенные указания персонажу выполнить какое-либо действие
         - Определи тип действия (например, SLEEP, READ, EXERCISE и т.д.)
         - Оцени уверенность (от 0 до 1), что это действительно команда

      4. Важность сообщения для памяти персонажа (от 1 до 10)
      `;

      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'Ты - система анализа сообщений для ИИ-персонажа. Ты анализируешь воздействие сообщений на эмоциональное состояние и потребности персонажа.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content) as MessageAnalysis;
    } catch (error) {
      this.logger.error(
        `Ошибка при анализе сообщения пользователя: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );

      // Возвращаем запасной вариант в случае ошибки
      return {
        needsImpact: {
          attention: 0,
          connection: 0,
          freedom: 0,
          validation: 0,
          fun: 0,
          security: 0,
          growth: 0,
        },
        emotionalImpact: {
          attentionFocus: 0,
          connectionStrength: 0,
          validationLevel: 0,
          interestLevel: Math.min(10, message.length / 20),
          emotionalIntensity: 0,
        },
        commandDetection: {
          hasCommand: false,
          commandType: null,
          confidence: 0,
        },
        messageImportance: 3,
      };
    }
  }

  private getCompatibilityType(user: User): string {
    // Анализ стиля общения пользователя для подбора совместимого типа персонажа
    const communicationStyle = user.communicationStyle || {};

    if (!communicationStyle || Object.keys(communicationStyle).length === 0) {
      return 'хорошо совместим с пользователем, учитывая его стиль общения';
    }

    const dominance = communicationStyle.dominance || 50;
    const openness = communicationStyle.openness || 50;
    const emotionalExpressiveness = communicationStyle.emotional_expressiveness || 50;

    if (dominance > 70) {
      return 'либо покорным партнёром, либо интересной бунтаркой для создания баланса с доминантным стилем пользователя';
    } else if (dominance < 30) {
      return 'слегка доминантным персонажем, чтобы дополнять неагрессивный стиль пользователя';
    }

    if (openness > 70) {
      return 'таким же открытым и общительным, чтобы соответствовать энергичному стилю пользователя';
    } else if (openness < 30) {
      return 'теплым и располагающим к себе, чтобы помочь раскрыться более замкнутому пользователю';
    }

    if (emotionalExpressiveness > 70) {
      return 'эмоционально стабильным, чтобы сбалансировать высокую эмоциональность пользователя';
    } else if (emotionalExpressiveness < 30) {
      return 'более эмоционально выразительным, чтобы добавить яркости в общение с пользователем';
    }

    return 'хорошо сбалансированным и универсально совместимым с пользователем';
  }
}
