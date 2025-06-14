import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { CharacterMemory } from '../entities/character-memory.entity';
import { OpenaiService } from '../../openai/openai.service';
import { NeedsService } from './needs.service';
import { TelegramService } from '../../telegram/telegram.service';
import { EmotionalState, Motivation } from '../entities/emotional-state';

// Типы действий персонажа
export enum CharacterActionType {
  // Виртуальные действия
  SLEEP = 'sleep',
  WORK = 'work',
  HOBBY = 'hobby',
  RELAX = 'relax',
  EXERCISE = 'exercise',
  REFLECT = 'reflect',

  // Действия коммуникации
  INITIATE_CONVERSATION = 'initiate_conversation',
  ASK_QUESTION = 'ask_question',
  SHARE_THOUGHTS = 'share_thoughts',
  EXPRESS_EMOTION = 'express_emotion',
  CONFESS = 'confess',
  APOLOGIZE = 'apologize',
  TEASE = 'tease',
  JOKE = 'joke',
}

// Интерфейс действия
export interface CharacterAction {
  type: CharacterActionType;
  description: string;
  duration: number; // длительность в минутах
  needImpact: { type: string; value: number }[]; // влияние на потребности
  priority: number; // 0-100
  emotionalStateRequired?: string[]; // список требуемых эмоциональных состояний
  requiresUser?: boolean; // требуется ли присутствие пользователя
  message?: string; // сообщение для пользователя (если есть)
}

@Injectable()
export class CharacterActionService {
  private readonly logger = new Logger(CharacterActionService.name);

  // Карта активных действий: characterId -> действие
  private activeActions: Map<number, CharacterAction> = new Map();

  // Таймеры действий: characterId -> NodeJS.Timeout
  private actionTimers: Map<number, NodeJS.Timeout> = new Map();

  // Кэш состояний чата: characterId -> { chatId: number, isActive: boolean }
  private characterChatStates: Map<number, { chatId: number; isActive: boolean }> = new Map();

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
    private openaiService: OpenaiService,
    private needsService: NeedsService,
    private telegramService: TelegramService,
  ) {}

  // Запуск системы действий персонажей
  async startActionSystem(): Promise<void> {
    this.logger.log('Запуск системы действий персонажей');

    // Запускаем периодическую проверку для автоматических действий
    setInterval(() => this.checkCharactersForActions(), 300000); // каждые 5 минут
  }

  // Проверка персонажей на необходимость инициализации действий
  private async checkCharactersForActions(): Promise<void> {
    try {
      // Получаем всех персонажей
      const characters = await this.characterRepository.find({
        relations: ['needs'],
      });

      this.logger.log(`Проверка необходимости действий для ${characters.length} персонажей`);

      // Проверяем каждого персонажа
      for (const character of characters) {
        // Пропускаем персонажей, которые уже выполняют действие
        if (this.activeActions.has(character.id)) {
          continue;
        }

        // Получаем текущие мотивации персонажа
        const motivations = await this.needsService.getCharacterMotivations(character.id);

        // Получаем эмоциональное состояние персонажа
        const emotionalState = await this.needsService.getCharacterEmotionalState(character.id);

        // Если есть мотивации и эмоциональное состояние
        if (motivations.length > 0 && emotionalState) {
          // Определяем подходящее действие
          const action = await this.determineAction(character, motivations, emotionalState);

          // Если действие определено, выполняем его
          if (action) {
            this.performAction(character, action);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при проверке действий персонажей: ${error.message}`);
    }
  }

  // Определение подходящего действия на основе мотиваций и эмоционального состояния
  private async determineAction(
    character: Character,
    motivations: Motivation[],
    emotionalState: EmotionalState,
  ): Promise<CharacterAction | null> {
    try {
      // Получаем последние воспоминания персонажа
      const memories = await this.memoryRepository.find({
        where: { characterId: character.id, isActive: true },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // Формируем запрос к OpenAI для определения действия
      const prompt = `Ты играешь роль персонажа ${character.name} и должен решить, какое действие совершить.

Информация о персонаже:
- Имя: ${character.name}
- Возраст: ${character.age}
- Архетип: ${character.archetype}
- Черты характера: ${character.personality.traits.join(', ')}
- Хобби: ${character.personality.hobbies.join(', ')}
- Страхи: ${character.personality.fears.join(', ')}

Текущее эмоциональное состояние:
- Основная эмоция: ${emotionalState.primary}
- Вторичная эмоция: ${emotionalState.secondary}
- Интенсивность: ${emotionalState.intensity}/100
- Описание: ${emotionalState.description}

Текущие мотивации (от наиболее приоритетной к наименее):
${motivations.map((m, i) => `${i + 1}. ${m.actionImpulse} (приоритет: ${m.priority}/100, тип потребности: ${m.needType})`).join('\n')}

Последние воспоминания:
${memories.map(m => `- ${m.content} (важность: ${m.importance}/10, тип: ${m.type})`).join('\n')}

Состояние чата с пользователем: ${this.characterChatStates.get(character.id)?.isActive ? 'активен' : 'неактивен'}

Выбери одно действие, которое персонаж должен предпринять в данный момент:
1. Виртуальное действие (сон, работа, хобби, отдых, упражнения, размышление)
2. Инициирование общения с пользователем (задать вопрос, поделиться мыслями, выразить эмоцию, признаться, извиниться, дразнить, пошутить)

Ответ должен быть в формате JSON:
{
  "type": "тип_действия",
  "description": "детальное описание действия",
  "duration": число_минут,
  "needImpact": [
    {"type": "тип_потребности", "value": изменение_(-100 до 100)},
    ...
  ],
  "priority": число_0_100,
  "requiresUser": true/false,
  "message": "сообщение пользователю (если это действие коммуникации)"
}`;

      // Отправляем запрос к OpenAI
      const response = await this.openaiService.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      // Парсим ответ
      const content = response.choices[0].message.content;
      const actionData = JSON.parse(content);

      // Создаем и возвращаем действие
      return {
        type: actionData.type as CharacterActionType,
        description: actionData.description,
        duration: actionData.duration,
        needImpact: actionData.needImpact,
        priority: actionData.priority,
        requiresUser: actionData.requiresUser,
        message: actionData.message,
      };
    } catch (error) {
      this.logger.error(`Ошибка при определении действия для ${character.name}: ${error.message}`);
      return null;
    }
  }

  // Выполнение действия
  private async performAction(character: Character, action: CharacterAction): Promise<void> {
    try {
      // Сохраняем действие в активные
      this.activeActions.set(character.id, action);

      // Логируем начало действия
      this.logger.log(
        `Персонаж ${character.name} (ID: ${character.id}) начинает действие: ${action.description}`,
      );

      // Создаем запись о действии в памяти персонажа
      await this.createActionMemory(character.id, action);

      // Проверяем, требуется ли пользователь для действия
      if (action.requiresUser && action.message) {
        // Получаем состояние чата персонажа
        const chatState = this.characterChatStates.get(character.id);

        // Если чат активен, отправляем сообщение
        if (chatState && chatState.isActive) {
          await this.telegramService.sendMessage(chatState.chatId, action.message);

          // Создаем запись в памяти о сообщении
          await this.createMessageMemory(character.id, action.message);
        }
      }

      // Устанавливаем таймер для завершения действия
      const timer = setTimeout(
        async () => {
          await this.completeAction(character.id, action);
        },
        action.duration * 60 * 1000,
      ); // переводим минуты в миллисекунды

      // Сохраняем таймер
      this.actionTimers.set(character.id, timer);
    } catch (error) {
      this.logger.error(`Ошибка при выполнении действия для ${character.name}: ${error.message}`);
      // Удаляем действие из активных в случае ошибки
      this.activeActions.delete(character.id);
    }
  }

  // Завершение действия
  private async completeAction(characterId: number, action: CharacterAction): Promise<void> {
    try {
      // Получаем персонажа
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });

      if (!character) {
        this.logger.error(`Персонаж с ID ${characterId} не найден при завершении действия`);
        return;
      }

      this.logger.log(
        `Персонаж ${character.name} (ID: ${characterId}) завершает действие: ${action.description}`,
      );

      // Обновляем потребности персонажа в соответствии с влиянием действия
      for (const impact of action.needImpact) {
        // Находим потребность по типу
        const need = character.needs.find(n => n.type === impact.type);

        if (need) {
          // Обновляем значение потребности
          await this.needsService.updateNeedValue(
            need.id,
            need.value + impact.value,
            `Влияние действия: ${action.description}`,
          );
        }
      }

      // Создаем запись о завершении действия
      await this.createActionCompletionMemory(characterId, action);

      // Удаляем действие из активных
      this.activeActions.delete(characterId);

      // Удаляем таймер
      this.actionTimers.delete(characterId);
    } catch (error) {
      this.logger.error(
        `Ошибка при завершении действия для персонажа ${characterId}: ${error.message}`,
      );
      // В любом случае удаляем действие из активных
      this.activeActions.delete(characterId);
      this.actionTimers.delete(characterId);
    }
  }

  // Создание записи о действии в памяти персонажа
  private async createActionMemory(characterId: number, action: CharacterAction): Promise<void> {
    const memory = new CharacterMemory();
    memory.characterId = characterId;
    memory.type = 'event';
    memory.content = `Начато действие: ${action.description}`;
    memory.importance = 5;
    memory.createdAt = new Date();

    await this.memoryRepository.save(memory);
  }

  // Создание записи о завершении действия
  private async createActionCompletionMemory(
    characterId: number,
    action: CharacterAction,
  ): Promise<void> {
    const memory = new CharacterMemory();
    memory.characterId = characterId;
    memory.type = 'event';
    memory.content = `Завершено действие: ${action.description}`;
    memory.importance = 4;
    memory.createdAt = new Date();

    await this.memoryRepository.save(memory);
  }

  // Создание записи о сообщении в памяти персонажа
  private async createMessageMemory(characterId: number, message: string): Promise<void> {
    const memory = new CharacterMemory();
    memory.characterId = characterId;
    memory.type = 'conversation';
    memory.content = `Отправлено сообщение: "${message}"`;
    memory.importance = 6;
    memory.createdAt = new Date();

    await this.memoryRepository.save(memory);
  }

  // Обновление состояния чата персонажа
  async updateChatState(characterId: number, chatId: number, isActive: boolean): Promise<void> {
    this.characterChatStates.set(characterId, { chatId, isActive });
  }

  // Проверка, выполняет ли персонаж виртуальное действие
  async isPerformingVirtualAction(
    characterId: number,
  ): Promise<{ performing: boolean; action?: CharacterAction }> {
    const action = this.activeActions.get(characterId);

    if (!action) {
      return { performing: false };
    }

    // Проверяем, является ли действие виртуальным
    const virtualActions = [
      CharacterActionType.SLEEP,
      CharacterActionType.WORK,
      CharacterActionType.HOBBY,
      CharacterActionType.RELAX,
      CharacterActionType.EXERCISE,
      CharacterActionType.REFLECT,
    ];

    const isVirtual = virtualActions.includes(action.type);

    return {
      performing: isVirtual,
      action: isVirtual ? action : undefined,
    };
  }

  // Прерывание действия персонажа (если пользователь прервал его)
  async interruptAction(characterId: number): Promise<void> {
    // Проверяем, выполняет ли персонаж действие
    if (!this.activeActions.has(characterId)) {
      return;
    }

    // Получаем действие
    const action = this.activeActions.get(characterId);

    // Удаляем таймер
    const timer = this.actionTimers.get(characterId);
    if (timer) {
      clearTimeout(timer);
      this.actionTimers.delete(characterId);
    }

    // Получаем персонажа
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
    });

    if (!character) {
      this.logger.error(`Персонаж с ID ${characterId} не найден при прерывании действия`);
      this.activeActions.delete(characterId);
      return;
    }

    this.logger.log(
      `Действие персонажа ${character.name} (ID: ${characterId}) прервано: ${action.description}`,
    );

    // Создаем запись о прерывании действия
    const memory = new CharacterMemory();
    memory.characterId = characterId;
    memory.type = 'event';
    memory.content = `Действие прервано пользователем: ${action.description}`;
    memory.importance = 7;
    memory.createdAt = new Date();

    await this.memoryRepository.save(memory);

    // Удаляем действие из активных
    this.activeActions.delete(characterId);
  }

  // Генерация инициативного сообщения от персонажа
  async generateInitiativeMessage(characterId: number): Promise<string | null> {
    try {
      // Получаем персонажа
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character) {
        this.logger.error(`Персонаж с ID ${characterId} не найден при генерации сообщения`);
        return null;
      }

      // Получаем эмоциональное состояние
      const emotionalState = await this.needsService.getCharacterEmotionalState(characterId);

      // Получаем мотивации
      const motivations = await this.needsService.getCharacterMotivations(characterId);

      // Получаем последние воспоминания
      const memories = await this.memoryRepository.find({
        where: { characterId: characterId, isActive: true },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // Формируем запрос к OpenAI
      const prompt = `Ты играешь роль персонажа ${character.name} и должен сгенерировать сообщение для пользователя, которое персонаж отправит по собственной инициативе.

Информация о персонаже:
- Имя: ${character.name}
- Возраст: ${character.age}
- Архетип: ${character.archetype}
- Черты характера: ${character.personality.traits.join(', ')}
- Хобби: ${character.personality.hobbies.join(', ')}
- Страхи: ${character.personality.fears.join(', ')}

Текущее эмоциональное состояние:
${
  emotionalState
    ? `
- Основная эмоция: ${emotionalState.primary}
- Вторичная эмоция: ${emotionalState.secondary}
- Интенсивность: ${emotionalState.intensity}/100
- Описание: ${emotionalState.description}
`
    : '- Нейтральное состояние'
}

${
  motivations.length > 0
    ? `Текущие мотивации (от наиболее приоритетной к наименее):
${motivations.map((m, i) => `${i + 1}. ${m.actionImpulse} (приоритет: ${m.priority}/100, тип потребности: ${m.needType})`).join('\n')}
`
    : 'Нет активных мотиваций.'
}

Последние воспоминания:
${memories.map(m => `- ${m.content} (важность: ${m.importance}/10, тип: ${m.type})`).join('\n')}

Напиши одно сообщение от имени персонажа, которое он отправит пользователю по собственной инициативе. Сообщение должно:
1. Соответствовать текущему эмоциональному состоянию персонажа
2. Отражать его основную мотивацию
3. Учитывать последние воспоминания
4. Быть естественным, как в обычном чате (1-3 предложения)
5. НЕ содержать упоминаний о том, что персонаж является ИИ

Важно: Сгенерируй ТОЛЬКО текст сообщения без дополнительных описаний.`;

      // Отправляем запрос к OpenAI
      const response = await this.openaiService.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 150,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      this.logger.error(`Ошибка при генерации инициативного сообщения: ${error.message}`);
      return null;
    }
  }
}
