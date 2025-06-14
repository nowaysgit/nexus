import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { CharacterManagementService } from '../../character/services/character-management.service';
import { Character } from '../../character/entities/character.entity';
import { CharacterArchetype } from '../../character/enums/character-archetype.enum';
import { CreateCharacterDto } from '../../character/dto/create-character.dto';

/**
 * Специализированный сервис для создания персонажей через Telegram
 * Инкапсулирует логику создания персонажей с предустановленными настройками
 */
@Injectable()
export class CharacterCreationService {
  constructor(
    private readonly characterManagementService: CharacterManagementService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(CharacterCreationService.name);
  }

  /**
   * Создает персонажа с заданным архетипом и стандартными настройками
   */
  async createCharacterWithArchetype(archetype: string, userId: number): Promise<Character> {
    try {
      const archetypeEnum = Object.values(CharacterArchetype).find(
        a => a.toLowerCase() === archetype.toLowerCase(),
      );

      if (!archetypeEnum) {
        throw new Error(`Неизвестный архетип: ${archetype}`);
      }

      // Получаем предустановленные настройки для архетипа
      const characterData = this.getArchetypePresets(archetypeEnum);

      // Создаем персонажа через CharacterManagementService
      const character = await this.characterManagementService.createCharacter(
        characterData,
        userId,
      );

      this.logService.log(
        `Персонаж ${character.name} (${archetypeEnum}) создан для пользователя ${userId}`,
      );
      return character;
    } catch (error) {
      this.logService.error('Ошибка создания персонажа с архетипом', {
        archetype,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает предустановленные настройки для архетипа
   */
  private getArchetypePresets(archetype: CharacterArchetype): CreateCharacterDto {
    const basePresets = {
      age: 25,
      appearance: 'Привлекательная внешность, подходящая под архетип',
      personality: {
        traits: ['дружелюбный', 'отзывчивый'],
        hobbies: ['общение'],
        fears: [],
        values: ['дружба'],
        musicTaste: [],
        strengths: ['эмпатия'],
        weaknesses: [],
      },
    };

    switch (archetype) {
      case CharacterArchetype.CAREGIVER:
        return {
          name: `Нежная`,
          archetype,
          biography: 'Добрая и мягкая личность, которая всегда готова поддержать и выслушать.',
          personality: {
            ...basePresets.personality,
            traits: ['нежная', 'заботливая', 'мягкая'],
            hobbies: ['чтение', 'садоводство'],
            values: ['доброта', 'гармония'],
            strengths: ['эмпатия', 'терпение'],
            weaknesses: ['излишняя мягкость'],
          },
          ...basePresets,
        };

      case CharacterArchetype.FEMME_FATALE:
        return {
          name: `Роковая женщина`,
          archetype,
          biography: 'Загадочная и соблазнительная личность, которая умеет очаровывать.',
          personality: {
            ...basePresets.personality,
            traits: ['загадочная', 'соблазнительная', 'уверенная'],
            hobbies: ['танцы', 'мода'],
            values: ['красота', 'власть'],
            strengths: ['харизма', 'обаяние'],
            weaknesses: ['гордость', 'манипулятивность'],
          },
          ...basePresets,
        };

      case CharacterArchetype.INTELLECTUAL:
        return {
          name: `Интеллектуал`,
          archetype,
          biography: 'Умная и образованная личность, стремящаяся к познанию и истине.',
          personality: {
            ...basePresets.personality,
            traits: ['умная', 'любознательная', 'аналитичная'],
            hobbies: ['чтение', 'исследования'],
            values: ['знания', 'истина'],
            strengths: ['интеллект', 'логика'],
            weaknesses: ['излишняя рациональность'],
          },
          ...basePresets,
        };

      case CharacterArchetype.EXPLORER:
        return {
          name: `Авантюрист`,
          archetype,
          biography: 'Смелая и энергичная личность, всегда готовая к новым приключениям.',
          personality: {
            ...basePresets.personality,
            traits: ['смелая', 'энергичная', 'авантюрная'],
            hobbies: ['путешествия', 'экстремальные виды спорта'],
            values: ['свобода', 'приключения'],
            strengths: ['смелость', 'решительность'],
            weaknesses: ['безрассудство', 'нетерпеливость'],
          },
          ...basePresets,
        };

      case CharacterArchetype.SEDUCTRESS:
        return {
          name: `Загадочная`,
          archetype,
          biography: 'Таинственная личность, которая хранит множество секретов.',
          personality: {
            ...basePresets.personality,
            traits: ['загадочная', 'скрытная', 'интригующая'],
            hobbies: ['астрология', 'психология'],
            values: ['тайны', 'глубина'],
            strengths: ['интуиция', 'наблюдательность'],
            weaknesses: ['недоверие', 'скрытность'],
          },
          ...basePresets,
        };

      case CharacterArchetype.CAREGIVER:
        return {
          name: `Заботливая`,
          archetype,
          biography: 'Материнская фигура, которая заботится о других и поддерживает их.',
          personality: {
            ...basePresets.personality,
            traits: ['заботливая', 'материнская', 'поддерживающая'],
            hobbies: ['кулинария', 'рукоделие'],
            values: ['семья', 'забота'],
            strengths: ['забота', 'поддержка'],
            weaknesses: ['чрезмерная опека'],
          },
          ...basePresets,
        };

      case CharacterArchetype.REBEL:
        return {
          name: `Бунтарка`,
          archetype,
          biography: 'Независимая личность, которая не боится идти против системы.',
          personality: {
            ...basePresets.personality,
            traits: ['бунтарская', 'независимая', 'смелая'],
            hobbies: ['музыка', 'искусство'],
            values: ['свобода', 'справедливость'],
            strengths: ['независимость', 'смелость'],
            weaknesses: ['упрямство', 'конфликтность'],
          },
          ...basePresets,
        };

      case CharacterArchetype.LOVER:
        return {
          name: `Романтичная`,
          archetype,
          biography: 'Мечтательная личность, которая верит в настоящую любовь.',
          personality: {
            ...basePresets.personality,
            traits: ['романтичная', 'мечтательная', 'чувствительная'],
            hobbies: ['поэзия', 'музыка'],
            values: ['любовь', 'красота'],
            strengths: ['чувствительность', 'романтичность'],
            weaknesses: ['наивность', 'идеализм'],
          },
          ...basePresets,
        };

      default:
        return {
          name: `Персонаж`,
          archetype: CharacterArchetype.CAREGIVER,
          biography: `Персонаж с неизвестным архетипом`,
          ...basePresets,
        };
    }
  }

  /**
   * Возвращает список доступных архетипов с описаниями
   */
  getAvailableArchetypes(): Array<{ archetype: CharacterArchetype; description: string }> {
    return [
      {
        archetype: CharacterArchetype.CAREGIVER,
        description: 'Нежная и заботливая личность',
      },
      {
        archetype: CharacterArchetype.FEMME_FATALE,
        description: 'Загадочная роковая женщина',
      },
      {
        archetype: CharacterArchetype.INTELLECTUAL,
        description: 'Умная и образованная личность',
      },
      {
        archetype: CharacterArchetype.EXPLORER,
        description: 'Смелая авантюристка',
      },
      {
        archetype: CharacterArchetype.SEDUCTRESS,
        description: 'Таинственная и интригующая',
      },
      {
        archetype: CharacterArchetype.CAREGIVER,
        description: 'Заботливая материнская фигура',
      },
      {
        archetype: CharacterArchetype.REBEL,
        description: 'Независимая бунтарка',
      },
      {
        archetype: CharacterArchetype.LOVER,
        description: 'Романтичная мечтательница',
      },
    ];
  }
}
