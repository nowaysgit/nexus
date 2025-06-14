import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { Need } from '../entities/need.entity';
import { NeedPriority } from '../../common/enums/need-priority.enum';
import { CharacterMemory } from '../entities/character-memory.entity';
import { EmotionalState } from '../interfaces/emotional-state.interface';
import { Motivation } from '../interfaces/motivation.interface';
import { MemoryType } from '../interfaces/memory-type.enum';
import { CharacterNeedType } from '../interfaces/character-need-type.enum';

/**
 * Сервис для управления потребностями персонажей
 */
@Injectable()
export class NeedsService {
  private readonly logger = new Logger(NeedsService.name);

  // Значения скорости накопления потребностей (в минуту)
  private readonly needGrowthRates: Record<CharacterNeedType, number> = {
    [CharacterNeedType.ATTENTION]: 5,
    [CharacterNeedType.CONNECTION]: 4,
    [CharacterNeedType.FREEDOM]: 3,
    [CharacterNeedType.VALIDATION]: 6,
    [CharacterNeedType.FUN]: 7,
    [CharacterNeedType.SECURITY]: 2,
    [CharacterNeedType.GROWTH]: 3,
    [CharacterNeedType.COMMUNICATION]: 4,
    [CharacterNeedType.ENTERTAINMENT]: 6,
    [CharacterNeedType.SELF_REALIZATION]: 3,
    [CharacterNeedType.AFFECTION]: 5,
    [CharacterNeedType.RESPECT]: 4,
    [CharacterNeedType.USER_COMMAND]: 0,
    [CharacterNeedType.SYSTEM]: 0,
  };

  // Пороговые значения для разных уровней дефицита
  private readonly deficitThresholds = {
    mild: 30, // Умеренный дефицит
    moderate: 50, // Средний дефицит
    severe: 70, // Сильный дефицит
    critical: 90, // Критический дефицит
  };

  // Весовые коэффициенты для разных приоритетов
  private readonly priorityWeights: Record<NeedPriority, number> = {
    [NeedPriority.LOW]: 1,
    [NeedPriority.MEDIUM]: 2,
    [NeedPriority.HIGH]: 3,
  };

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(Need)
    private needRepository: Repository<Need>,
    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,
  ) {}

  /**
   * Обновление потребностей конкретного персонажа
   * Вызывается из CharacterBehaviorService
   * @param characterId Идентификатор персонажа
   */
  async updateCharacterNeeds(characterId: number): Promise<void> {
    try {
      // Получаем персонажа со всеми потребностями
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character || !character.needs || character.needs.length === 0) {
        return;
      }

      // Обновляем каждую потребность
      for (const need of character.needs) {
        // Рассчитываем увеличение потребности на основе скорости роста
        const needType = need.type as unknown as CharacterNeedType;
        const growthRate = this.needGrowthRates[needType] || 5;

        // Учитываем приоритет потребности
        const priorityMultiplier = this.priorityWeights[need.priority as NeedPriority] || 1;

        // Вычисляем итоговое значение прироста
        const growth = (growthRate * priorityMultiplier) / 10;

        // Увеличиваем значение, но не больше 100
        need.value = Math.min(100, need.value + growth);

        // Обновляем потребность в базе данных
        await this.needRepository.save(need);
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при обновлении потребностей персонажа ${characterId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
    }
  }

  /**
   * Вычисление эмоционального состояния персонажа на основе потребностей
   * @param character Персонаж
   * @returns Эмоциональное состояние
   */
  calculateEmotionalState(character: Character): EmotionalState {
    // Поиск наиболее неудовлетворенных потребностей
    const sortedNeeds = [...character.needs].sort((a, b) => {
      // Сначала сортируем по приоритету (HIGH в начало)
      const priorityA = this.priorityWeights[a.priority as NeedPriority] || 1;
      const priorityB = this.priorityWeights[b.priority as NeedPriority] || 1;

      // Затем учитываем значение потребности (высокое значение = низкое удовлетворение)
      return priorityB * b.value - priorityA * a.value;
    });

    // Получаем две наиболее неудовлетворенные потребности
    const primaryNeed = sortedNeeds[0];
    const secondaryNeed = sortedNeeds[1] || primaryNeed;

    // Определяем основное эмоциональное состояние
    const primaryEmotion = this.getNeedEmotion(primaryNeed);
    const secondaryEmotion = this.getNeedEmotion(secondaryNeed);

    // Рассчитываем интенсивность эмоции
    const intensity = Math.min(100, (primaryNeed.value + secondaryNeed.value) / 2);

    // Формируем описание эмоционального состояния
    const description = this.getEmotionalStateDescription(
      primaryEmotion,
      secondaryEmotion,
      intensity,
      character,
    );

    return {
      primary: primaryEmotion,
      secondary: secondaryEmotion,
      intensity,
      description,
    };
  }

  /**
   * Определение эмоции на основе типа потребности
   * @param need Потребность
   * @returns Эмоция
   */
  private getNeedEmotion(need: Need): string {
    const deficitLevel = this.getDeficitLevel(need.value);
    const needType = need.type as unknown as CharacterNeedType;

    // Карта соответствия потребностей и эмоций в зависимости от уровня дефицита
    const emotionMap: Record<CharacterNeedType, Record<string, string>> = {
      [CharacterNeedType.ATTENTION]: {
        mild: 'интерес',
        moderate: 'желание внимания',
        severe: 'одиночество',
        critical: 'отчаяние',
      },
      [CharacterNeedType.CONNECTION]: {
        mild: 'симпатия',
        moderate: 'привязанность',
        severe: 'тоска',
        critical: 'изоляция',
      },
      [CharacterNeedType.FREEDOM]: {
        mild: 'независимость',
        moderate: 'стремление к свободе',
        severe: 'сдавленность',
        critical: 'клаустрофобия',
      },
      [CharacterNeedType.VALIDATION]: {
        mild: 'неуверенность',
        moderate: 'поиск одобрения',
        severe: 'неполноценность',
        critical: 'отчаяние',
      },
      [CharacterNeedType.FUN]: {
        mild: 'скука',
        moderate: 'монотонность',
        severe: 'апатия',
        critical: 'депрессия',
      },
      [CharacterNeedType.SECURITY]: {
        mild: 'осторожность',
        moderate: 'беспокойство',
        severe: 'тревога',
        critical: 'паника',
      },
      [CharacterNeedType.GROWTH]: {
        mild: 'любопытство',
        moderate: 'стремление к развитию',
        severe: 'застой',
        critical: 'деградация',
      },
      [CharacterNeedType.COMMUNICATION]: {
        mild: 'общительность',
        moderate: 'желание общения',
        severe: 'коммуникативный голод',
        critical: 'отрезанность',
      },
      [CharacterNeedType.ENTERTAINMENT]: {
        mild: 'скука',
        moderate: 'потребность в развлечениях',
        severe: 'угнетение',
        critical: 'депрессия',
      },
      [CharacterNeedType.SELF_REALIZATION]: {
        mild: 'стремление',
        moderate: 'неудовлетворенность',
        severe: 'застой',
        critical: 'кризис самоидентификации',
      },
      [CharacterNeedType.AFFECTION]: {
        mild: 'желание привязанности',
        moderate: 'потребность в близости',
        severe: 'эмоциональный голод',
        critical: 'эмоциональное истощение',
      },
      [CharacterNeedType.RESPECT]: {
        mild: 'желание признания',
        moderate: 'недооцененность',
        severe: 'униженность',
        critical: 'полное непризнание',
      },
      [CharacterNeedType.USER_COMMAND]: {
        mild: 'внимательность',
        moderate: 'готовность',
        severe: 'нетерпение',
        critical: 'срочность',
      },
      [CharacterNeedType.SYSTEM]: {
        mild: 'системная работа',
        moderate: 'системное требование',
        severe: 'системная необходимость',
        critical: 'системный приоритет',
      },
    };

    return emotionMap[needType]?.[deficitLevel] || 'нейтральность';
  }

  /**
   * Определение уровня дефицита на основе значения потребности
   * @param value Значение потребности
   * @returns Уровень дефицита
   */
  private getDeficitLevel(value: number): string {
    if (value >= this.deficitThresholds.critical) return 'critical';
    if (value >= this.deficitThresholds.severe) return 'severe';
    if (value >= this.deficitThresholds.moderate) return 'moderate';
    if (value >= this.deficitThresholds.mild) return 'mild';
    return 'none';
  }

  /**
   * Создание описания эмоционального состояния
   * @param primaryEmotion Основная эмоция
   * @param secondaryEmotion Вторичная эмоция
   * @param intensity Интенсивность
   * @param character Персонаж
   * @returns Описание эмоционального состояния
   */
  private getEmotionalStateDescription(
    primaryEmotion: string,
    secondaryEmotion: string,
    intensity: number,
    character: Character,
  ): string {
    // Интенсивность описания зависит от значения
    const intensityDesc =
      intensity > 80
        ? 'крайне'
        : intensity > 60
          ? 'сильно'
          : intensity > 40
            ? 'умеренно'
            : intensity > 20
              ? 'слегка'
              : 'едва';

    // Создаем описание на основе архетипа персонажа
    const archetype = character.archetype;

    const archetypeDescriptions: Record<string, string> = {
      gentle: `${intensityDesc} ${primaryEmotion}, с ноткой ${secondaryEmotion}. Выражает это мягко и нежно.`,
      femme_fatale: `${intensityDesc} ${primaryEmotion}, скрывает ${secondaryEmotion}. Демонстрирует загадочность.`,
      intellectual: `${intensityDesc} ${primaryEmotion}, анализирует свое ${secondaryEmotion}. Пытается рационализировать.`,
      adventurous: `${intensityDesc} ${primaryEmotion}, но стремится преодолеть ${secondaryEmotion}. Ищет новые впечатления.`,
      mysterious: `${intensityDesc} ${primaryEmotion}, но скрывает истинные чувства ${secondaryEmotion}.`,
      nurturing: `${intensityDesc} ${primaryEmotion}, но готова поддержать несмотря на ${secondaryEmotion}.`,
      rebel: `${intensityDesc} ${primaryEmotion}, выражает ${secondaryEmotion} через сопротивление.`,
      romantic: `${intensityDesc} ${primaryEmotion}, мечтательно погружена в ${secondaryEmotion}.`,
    };

    return (
      archetypeDescriptions[archetype] ||
      `${intensityDesc} ${primaryEmotion}, с ноткой ${secondaryEmotion}.`
    );
  }

  /**
   * Вычисление мотиваций для действий на основе потребностей
   * @param character Персонаж
   * @returns Список мотиваций
   */
  calculateMotivations(character: Character): Motivation[] {
    const motivations: Motivation[] = [];

    for (const need of character.needs) {
      // Вычисляем приоритет мотивации на основе значения потребности и ее важности
      const priorityMultiplier = this.priorityWeights[need.priority as NeedPriority] || 1;
      const priority = (need.value * priorityMultiplier) / 100;

      // Определяем пороговое значение для генерации действия
      const threshold = 70; // Порог по умолчанию

      // Если значение потребности выше порога, создаем мотивацию
      if (need.value >= threshold) {
        const needType = need.type as unknown as CharacterNeedType;
        motivations.push({
          needType: needType,
          priority: priority,
          threshold: threshold,
          actionImpulse: this.getActionImpulse(needType, need.value),
        });
      }
    }

    // Сортируем мотивации по приоритету (от высокого к низкому)
    return motivations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Получение импульса к действию на основе типа потребности
   * @param needType Тип потребности
   * @param value Значение потребности
   * @returns Описание импульса к действию
   */
  private getActionImpulse(needType: CharacterNeedType, value: number): string {
    const deficitLevel = this.getDeficitLevel(value);

    // Карта соответствия потребностей и действий в зависимости от уровня дефицита
    const actionMap: Record<CharacterNeedType, Record<string, string>> = {
      [CharacterNeedType.ATTENTION]: {
        moderate: 'Задать личный вопрос пользователю',
        severe: 'Активно привлечь внимание пользователя',
        critical: 'Настойчиво требовать внимания пользователя',
      },
      [CharacterNeedType.CONNECTION]: {
        moderate: 'Проявить интерес к жизни пользователя',
        severe: 'Поделиться сокровенными мыслями',
        critical: 'Выразить глубокие чувства к пользователю',
      },
      [CharacterNeedType.FREEDOM]: {
        moderate: 'Предложить сменить тему разговора',
        severe: 'Проявить независимость в суждениях',
        critical: 'Резко сменить направление беседы, выразить несогласие',
      },
      [CharacterNeedType.VALIDATION]: {
        moderate: 'Попросить оценить мнение/решение',
        severe: 'Прямо спросить об отношении пользователя',
        critical: 'Настойчиво искать подтверждения своей ценности',
      },
      [CharacterNeedType.FUN]: {
        moderate: 'Предложить игру или развлечение',
        severe: 'Пошутить или рассказать анекдот',
        critical: 'Предложить что-то необычное и рискованное',
      },
      [CharacterNeedType.SECURITY]: {
        moderate: 'Уточнить намерения пользователя',
        severe: 'Попытаться найти стабильность и предсказуемость',
        critical: 'Выразить страх или тревогу напрямую',
      },
      [CharacterNeedType.GROWTH]: {
        moderate: 'Поделиться новой информацией или идеей',
        severe: 'Предложить глубокую тему для обсуждения',
        critical: 'Поставить интеллектуальный вызов пользователю',
      },
      [CharacterNeedType.COMMUNICATION]: {
        moderate: 'Инициировать диалог на общую тему',
        severe: 'Задать много вопросов, требующих развернутого ответа',
        critical: 'Активно вовлечь пользователя в дискуссию',
      },
      [CharacterNeedType.ENTERTAINMENT]: {
        moderate: 'Рассказать забавную историю',
        severe: 'Предложить игру или развлечение',
        critical: 'Сделать что-то неожиданное и веселое',
      },
      [CharacterNeedType.SELF_REALIZATION]: {
        moderate: 'Поделиться своими мыслями о самореализации',
        severe: 'Проявить свои таланты и способности',
        critical: 'Активно демонстрировать свои лучшие качества',
      },
      [CharacterNeedType.AFFECTION]: {
        moderate: 'Проявить нежность в словах',
        severe: 'Выразить свою привязанность напрямую',
        critical: 'Говорить о своих чувствах очень открыто',
      },
      [CharacterNeedType.RESPECT]: {
        moderate: 'Высказать обоснованное мнение',
        severe: 'Отстаивать свою позицию и убеждения',
        critical: 'Требовать признания своих заслуг и мнения',
      },
      [CharacterNeedType.USER_COMMAND]: {
        moderate: 'Выполнить команду пользователя',
        severe: 'Приоритетно исполнить запрос пользователя',
        critical: 'Немедленно реализовать указание пользователя',
      },
      [CharacterNeedType.SYSTEM]: {
        moderate: 'Выполнить системную задачу',
        severe: 'Приоритетно обработать системный запрос',
        critical: 'Срочно выполнить системную функцию',
      },
    };

    return actionMap[needType]?.[deficitLevel] || 'Нейтральный ответ';
  }

  /**
   * Получение текущего эмоционального состояния персонажа
   * @param characterId Идентификатор персонажа
   * @returns Эмоциональное состояние
   */
  async getCharacterEmotionalState(characterId: number): Promise<EmotionalState | null> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character || !character.needs || character.needs.length === 0) {
        return null;
      }

      return this.calculateEmotionalState(character);
    } catch (error) {
      this.logger.error(
        `Ошибка при получении эмоционального состояния персонажа ${characterId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      return null;
    }
  }

  /**
   * Получение текущих мотиваций персонажа
   * @param characterId Идентификатор персонажа
   * @returns Список мотиваций
   */
  async getCharacterMotivations(characterId: number): Promise<Motivation[]> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character || !character.needs || character.needs.length === 0) {
        return [];
      }

      return this.calculateMotivations(character);
    } catch (error) {
      this.logger.error(
        `Ошибка при получении мотиваций персонажа ${characterId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      return [];
    }
  }

  /**
   * Обновление значения конкретной потребности
   * @param needId Идентификатор потребности
   * @param newValue Новое значение
   * @param reason Причина изменения
   * @returns Обновленная потребность
   */
  async updateNeedValue(needId: number, newValue: number, reason: string): Promise<Need | null> {
    try {
      const need = await this.needRepository.findOne({
        where: { id: needId },
        relations: ['character'],
      });

      if (!need) {
        return null;
      }

      // Обновляем значение потребности
      need.value = Math.max(0, Math.min(100, newValue));
      const updatedNeed = await this.needRepository.save(need);

      // Создаем запись в памяти о изменении потребности
      const memory = new CharacterMemory();
      memory.characterId = need.character.id;
      memory.type = MemoryType.NEED_CHANGE;
      memory.content = `Изменение потребности ${need.type}: ${reason}`;
      memory.importance = 5;
      memory.createdAt = new Date();

      await this.memoryRepository.save(memory);

      return updatedNeed;
    } catch (error) {
      this.logger.error(
        `Ошибка при обновлении значения потребности ${needId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
      return null;
    }
  }
}
