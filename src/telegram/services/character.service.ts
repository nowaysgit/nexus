import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../../character/entities/character.entity';
import { Need } from '../../character/entities/need.entity';
import { CharacterMemory } from '../../character/entities/character-memory.entity';
import { Context } from '../interfaces/context.interface';
import { MessageService } from './message.service';
import { OpenAIService } from '../../openai/openai.service';
import { CharacterArchetype } from '../../common/enums/character-archetype.enum';
import { RelationshipStage } from '../../common/enums/relationship-stage.enum';
import { NeedType } from '../../common/enums/need-type.enum';
import { NeedPriority } from '../../common/enums/need-priority.enum';

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(Need)
    private needRepository: Repository<Need>,
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
    private messageService: MessageService,
    private openAIService: OpenAIService,
  ) {}

  // Получение персонажа по ID
  async getCharacterById(id: number): Promise<Character> {
    return await this.characterRepository.findOne({
      where: { id },
      relations: ['needs'],
    });
  }

  // Получение всех персонажей пользователя
  async getUserCharacters(userId: string): Promise<Character[]> {
    return await this.characterRepository.find({
      where: { userId },
      relations: ['needs'],
    });
  }

  // Создание нового персонажа
  async createCharacter(userId: string, archetype: CharacterArchetype): Promise<Character> {
    try {
      // Используем OpenAI для генерации данных персонажа
      const characterData = await this.generateCharacterData(archetype);

      // Создаем персонажа
      const character = new Character();
      character.userId = userId;
      character.archetype = archetype;
      character.name = characterData.name;
      character.age = characterData.age;
      character.biography = characterData.biography;
      character.appearance = characterData.appearance;
      character.personality = characterData.personality;
      character.affection = 50; // Начальное значение привязанности
      character.trust = 50; // Начальное значение доверия
      character.energy = 100; // Начальное значение энергии
      character.relationshipStage = RelationshipStage.ACQUAINTANCE;

      // Сохраняем персонажа
      const savedCharacter = await this.characterRepository.save(character);

      // Создаем потребности персонажа
      await this.createInitialNeeds(savedCharacter.id);

      // Создаем начальную память
      await this.createInitialMemory(savedCharacter.id);

      // Возвращаем созданного персонажа со всеми связями
      return await this.getCharacterById(savedCharacter.id);
    } catch (error) {
      this.logger.error(`Ошибка при создании персонажа: ${error.message}`);
      throw new Error(`Не удалось создать персонажа: ${error.message}`);
    }
  }

  // Генерация данных персонажа с помощью OpenAI
  private async generateCharacterData(archetype: CharacterArchetype): Promise<any> {
    const archetypeDescriptions = {
      [CharacterArchetype.GENTLE]: 'Нежная, спокойная, заботливая',
      [CharacterArchetype.FEMME_FATALE]: 'Роковая, страстная, загадочная',
      [CharacterArchetype.INTELLECTUAL]: 'Умная, рассудительная, образованная',
      [CharacterArchetype.ADVENTUROUS]: 'Авантюрная, смелая, энергичная',
      [CharacterArchetype.MYSTERIOUS]: 'Загадочная, интригующая, непредсказуемая',
      [CharacterArchetype.NURTURING]: 'Заботливая, материнская, поддерживающая',
      [CharacterArchetype.REBEL]: 'Бунтарка, независимая, своенравная',
      [CharacterArchetype.ROMANTIC]: 'Романтичная, мечтательная, чувственная',
    };

    const prompt = `Создай данные для персонажа-женщины архетипа "${archetypeDescriptions[archetype]}".
      Опиши её имя, возраст (от 25 до 35), биографию, внешность и личность.
      Ответ верни в формате JSON:
      {
        "name": "Имя персонажа",
        "age": возраст (число),
        "biography": "Детальная биография персонажа",
        "appearance": "Описание внешности",
        "personality": {
          "traits": ["черта1", "черта2", "черта3"],
          "hobbies": ["хобби1", "хобби2", "хобби3"],
          "fears": ["страх1", "страх2"],
          "values": ["ценность1", "ценность2", "ценность3"],
          "musicTaste": ["жанр1", "жанр2"]
        }
      }`;

    const response = await this.openAIService.generateText(prompt);

    try {
      return JSON.parse(response);
    } catch (error) {
      this.logger.error(`Ошибка при парсинге данных персонажа: ${error.message}`);
      throw new Error('Не удалось распознать ответ сервиса генерации персонажа');
    }
  }

  // Создание начальных потребностей персонажа
  private async createInitialNeeds(characterId: number): Promise<void> {
    const needsData = [
      {
        type: NeedType.ATTENTION,
        value: 70,
        priority: NeedPriority.HIGH,
      },
      {
        type: NeedType.CONNECTION,
        value: 60,
        priority: NeedPriority.MEDIUM,
      },
      {
        type: NeedType.FREEDOM,
        value: 80,
        priority: NeedPriority.LOW,
      },
      {
        type: NeedType.VALIDATION,
        value: 75,
        priority: NeedPriority.MEDIUM,
      },
      {
        type: NeedType.FUN,
        value: 85,
        priority: NeedPriority.HIGH,
      },
    ];

    for (const needData of needsData) {
      const need = new Need();
      need.characterId = characterId;
      need.type = needData.type;
      need.value = needData.value;
      need.priority = needData.priority;

      await this.needRepository.save(need);
    }
  }

  // Создание начальной памяти персонажа
  private async createInitialMemory(characterId: number): Promise<void> {
    const memory = new CharacterMemory();
    memory.characterId = characterId;
    memory.type = 'core_memory';
    memory.content = 'Первая встреча с пользователем';
    memory.importance = 10;
    memory.createdAt = new Date();

    await this.memoryRepository.save(memory);
  }

  // Показать информацию о персонаже
  async showCharacterInfo(ctx: Context, characterId: number): Promise<void> {
    try {
      const character = await this.getCharacterById(characterId);

      if (!character) {
        await ctx.reply('Персонаж не найден.');
        return;
      }

      await this.messageService.sendCharacterInfo(ctx, character);
    } catch (error) {
      this.logger.error(`Ошибка при показе персонажа: ${error.message}`);
      await ctx.reply('Произошла ошибка при загрузке персонажа. Попробуйте позже.');
    }
  }

  // Показать список персонажей пользователя
  async showUserCharacters(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from.id.toString();
      const characters = await this.getUserCharacters(userId);

      await this.messageService.sendCharacterList(ctx, characters);
    } catch (error) {
      this.logger.error(`Ошибка при показе списка персонажей: ${error.message}`);
      await ctx.reply('Произошла ошибка при загрузке персонажей. Попробуйте позже.');
    }
  }

  // Обновление потребностей персонажа
  async updateCharacterNeeds(characterId: number): Promise<void> {
    try {
      const character = await this.getCharacterById(characterId);

      if (!character) {
        return;
      }

      // Обновляем значения потребностей в зависимости от их приоритета
      for (const need of character.needs) {
        const decayRate = this.getNeedDecayRate(need.priority);
        need.value = Math.max(0, need.value - decayRate);

        await this.needRepository.save(need);
      }
    } catch (error) {
      this.logger.error(`Ошибка при обновлении потребностей: ${error.message}`);
    }
  }

  // Получение скорости деградации потребности в зависимости от приоритета
  private getNeedDecayRate(priority: NeedPriority): number {
    switch (priority) {
      case NeedPriority.HIGH:
        return 5;
      case NeedPriority.MEDIUM:
        return 3;
      case NeedPriority.LOW:
        return 1;
      default:
        return 2;
    }
  }
}
