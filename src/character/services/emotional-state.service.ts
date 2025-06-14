import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
import { EmotionalState } from '../entities/emotional-state';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { LogService } from '../../logging/log.service';
import { MessageAnalysis } from '../interfaces/analysis.interfaces';

/**
 * Контекстные факторы для эмоциональных проявлений согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalContext {
  socialSetting: 'private' | 'public' | 'group' | 'intimate'; // Социальная обстановка
  relationshipLevel: number; // Уровень близости отношений (0-100%)
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'; // Время суток
  characterEnergy: number; // Уровень энергии персонажа (0-100%)
  recentEvents: string[]; // Недавние события, влияющие на эмоции
  environmentalFactors: string[]; // Факторы окружения
}

/**
 * Воздействие на эмоциональное состояние согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalImpact {
  intensity: number; // Интенсивность воздействия (0-100%)
  duration: number; // Продолжительность в минутах
  fadeRate: number; // Скорость затухания (0-100% в час)
  emotionalType: string; // Тип эмоции
  triggers: string[]; // Триггеры, вызвавшие эмоцию
  manifestations: EmotionalManifestation[]; // Проявления эмоции
}

/**
 * Интерфейс для прямого обновления эмоционального состояния
 */
export interface EmotionalUpdate {
  /** Карта эмоций и их интенсивности */
  emotions: Record<string, number>;
  /** Источник эмоционального обновления */
  source: string;
  /** Описание эмоционального обновления */
  description: string;
}

/**
 * Проявления эмоций в зависимости от контекста согласно ТЗ СОСТОЯНИЕ
 */
export interface EmotionalManifestation {
  context: EmotionalContext;
  behaviorChanges: {
    speechPattern: string; // Изменение речевых паттернов
    responseStyle: string; // Стиль ответов
    topicPreferences: string[]; // Предпочтения в темах
    socialBehavior: string; // Социальное поведение
  };
  physicalSigns: string[]; // Физические признаки эмоции
  cognitiveEffects: {
    attentionFocus: string; // Фокус внимания
    memoryBias: string; // Искажение памяти
    decisionMaking: string; // Влияние на принятие решений
  };
}

/**
 * Сервис для управления эмоциональным состоянием персонажа
 */
@Injectable()
export class EmotionalStateService {
  private readonly logService: LogService;

  // Кэш эмоциональных состояний по ID персонажа
  private emotionalStates: Map<number, EmotionalState> = new Map();

  // Система градуального воздействия согласно ТЗ СОСТОЯНИЕ
  private activeEmotionalImpacts: Map<number, EmotionalImpact[]> = new Map();
  private emotionalContexts: Map<number, EmotionalContext> = new Map();
  private emotionalTimers: Map<number, NodeJS.Timeout[]> = new Map();

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    logService: LogService,
  ) {
    this.logService = logService.setContext(EmotionalStateService.name);
  }

  /**
   * Получает текущее эмоциональное состояние персонажа
   */
  async getEmotionalState(characterId: number): Promise<EmotionalState> {
    // Проверяем кэш сначала
    if (this.emotionalStates.has(characterId)) {
      return this.emotionalStates.get(characterId);
    }

    return withErrorHandling(
      async () => {
        // Дополнительная проверка в базе данных
        const character = await this.characterRepository.findOneBy({ id: characterId });
        if (!character) {
          throw new Error(`Character with id ${characterId} not found`);
        }

        // Создаем базовое состояние
        const defaultState: EmotionalState = {
          primary: 'нейтральная',
          intensity: 3,
          secondary: '',
          description: 'Спокойное, уравновешенное состояние',
        };

        this.emotionalStates.set(characterId, defaultState);
        return defaultState;
      },
      'получении эмоционального состояния персонажа',
      this.logService,
      { characterId },
      this.getDefaultEmotionalState(),
    );
  }

  /**
   * Обновляет эмоциональное состояние персонажа на основе анализа сообщения
   */
  async updateEmotionalState(
    characterId: number,
    analysisOrUpdate: MessageAnalysis | EmotionalUpdate,
  ): Promise<EmotionalState> {
    return withErrorHandling(
      async () => {
        // Получаем текущее эмоциональное состояние
        const currentState = await this.getEmotionalState(characterId);
        
        // Проверяем, является ли объект EmotionalUpdate
        if ('emotions' in analysisOrUpdate && 'source' in analysisOrUpdate) {
          return this.updateFromEmotionalUpdate(characterId, currentState, analysisOrUpdate);
        }
        
        // В противном случае это MessageAnalysis
        const analysis = analysisOrUpdate as MessageAnalysis;
        
        // Используем эмоциональный анализ из нового формата
        const emotionalAnalysis = analysis.emotionalAnalysis;
        if (!emotionalAnalysis || emotionalAnalysis.userMood === 'neutral') {
          return currentState;
        }

        // Разбираем эмоциональную реакцию из анализа
        const emotion = this.parseEmotionalReaction(emotionalAnalysis.expectedEmotionalResponse);

        // Рассчитываем интенсивность на основе срочности сообщения и эмоциональной интенсивности
        const intensity = this.calculateNewIntensity(
          currentState.intensity,
          Math.round(analysis.urgency * 10), // конвертируем 0-1 в 0-10
        );

        // Формируем новое эмоциональное состояние
        const newState: EmotionalState = {
          primary: emotion.primary,
          secondary: emotion.secondary?.[0] || '',
          intensity,
          description: this.generateEmotionalDescription(emotion.primary, intensity),
        };

        // Сохраняем в кэш
        this.emotionalStates.set(characterId, newState);

        return newState;
      },
      'обновлении эмоционального состояния персонажа',
      this.logService,
      { characterId, analysis: analysisOrUpdate },
      this.emotionalStates.get(characterId) || this.getDefaultEmotionalState(),
    );
  }

  /**
   * Обновляет эмоциональное состояние персонажа на основе прямого эмоционального обновления
   */
  private updateFromEmotionalUpdate(
    characterId: number, 
    currentState: EmotionalState, 
    update: EmotionalUpdate
  ): EmotionalState {
    // Находим самую интенсивную эмоцию
    let primaryEmotion = '';
    let maxIntensity = 0;
    
    for (const [emotion, intensity] of Object.entries(update.emotions)) {
      if (intensity > maxIntensity) {
        primaryEmotion = emotion;
        maxIntensity = intensity;
      }
    }
    
    if (!primaryEmotion) {
      return currentState;
    }
    
    // Находим вторую по интенсивности эмоцию
    let secondaryEmotion = '';
    let secondMaxIntensity = 0;
    
    for (const [emotion, intensity] of Object.entries(update.emotions)) {
      if (intensity > secondMaxIntensity && emotion !== primaryEmotion) {
        secondaryEmotion = emotion;
        secondMaxIntensity = intensity;
      }
    }
    
    // Рассчитываем новую интенсивность
    const newIntensity = Math.max(1, Math.min(10, Math.round(maxIntensity / 10)));
    
    // Формируем новое эмоциональное состояние
    const newState: EmotionalState = {
      primary: primaryEmotion,
      secondary: secondaryEmotion,
      intensity: newIntensity,
      description: update.description || this.generateEmotionalDescription(primaryEmotion, newIntensity),
    };
    
    // Сохраняем в кэш
    this.emotionalStates.set(characterId, newState);
    
    return newState;
  }

  /**
   * Постепенно возвращает эмоциональное состояние к нейтральному
   */
  async normalizeEmotionalState(characterId: number): Promise<EmotionalState> {
    return withErrorHandling(
      async () => {
        const currentState = await this.getEmotionalState(characterId);

        // Если текущая интенсивность низкая, возвращаем к нейтральному состоянию
        if (currentState.intensity <= 2) {
          const neutralState: EmotionalState = {
            primary: 'нейтральная',
            intensity: 1,
            secondary: '',
            description: 'Спокойное, уравновешенное состояние',
          };

          this.emotionalStates.set(characterId, neutralState);
          return neutralState;
        }

        // Иначе постепенно снижаем интенсивность
        const newIntensity = Math.max(1, currentState.intensity - 1);
        const newState: EmotionalState = {
          ...currentState,
          intensity: newIntensity,
          description: this.generateEmotionalDescription(currentState.primary, newIntensity),
        };

        this.emotionalStates.set(characterId, newState);
        return newState;
      },
      'нормализации эмоционального состояния',
      this.logService,
      { characterId },
      this.getDefaultEmotionalState(),
    );
  }

  /**
   * Получает дефолтное эмоциональное состояние
   * @private
   */
  private getDefaultEmotionalState(): EmotionalState {
    return {
      primary: 'нейтральная',
      intensity: 3,
      secondary: '',
      description: 'Спокойное, уравновешенное состояние',
    };
  }

  /**
   * Парсит эмоциональную реакцию из анализа сообщения
   */
  private parseEmotionalReaction(emotionalReaction: string): {
    primary: string;
    secondary?: string[];
  } {
    // Если строка пустая, возвращаем "нейтральная"
    if (!emotionalReaction || emotionalReaction.trim() === '') {
      return { primary: 'нейтральная' };
    }

    // Проверяем, есть ли в тексте указание на несколько эмоций (через запятую)
    if (emotionalReaction.includes(',')) {
      const emotions = emotionalReaction.split(',').map(e => e.trim());
      return {
        primary: emotions[0] || 'нейтральная',
        secondary: emotions.slice(1).filter(e => e && e.trim() !== ''),
      };
    }

    // Если запятых нет, возвращаем единственную эмоцию
    return { primary: emotionalReaction.trim() };
  }

  /**
   * Рассчитывает новую интенсивность эмоции
   */
  private calculateNewIntensity(currentIntensity: number, messageImportance: number): number {
    // Нормализуем важность сообщения к шкале интенсивности (1-10)
    const normalizedImportance = messageImportance;

    // Средняя между текущей интенсивностью и важностью сообщения
    // Это создает более плавный переход эмоций
    return Math.round((currentIntensity + normalizedImportance) / 2);
  }

  /**
   * Генерирует текстовое описание эмоционального состояния
   */
  private generateEmotionalDescription(emotion: string, intensity: number): string {
    if (intensity <= 2) {
      return `Лёгкое чувство ${emotion}`;
    } else if (intensity <= 5) {
      return `Умеренное чувство ${emotion}`;
    } else if (intensity <= 8) {
      return `Сильное чувство ${emotion}`;
    } else {
      return `Очень сильное чувство ${emotion}`;
    }
  }

  /**
   * Применяет градуальное эмоциональное воздействие согласно ТЗ СОСТОЯНИЕ
   */
  async applyGradualEmotionalImpact(
    characterId: number,
    impact: EmotionalImpact,
    context: EmotionalContext,
  ): Promise<EmotionalState> {
    return withErrorHandling(
      async () => {
        // Сохраняем контекст
        this.emotionalContexts.set(characterId, context);

        // Добавляем воздействие к активным
        const existingImpacts = this.activeEmotionalImpacts.get(characterId) || [];
        existingImpacts.push(impact);
        this.activeEmotionalImpacts.set(characterId, existingImpacts);

        // Создаем проявления эмоции в зависимости от контекста
        const manifestations = this.generateContextualManifestations(impact, context);
        impact.manifestations = manifestations;

        // Применяем немедленное воздействие
        const currentState = await this.getEmotionalState(characterId);
        const newState = this.calculateEmotionalStateWithImpacts(characterId, currentState);

        // Устанавливаем таймер для постепенного затухания
        this.setupEmotionalFadeTimer(characterId, impact);

        this.logService.debug(
          `Применено градуальное эмоциональное воздействие для персонажа ${characterId}: ${impact.emotionalType} (${impact.intensity}%)`,
        );

        return newState;
      },
      'применении градуального эмоционального воздействия',
      this.logService,
      { characterId, impactType: impact.emotionalType, intensity: impact.intensity },
      this.getDefaultEmotionalState(),
    );
  }

  /**
   * Генерирует контекстно-зависимые проявления эмоций согласно ТЗ СОСТОЯНИЕ
   */
  private generateContextualManifestations(
    impact: EmotionalImpact,
    context: EmotionalContext,
  ): EmotionalManifestation[] {
    const manifestation: EmotionalManifestation = {
      context,
      behaviorChanges: this.generateBehaviorChanges(impact.emotionalType, context),
      physicalSigns: this.generatePhysicalSigns(impact.emotionalType, impact.intensity),
      cognitiveEffects: this.generateCognitiveEffects(impact.emotionalType, impact.intensity),
    };

    return [manifestation];
  }

  /**
   * Генерирует изменения в поведении на основе эмоции и контекста
   */
  private generateBehaviorChanges(emotionalType: string, context: EmotionalContext) {
    const baseChanges = {
      speechPattern: 'обычный',
      responseStyle: 'нейтральный',
      topicPreferences: [],
      socialBehavior: 'обычное',
    };

    // Адаптируем поведение в зависимости от эмоции
    switch (emotionalType.toLowerCase()) {
      case 'радость':
      case 'счастье':
        baseChanges.speechPattern =
          context.socialSetting === 'intimate' ? 'теплый и открытый' : 'позитивный и энергичный';
        baseChanges.responseStyle = 'оптимистичный';
        baseChanges.topicPreferences = ['позитивные воспоминания', 'планы на будущее', 'хобби'];
        baseChanges.socialBehavior = 'общительное и дружелюбное';
        break;

      case 'грусть':
      case 'печаль':
        baseChanges.speechPattern =
          context.socialSetting === 'private' ? 'тихий и задумчивый' : 'сдержанный';
        baseChanges.responseStyle = 'меланхоличный';
        baseChanges.topicPreferences = ['воспоминания', 'философские размышления'];
        baseChanges.socialBehavior =
          context.relationshipLevel > 70 ? 'ищущее поддержки' : 'замкнутое';
        break;

      case 'гнев':
      case 'злость':
        baseChanges.speechPattern =
          context.socialSetting === 'public' ? 'сдержанно-напряженный' : 'резкий и прямой';
        baseChanges.responseStyle = 'категоричный';
        baseChanges.topicPreferences = ['справедливость', 'проблемы'];
        baseChanges.socialBehavior = 'напористое или избегающее';
        break;

      case 'страх':
      case 'тревога':
        baseChanges.speechPattern = 'осторожный и неуверенный';
        baseChanges.responseStyle = 'осторожный';
        baseChanges.topicPreferences = ['безопасность', 'поддержка'];
        baseChanges.socialBehavior = 'ищущее защиты';
        break;

      default:
        // Оставляем базовые значения
        break;
    }

    return baseChanges;
  }

  /**
   * Генерирует физические признаки эмоции
   */
  private generatePhysicalSigns(emotionalType: string, intensity: number): string[] {
    const signs: string[] = [];
    const intensityFactor = intensity / 100;

    switch (emotionalType.toLowerCase()) {
      case 'радость':
      case 'счастье':
        if (intensityFactor > 0.3) signs.push('улыбка');
        if (intensityFactor > 0.6) signs.push('блеск в глазах');
        if (intensityFactor > 0.8) signs.push('оживленная жестикуляция');
        break;

      case 'грусть':
      case 'печаль':
        if (intensityFactor > 0.3) signs.push('опущенные плечи');
        if (intensityFactor > 0.6) signs.push('тихий голос');
        if (intensityFactor > 0.8) signs.push('слезы на глазах');
        break;

      case 'гнев':
      case 'злость':
        if (intensityFactor > 0.3) signs.push('напряженная поза');
        if (intensityFactor > 0.6) signs.push('сжатые кулаки');
        if (intensityFactor > 0.8) signs.push('покрасневшее лицо');
        break;

      case 'страх':
      case 'тревога':
        if (intensityFactor > 0.3) signs.push('беспокойные движения');
        if (intensityFactor > 0.6) signs.push('учащенное дыхание');
        if (intensityFactor > 0.8) signs.push('дрожь в голосе');
        break;
    }

    return signs;
  }

  /**
   * Генерирует когнитивные эффекты эмоции
   */
  private generateCognitiveEffects(emotionalType: string, intensity: number) {
    const effects = {
      attentionFocus: 'обычный',
      memoryBias: 'нейтральный',
      decisionMaking: 'рациональное',
    };

    const intensityFactor = intensity / 100;

    switch (emotionalType.toLowerCase()) {
      case 'радость':
      case 'счастье':
        effects.attentionFocus = 'на позитивных аспектах';
        effects.memoryBias = 'к приятным воспоминаниям';
        effects.decisionMaking = intensityFactor > 0.7 ? 'оптимистично-рискованное' : 'позитивное';
        break;

      case 'грусть':
      case 'печаль':
        effects.attentionFocus = 'на проблемах и потерях';
        effects.memoryBias = 'к грустным воспоминаниям';
        effects.decisionMaking = 'осторожное и пессимистичное';
        break;

      case 'гнев':
      case 'злость':
        effects.attentionFocus = 'на источниках раздражения';
        effects.memoryBias = 'к негативным событиям';
        effects.decisionMaking = intensityFactor > 0.6 ? 'импульсивное' : 'агрессивное';
        break;

      case 'страх':
      case 'тревога':
        effects.attentionFocus = 'на потенциальных угрозах';
        effects.memoryBias = 'к опасным ситуациям';
        effects.decisionMaking = 'избегающее рисков';
        break;
    }

    return effects;
  }

  /**
   * Рассчитывает эмоциональное состояние с учетом всех активных воздействий
   */
  private calculateEmotionalStateWithImpacts(
    characterId: number,
    baseState: EmotionalState,
  ): EmotionalState {
    const impacts = this.activeEmotionalImpacts.get(characterId) || [];

    if (impacts.length === 0) {
      return baseState;
    }

    // Находим доминирующее воздействие
    const dominantImpact = impacts.reduce((prev, current) =>
      current.intensity > prev.intensity ? current : prev,
    );

    // Рассчитываем общую интенсивность
    const totalIntensity = impacts.reduce((sum, impact) => sum + impact.intensity, 0);
    const normalizedIntensity = Math.min(100, totalIntensity);

    // Создаем новое состояние
    const newState: EmotionalState = {
      primary: dominantImpact.emotionalType,
      secondary: impacts.length > 1 ? impacts[1].emotionalType : '',
      intensity: Math.round(normalizedIntensity / 10), // Конвертируем в шкалу 1-10
      description: this.generateDetailedEmotionalDescription(impacts),
    };

    this.emotionalStates.set(characterId, newState);
    return newState;
  }

  /**
   * Генерирует детальное описание эмоционального состояния с учетом всех воздействий
   */
  private generateDetailedEmotionalDescription(impacts: EmotionalImpact[]): string {
    if (impacts.length === 0) {
      return 'Спокойное, уравновешенное состояние';
    }

    const dominantImpact = impacts[0];
    const intensityLevel = this.getIntensityLevel(dominantImpact.intensity);

    let description = `${intensityLevel} ${dominantImpact.emotionalType}`;

    if (impacts.length > 1) {
      const secondaryEmotions = impacts.slice(1).map(impact => impact.emotionalType);
      description += ` с оттенками ${secondaryEmotions.join(', ')}`;
    }

    return description;
  }

  /**
   * Получает текстовое описание уровня интенсивности
   */
  private getIntensityLevel(intensity: number): string {
    if (intensity <= 20) return 'Легкое чувство';
    if (intensity <= 40) return 'Умеренное чувство';
    if (intensity <= 60) return 'Заметное чувство';
    if (intensity <= 80) return 'Сильное чувство';
    return 'Очень сильное чувство';
  }

  /**
   * Устанавливает таймер для постепенного затухания эмоционального воздействия
   */
  private setupEmotionalFadeTimer(characterId: number, impact: EmotionalImpact): void {
    const fadeInterval = 60000; // 1 минута
    const fadeAmount = (impact.fadeRate / 60) * (impact.intensity / 100); // Процент затухания за минуту

    const timer = setInterval(() => {
      const impacts = this.activeEmotionalImpacts.get(characterId) || [];
      const impactIndex = impacts.findIndex(i => i === impact);

      if (impactIndex !== -1) {
        // Уменьшаем интенсивность
        impact.intensity = Math.max(0, impact.intensity - fadeAmount);

        // Если интенсивность упала до нуля, удаляем воздействие
        if (impact.intensity <= 0) {
          impacts.splice(impactIndex, 1);
          this.activeEmotionalImpacts.set(characterId, impacts);
          clearInterval(timer);

          // Удаляем таймер из списка
          const timers = this.emotionalTimers.get(characterId) || [];
          const timerIndex = timers.indexOf(timer);
          if (timerIndex !== -1) {
            timers.splice(timerIndex, 1);
            this.emotionalTimers.set(characterId, timers);
          }

          this.logService.debug(
            `Эмоциональное воздействие ${impact.emotionalType} затухло для персонажа ${characterId}`,
          );
        } else {
          // Обновляем эмоциональное состояние
          const currentState =
            this.emotionalStates.get(characterId) || this.getDefaultEmotionalState();
          this.calculateEmotionalStateWithImpacts(characterId, currentState);
        }
      } else {
        clearInterval(timer);
      }
    }, fadeInterval);

    // Сохраняем таймер
    const timers = this.emotionalTimers.get(characterId) || [];
    timers.push(timer);
    this.emotionalTimers.set(characterId, timers);
  }

  /**
   * Получает текущий эмоциональный контекст персонажа
   */
  getEmotionalContext(characterId: number): EmotionalContext | null {
    return this.emotionalContexts.get(characterId) || null;
  }

  /**
   * Получает активные эмоциональные воздействия персонажа
   */
  getActiveEmotionalImpacts(characterId: number): EmotionalImpact[] {
    return this.activeEmotionalImpacts.get(characterId) || [];
  }

  /**
   * Создает эмоциональный контекст на основе доступной информации
   */
  async createEmotionalContext(
    characterId: number,
    socialSetting: EmotionalContext['socialSetting'] = 'private',
    relationshipLevel: number = 50,
  ): Promise<EmotionalContext> {
    const now = new Date();
    const hour = now.getHours();

    let timeOfDay: EmotionalContext['timeOfDay'];
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const context: EmotionalContext = {
      socialSetting,
      relationshipLevel,
      timeOfDay,
      characterEnergy: 70, // Базовое значение, в полной реализации должно браться из Character
      recentEvents: [], // В полной реализации должно браться из памяти персонажа
      environmentalFactors: [], // В полной реализации должно учитывать окружение
    };

    this.emotionalContexts.set(characterId, context);
    return context;
  }

  /**
   * Очищает все эмоциональные воздействия персонажа
   */
  clearEmotionalImpacts(characterId: number): void {
    // Очищаем таймеры
    const timers = this.emotionalTimers.get(characterId) || [];
    timers.forEach(timer => clearInterval(timer));
    this.emotionalTimers.delete(characterId);

    // Очищаем воздействия
    this.activeEmotionalImpacts.delete(characterId);

    // Сбрасываем состояние к нейтральному
    this.emotionalStates.set(characterId, this.getDefaultEmotionalState());

    this.logService.debug(`Очищены все эмоциональные воздействия для персонажа ${characterId}`);
  }
}
