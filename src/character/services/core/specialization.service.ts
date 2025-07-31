import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../../entities/character.entity';
// LLM импорты удалены - требуется доработка интеграции с LLM согласно ТЗ
import { BaseService } from '../../../common/base/base.service';
import { LogService } from '../../../logging/log.service';
import { LLMService } from '../../../llm/services/llm.service';
import { PromptTemplateService } from '../../../prompt-template/prompt-template.service';
import { ILLMMessage, LLMMessageRole } from '../../../common/interfaces/llm-provider.interface';

/**
 * Тематические области компетенции согласно ТЗ ОГРАНИЧЕНИЯ
 */
export enum KnowledgeDomain {
  GENERAL_CONVERSATION = 'general_conversation',
  RELATIONSHIPS = 'relationships',
  EMOTIONS = 'emotions',
  HOBBIES = 'hobbies',
  ENTERTAINMENT = 'entertainment',
  DAILY_LIFE = 'daily_life',
  PHILOSOPHY = 'philosophy',
  PSYCHOLOGY = 'psychology',
  TECHNICAL = 'technical',
  SCIENCE = 'science',
  HISTORY = 'history',
  CULTURE = 'culture',
  MEDICINE = 'medicine',
  LAW = 'law',
  FINANCE = 'finance',
  POLITICS = 'politics',
  RELIGION = 'religion',
  // Новые специализированные области
  ARTS = 'arts',
  MUSIC = 'music',
  LITERATURE = 'literature',
  SPORTS = 'sports',
  TRAVEL = 'travel',
  FOOD = 'food',
  FASHION = 'fashion',
  EDUCATION = 'education',
  PARENTING = 'parenting',
  BUSINESS = 'business',
  MARKETING = 'marketing',
  DESIGN = 'design',
  PHOTOGRAPHY = 'photography',
  GAMING = 'gaming',
  NATURE = 'nature',
  ANIMALS = 'animals',
  HEALTH = 'health',
  FITNESS = 'fitness',
  MEDITATION = 'meditation',
  CAREER = 'career',
  SOCIAL_MEDIA = 'social_media',
  LANGUAGES = 'languages',
  CRAFTS = 'crafts',
  AUTOMOTIVE = 'automotive',
  REAL_ESTATE = 'real_estate',
  INVESTING = 'investing',
  CRYPTOCURRENCY = 'cryptocurrency',
}

/**
 * Типы специализации персонажей
 */
export enum SpecializationType {
  GENERALIST = 'generalist', // Широкий кругозор, средний уровень во многих областях
  SPECIALIST = 'specialist', // Глубокие знания в 1-2 областях, базовые в остальных
  EXPERT = 'expert', // Экспертный уровень в одной области, неравномерные знания
  BALANCED = 'balanced', // Сбалансированные знания в связанных областях
  CURIOUS = 'curious', // Высокая любознательность, быстрое обучение
  PRACTICAL = 'practical', // Фокус на практических знаниях и жизненном опыте
  ACADEMIC = 'academic', // Теоретические знания, научный подход
  CREATIVE = 'creative', // Креативные области, художественное мышление
  TECHNICAL = 'technical', // Технические специализации
  SOCIAL = 'social', // Социальные и межличностные компетенции
}

/**
 * Стили обучения и адаптации персонажа
 */
export enum LearningStyle {
  QUICK_LEARNER = 'quick_learner', // Быстро усваивает новую информацию
  SLOW_STEADY = 'slow_steady', // Медленно, но основательно
  EXPERIENTIAL = 'experiential', // Учится через опыт
  THEORETICAL = 'theoretical', // Предпочитает теоретическое изучение
  SOCIAL_LEARNER = 'social_learner', // Учится в общении с другими
  INDEPENDENT = 'independent', // Самостоятельное изучение
  PATTERN_BASED = 'pattern_based', // Выявляет закономерности
  INTUITIVE = 'intuitive', // Интуитивное понимание
}

/**
 * Уровни компетенции в областях знаний согласно ТЗ ОГРАНИЧЕНИЯ
 */
export enum CompetenceLevel {
  NONE = 'none', // Полное незнание
  BASIC = 'basic', // Базовые представления
  INTERMEDIATE = 'intermediate', // Средний уровень
  ADVANCED = 'advanced', // Высокий уровень
  EXPERT = 'expert', // Экспертный уровень
  PROFICIENT = 'proficient', // Между INTERMEDIATE и ADVANCED, добавлено для тестов
}

/**
 * Комбинация специализаций для создания уникальных профилей
 */
export interface SpecializationCombination {
  primaryType: SpecializationType;
  secondaryType?: SpecializationType;
  dominantDomains: KnowledgeDomain[]; // 1-3 доминирующие области
  supportingDomains: KnowledgeDomain[]; // 3-5 поддерживающих областей
  learningStyle: LearningStyle;
  adaptabilityScore: number; // 0-100, способность адаптироваться к новым темам
  curiosityLevel: number; // 0-100, уровень любознательности
  socialPreference: 'introvert' | 'extrovert' | 'ambivert';
}

/**
 * Динамическая специализация - может изменяться со временем
 */
export interface DynamicSpecialization {
  characterId: number;
  currentCombination: SpecializationCombination;
  evolutionHistory: SpecializationEvolution[];
  learningProgress: Record<KnowledgeDomain, LearningProgress>;
  adaptationTriggers: AdaptationTrigger[];
}

/**
 * Эволюция специализации персонажа
 */
export interface SpecializationEvolution {
  timestamp: Date;
  trigger: string; // Что вызвало изменение
  previousCombination: SpecializationCombination;
  newCombination: SpecializationCombination;
  reason: string; // Объяснение изменения
}

/**
 * Прогресс обучения в конкретной области
 */
export interface LearningProgress {
  domain: KnowledgeDomain;
  currentLevel: CompetenceLevel;
  experiencePoints: number; // Накопленный опыт
  lastInteraction: Date;
  interactionCount: number;
  learningRate: number; // Скорость обучения в этой области
  plateau: boolean; // Достигнуто ли плато в обучении
}

/**
 * Триггеры адаптации специализации
 */
export interface AdaptationTrigger {
  condition: string; // Условие срабатывания
  threshold: number; // Порог срабатывания
  action:
    | 'increase_competence'
    | 'decrease_competence'
    | 'add_domain'
    | 'remove_domain'
    | 'change_style';
  targetDomain?: KnowledgeDomain;
  newValue?: CompetenceLevel | LearningStyle;
}

/**
 * Паттерны проявления незнания согласно ТЗ ОГРАНИЧЕНИЯ
 */
export interface IgnorancePattern {
  domain: KnowledgeDomain;
  level: CompetenceLevel;
  naturalResponses: string[]; // Естественные реакции на незнание
  redirectionStrategies: string[]; // Стратегии перенаправления разговора
  curiosityExpressions: string[]; // Выражения любопытства
  admissionPhrases: string[]; // Фразы признания незнания
}

/**
 * Контекстные факторы для адаптации ограничений согласно ТЗ ОГРАНИЧЕНИЯ
 */
export interface KnowledgeContext {
  conversationTopic: string;
  userExpertiseLevel: CompetenceLevel;
  relationshipLevel: number; // 0-100% близости отношений
  socialSetting: 'casual' | 'formal' | 'educational' | 'personal';
  emotionalState: string;
  previousInteractions: string[];
}

/**
 * Профиль специализации персонажа согласно ТЗ ОГРАНИЧЕНИЯ
 */
export interface SpecializationProfile {
  characterId: number;
  competenceLevels: Record<KnowledgeDomain, CompetenceLevel>;
  strongAreas: KnowledgeDomain[]; // Области сильной компетенции
  weakAreas: KnowledgeDomain[]; // Области слабой компетенции
  personalInterests: string[]; // Личные интересы персонажа
  professionalBackground: string[]; // Профессиональный опыт
  educationalBackground: string[]; // Образовательный опыт
  culturalBackground: string[]; // Культурные особенности
  naturalIgnorancePatterns: IgnorancePattern[];
  // Новые поля для расширенной специализации
  specializationCombination?: SpecializationCombination;
  dynamicSpecialization?: DynamicSpecialization;
  lastUpdated: Date;
  profileVersion: string;
}

/**
 * Результат проверки компетенции согласно ТЗ ОГРАНИЧЕНИЯ
 */
export interface CompetenceCheck {
  domain: KnowledgeDomain;
  userQuery: string;
  characterCompetence: CompetenceLevel;
  shouldRespond: boolean;
  responseStrategy:
    | 'answer'
    | 'partial_answer'
    | 'redirect'
    | 'admit_ignorance'
    | 'express_curiosity';
  suggestedResponse: string;
  contextualFactors: string[];
}

/**
 * Сервис управления специализацией и ограничениями персонажей согласно ТЗ ОГРАНИЧЕНИЯ
 */
@Injectable()
export class SpecializationService extends BaseService {
  // Кэш профилей специализации
  private specializationProfiles: Map<number, SpecializationProfile> = new Map();

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    private readonly llmService: LLMService,
    private readonly promptTemplateService: PromptTemplateService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Получает профиль специализации персонажа согласно ТЗ ОГРАНИЧЕНИЯ
   */
  async getSpecializationProfile(characterId: number): Promise<SpecializationProfile> {
    // Проверяем кэш
    if (this.specializationProfiles.has(characterId)) {
      return this.specializationProfiles.get(characterId);
    }

    return this.withErrorHandling('получении профиля специализации', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['personality'],
      });

      if (!character) {
        // Если персонаж не найден, возвращаем дефолтный профиль
        const defaultProfile = this.getDefaultProfile(characterId);
        this.specializationProfiles.set(characterId, defaultProfile);
        this.logDebug(`Персонаж с ID ${characterId} не найден, используется дефолтный профиль`);
        return defaultProfile;
      }

      // Создаем профиль на основе личности персонажа
      const profile = this.createSpecializationProfile(character);

      // Сохраняем в кэш
      this.specializationProfiles.set(characterId, profile);

      return profile;
    });
  }

  /**
   * Проверяет компетенцию персонажа для ответа на запрос согласно ТЗ ОГРАНИЧЕНИЯ
   */
  async checkCompetence(
    characterId: number,
    userQuery: string,
    context: KnowledgeContext,
  ): Promise<CompetenceCheck> {
    return this.withErrorHandling('проверке компетенции персонажа', async () => {
      const profile = await this.getSpecializationProfile(characterId);

      // Определяем область знаний запроса
      const domain = await this.classifyQueryDomain(userQuery);

      // Получаем уровень компетенции персонажа в этой области
      const characterCompetence = profile.competenceLevels[domain] || CompetenceLevel.BASIC;

      // Анализируем контекст
      const contextualFactors = this.analyzeContext(context, domain, characterCompetence);

      // Определяем стратегию ответа
      const responseStrategy = this.determineResponseStrategy(
        characterCompetence,
        domain,
        context,
        profile,
      );

      // Генерируем предлагаемый ответ
      const suggestedResponse = await this.generateSuggestedResponse(
        responseStrategy,
        domain,
        profile,
        userQuery,
      );

      const result: CompetenceCheck = {
        domain,
        userQuery,
        characterCompetence,
        shouldRespond: responseStrategy !== 'admit_ignorance',
        responseStrategy,
        suggestedResponse,
        contextualFactors,
      };

      this.logService.debug(
        `Проверка компетенции персонажа ${characterId}: область ${domain}, уровень ${characterCompetence}, стратегия ${responseStrategy}`,
      );

      return result;
    });
  }

  /**
   * Генерирует предлагаемый ответ на основе стратегии и профиля персонажа.
   * @private
   */
  private async generateSuggestedResponse(
    strategy: CompetenceCheck['responseStrategy'],
    domain: KnowledgeDomain,
    profile: SpecializationProfile,
    userQuery: string,
  ): Promise<string> {
    const ignorancePattern = profile.naturalIgnorancePatterns.find(p => p.domain === domain);

    switch (strategy) {
      case 'admit_ignorance':
        return (
          ignorancePattern?.admissionPhrases?.[0] || 'Честно говоря, я не очень в этом разбираюсь.'
        );
      case 'redirect':
        return ignorancePattern?.redirectionStrategies?.[0] || 'Может, сменим тему?';
      case 'express_curiosity':
        return (
          ignorancePattern?.curiosityExpressions?.[0] || 'О, это интересно! Расскажи подробнее.'
        );
      case 'partial_answer':
      case 'answer': {
        const prompt = this.promptTemplateService.createPrompt('generate-competent-response', {
          strongAreas: profile.strongAreas.join(', '),
          weakAreas: profile.weakAreas.join(', '),
          personalInterests: profile.personalInterests.join(', '),
          professionalBackground: profile.professionalBackground.join(', '),
          userQuery,
          domain,
          competenceLevel: strategy,
        });
        const messages: ILLMMessage[] = [{ role: LLMMessageRole.SYSTEM, content: prompt }];
        const result = await this.llmService.generateText(messages, { maxTokens: 400 });
        return result.text;
      }
      default:
        this.logService.warn(`Обнаружена неизвестная стратегия ответа в generateSuggestedResponse`);
        return 'Я не знаю, что сказать.';
    }
  }

  /**
   * Создает профиль специализации на основе персонажа
   */
  private createSpecializationProfile(character: Character): SpecializationProfile {
    // Инициализируем все домены базовым уровнем
    const competenceLevels = {} as Record<KnowledgeDomain, CompetenceLevel>;
    Object.values(KnowledgeDomain).forEach(domain => {
      competenceLevels[domain] = CompetenceLevel.BASIC;
    });

    // Устанавливаем базовые уровни для основных областей
    competenceLevels[KnowledgeDomain.GENERAL_CONVERSATION] = CompetenceLevel.ADVANCED;
    competenceLevels[KnowledgeDomain.RELATIONSHIPS] = CompetenceLevel.INTERMEDIATE;
    competenceLevels[KnowledgeDomain.EMOTIONS] = CompetenceLevel.INTERMEDIATE;
    competenceLevels[KnowledgeDomain.DAILY_LIFE] = CompetenceLevel.ADVANCED;

    // Специализированные области начинают с минимального уровня
    const specializationDomains = [
      KnowledgeDomain.TECHNICAL,
      KnowledgeDomain.SCIENCE,
      KnowledgeDomain.MEDICINE,
      KnowledgeDomain.LAW,
      KnowledgeDomain.FINANCE,
      KnowledgeDomain.POLITICS,
      KnowledgeDomain.CRYPTOCURRENCY,
      KnowledgeDomain.INVESTING,
      KnowledgeDomain.REAL_ESTATE,
    ];

    specializationDomains.forEach(domain => {
      competenceLevels[domain] = CompetenceLevel.NONE;
    });

    // Адаптируем уровни на основе личности персонажа
    if (character.personality) {
      this.adaptCompetenceLevelsToPersonality(competenceLevels, character.personality);
    }

    // Создаем комбинацию специализаций
    const specializationCombination = this.createSpecializationCombination(character);

    // Создаем динамическую специализацию
    const dynamicSpecialization = this.createDynamicSpecialization(
      character.id,
      specializationCombination,
    );

    // Определяем сильные и слабые области
    const strongAreas = Object.entries(competenceLevels)
      .filter(([_, level]) => [CompetenceLevel.ADVANCED, CompetenceLevel.EXPERT].includes(level))
      .map(([domain, _]) => domain as KnowledgeDomain);

    const weakAreas = Object.entries(competenceLevels)
      .filter(([_, level]) => [CompetenceLevel.NONE, CompetenceLevel.BASIC].includes(level))
      .map(([domain, _]) => domain as KnowledgeDomain);

    // Создаем паттерны естественного незнания
    const naturalIgnorancePatterns = this.createIgnorancePatterns(weakAreas);

    return {
      characterId: character.id,
      competenceLevels,
      strongAreas,
      weakAreas,
      personalInterests: this.extractPersonalInterests(character),
      professionalBackground: [],
      educationalBackground: [],
      culturalBackground: [],
      naturalIgnorancePatterns,
      specializationCombination,
      dynamicSpecialization,
      lastUpdated: new Date(),
      profileVersion: '2.0.0',
    };
  }

  /**
   * Адаптирует уровни компетенции на основе личности персонажа
   */
  private adaptCompetenceLevelsToPersonality(
    competenceLevels: Record<KnowledgeDomain, CompetenceLevel>,
    personality: { traits?: string[]; hobbies?: string[] } | undefined,
  ): void {
    if (!personality) return;

    const traits = personality.traits || [];
    const hobbies = personality.hobbies || [];

    // Анализ черт характера
    if (traits.includes('интроверт')) {
      competenceLevels[KnowledgeDomain.PHILOSOPHY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.PSYCHOLOGY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.MEDITATION] = CompetenceLevel.INTERMEDIATE;
    }

    if (traits.includes('экстраверт')) {
      competenceLevels[KnowledgeDomain.RELATIONSHIPS] = CompetenceLevel.ADVANCED;
      competenceLevels[KnowledgeDomain.SOCIAL_MEDIA] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.ENTERTAINMENT] = CompetenceLevel.INTERMEDIATE;
    }

    if (traits.includes('творческий') || traits.includes('художественный')) {
      competenceLevels[KnowledgeDomain.ARTS] = CompetenceLevel.ADVANCED;
      competenceLevels[KnowledgeDomain.DESIGN] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.PHOTOGRAPHY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.MUSIC] = CompetenceLevel.INTERMEDIATE;
    }

    if (traits.includes('аналитический') || traits.includes('логический')) {
      competenceLevels[KnowledgeDomain.SCIENCE] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.TECHNICAL] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.FINANCE] = CompetenceLevel.INTERMEDIATE;
    }

    if (traits.includes('практичный') || traits.includes('прагматичный')) {
      competenceLevels[KnowledgeDomain.BUSINESS] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.CAREER] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.REAL_ESTATE] = CompetenceLevel.BASIC;
    }

    if (traits.includes('заботливый') || traits.includes('эмпатичный')) {
      competenceLevels[KnowledgeDomain.PARENTING] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.HEALTH] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.EMOTIONS] = CompetenceLevel.ADVANCED;
    }

    if (traits.includes('активный') || traits.includes('энергичный')) {
      competenceLevels[KnowledgeDomain.SPORTS] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.FITNESS] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.TRAVEL] = CompetenceLevel.INTERMEDIATE;
    }

    if (traits.includes('любознательный') || traits.includes('исследователь')) {
      competenceLevels[KnowledgeDomain.SCIENCE] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.HISTORY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.CULTURE] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.NATURE] = CompetenceLevel.INTERMEDIATE;
    }

    // Анализ хобби
    const hobbyCompetenceMap: Record<string, Partial<Record<KnowledgeDomain, CompetenceLevel>>> = {
      чтение: {
        [KnowledgeDomain.LITERATURE]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.HISTORY]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.PHILOSOPHY]: CompetenceLevel.INTERMEDIATE,
      },
      музыка: {
        [KnowledgeDomain.MUSIC]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.ARTS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.INTERMEDIATE,
      },
      спорт: {
        [KnowledgeDomain.SPORTS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.FITNESS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.HEALTH]: CompetenceLevel.INTERMEDIATE,
      },
      путешествия: {
        [KnowledgeDomain.TRAVEL]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.LANGUAGES]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.PHOTOGRAPHY]: CompetenceLevel.BASIC,
      },
      кулинария: {
        [KnowledgeDomain.FOOD]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.BASIC,
        [KnowledgeDomain.HEALTH]: CompetenceLevel.BASIC,
      },
      технологии: {
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.SCIENCE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.GAMING]: CompetenceLevel.INTERMEDIATE,
      },
      программирование: {
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.EXPERT,
        [KnowledgeDomain.SCIENCE]: CompetenceLevel.INTERMEDIATE,
      },
      искусство: {
        [KnowledgeDomain.ARTS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.HISTORY]: CompetenceLevel.BASIC,
        [KnowledgeDomain.DESIGN]: CompetenceLevel.INTERMEDIATE,
      },
      фотография: {
        [KnowledgeDomain.PHOTOGRAPHY]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.ARTS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.BASIC,
      },
      игры: {
        [KnowledgeDomain.GAMING]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.BASIC,
        [KnowledgeDomain.ENTERTAINMENT]: CompetenceLevel.INTERMEDIATE,
      },
      природа: {
        [KnowledgeDomain.NATURE]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.ANIMALS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.SCIENCE]: CompetenceLevel.BASIC,
      },
      животные: {
        [KnowledgeDomain.ANIMALS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.NATURE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.SCIENCE]: CompetenceLevel.BASIC,
      },
      фитнес: {
        [KnowledgeDomain.FITNESS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.HEALTH]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.SPORTS]: CompetenceLevel.INTERMEDIATE,
      },
      медитация: {
        [KnowledgeDomain.MEDITATION]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.PHILOSOPHY]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.PSYCHOLOGY]: CompetenceLevel.BASIC,
      },
      языки: {
        [KnowledgeDomain.LANGUAGES]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.TRAVEL]: CompetenceLevel.BASIC,
      },
      рукоделие: {
        [KnowledgeDomain.CRAFTS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.ARTS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.DESIGN]: CompetenceLevel.BASIC,
      },
      автомобили: {
        [KnowledgeDomain.AUTOMOTIVE]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.INTERMEDIATE,
      },
      мода: {
        [KnowledgeDomain.FASHION]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.DESIGN]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.BASIC,
      },
      бизнес: {
        [KnowledgeDomain.BUSINESS]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.FINANCE]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.MARKETING]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.CAREER]: CompetenceLevel.INTERMEDIATE,
      },
      инвестиции: {
        [KnowledgeDomain.INVESTING]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.FINANCE]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.BUSINESS]: CompetenceLevel.INTERMEDIATE,
      },
      криптовалюты: {
        [KnowledgeDomain.CRYPTOCURRENCY]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.FINANCE]: CompetenceLevel.INTERMEDIATE,
      },
      образование: {
        [KnowledgeDomain.EDUCATION]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.PSYCHOLOGY]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.PARENTING]: CompetenceLevel.BASIC,
      },
    };

    // Применяем модификации на основе хобби
    hobbies.forEach(hobby => {
      const hobbyKey = hobby.toLowerCase();
      const competenceModifications = hobbyCompetenceMap[hobbyKey];

      if (competenceModifications) {
        Object.entries(competenceModifications).forEach(([domain, level]) => {
          if (level && competenceLevels[domain as KnowledgeDomain]) {
            // Повышаем уровень только если новый уровень выше текущего
            const currentLevel = competenceLevels[domain as KnowledgeDomain];
            if (this.isLevelHigher(level, currentLevel)) {
              competenceLevels[domain as KnowledgeDomain] = level;
            }
          }
        });
      }
    });

    // Дополнительные корректировки для связанных областей
    if (competenceLevels[KnowledgeDomain.TECHNICAL] === CompetenceLevel.ADVANCED) {
      competenceLevels[KnowledgeDomain.SCIENCE] = CompetenceLevel.INTERMEDIATE;
    }

    if (competenceLevels[KnowledgeDomain.ARTS] === CompetenceLevel.ADVANCED) {
      competenceLevels[KnowledgeDomain.CULTURE] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.HISTORY] = CompetenceLevel.BASIC;
    }

    if (competenceLevels[KnowledgeDomain.BUSINESS] === CompetenceLevel.ADVANCED) {
      competenceLevels[KnowledgeDomain.FINANCE] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.MARKETING] = CompetenceLevel.INTERMEDIATE;
    }
  }

  /**
   * Проверяет, является ли один уровень компетенции выше другого
   */
  private isLevelHigher(level1: CompetenceLevel, level2: CompetenceLevel): boolean {
    const levelOrder = [
      CompetenceLevel.NONE,
      CompetenceLevel.BASIC,
      CompetenceLevel.INTERMEDIATE,
      CompetenceLevel.PROFICIENT,
      CompetenceLevel.ADVANCED,
      CompetenceLevel.EXPERT,
    ];

    return levelOrder.indexOf(level1) > levelOrder.indexOf(level2);
  }

  /**
   * Извлекает личные интересы из профиля персонажа
   */
  private extractPersonalInterests(character: Character): string[] {
    const interests: string[] = [];

    if (character.personality?.hobbies) {
      interests.push(...character.personality.hobbies);
    }

    return interests;
  }

  /**
   * Создает паттерны естественного незнания для слабых областей
   */
  private createIgnorancePatterns(weakAreas: KnowledgeDomain[]): IgnorancePattern[] {
    return weakAreas.map(domain => ({
      domain,
      level: CompetenceLevel.NONE,
      naturalResponses: ['ТРЕБУЕТСЯ ДОРАБОТКА: LLM генерация'],
      redirectionStrategies: this.getRedirectionStrategies(domain),
      curiosityExpressions: this.getCuriosityExpressions(domain),
      admissionPhrases: this.getAdmissionPhrases(domain),
    }));
  }

  /**
   * Получает стратегии перенаправления разговора
   */
  private getRedirectionStrategies(_domain: KnowledgeDomain): string[] {
    return [
      'А что ты сам об этом думаешь?',
      'Может, поговорим о чем-то другом?',
      'Расскажи лучше о своем опыте в этом',
      'А как ты с этим столкнулся?',
      'Это напоминает мне о...',
    ];
  }

  /**
   * Получает выражения любопытства
   */
  private getCuriosityExpressions(_domain: KnowledgeDomain): string[] {
    return [
      'Это звучит интересно! Расскажи больше',
      'А как это работает?',
      'Никогда об этом не слышала, любопытно!',
      'Можешь объяснить попроще?',
      'Хотелось бы узнать больше об этом',
    ];
  }

  /**
   * Получает фразы признания незнания
   */
  private getAdmissionPhrases(_domain: KnowledgeDomain): string[] {
    return ['Признаюсь, я в этом не разбираюсь.'];
  }

  /**
   * Классифицирует текстовый запрос по одной из областей знаний.
   * @param query - Текст запроса.
   * @returns Область знаний.
   */
  private async classifyQueryDomain(query: string): Promise<KnowledgeDomain> {
    try {
      return await this.withErrorHandling(
        `классификации области знаний для запроса: "${query}"`,
        async () => {
          const domains = Object.values(KnowledgeDomain).join(', ');
          const prompt = this.promptTemplateService.createPrompt('classify-knowledge-domain', {
            query,
            domains,
          });

          const messages: ILLMMessage[] = [{ role: LLMMessageRole.SYSTEM, content: prompt }];
          const llmResponse = await this.llmService.generateText(messages, {
            maxTokens: 50,
            temperature: 0.1,
          });

          const cleanedResponse = llmResponse.text.trim().toLowerCase();

          if (Object.values(KnowledgeDomain).includes(cleanedResponse as KnowledgeDomain)) {
            return cleanedResponse as KnowledgeDomain;
          }

          this.logService.warn(
            `LLM вернула невалидную область знаний: "${llmResponse.text}". Используется ${KnowledgeDomain.GENERAL_CONVERSATION}.`,
            { query, llmResponse: llmResponse.text },
          );
          return KnowledgeDomain.GENERAL_CONVERSATION;
        },
      );
    } catch (error) {
      this.logService.error(`Критическая ошибка в classifyQueryDomain, возврат к fallback.`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return KnowledgeDomain.GENERAL_CONVERSATION;
    }
  }

  /**
   * Анализирует контекст для определения факторов влияния
   */
  private analyzeContext(
    context: KnowledgeContext,
    _domain: KnowledgeDomain,
    competence: CompetenceLevel,
  ): string[] {
    const factors: string[] = [];

    // Анализ социальной обстановки
    if (context.socialSetting === 'formal') {
      factors.push('формальная обстановка требует осторожности в ответах');
    }

    // Анализ уровня близости
    if (context.relationshipLevel > 70) {
      factors.push('близкие отношения позволяют более открыто признавать незнание');
    } else if (context.relationshipLevel < 30) {
      factors.push('отдаленные отношения требуют более осторожных ответов');
    }

    // Анализ экспертности пользователя
    if (
      context.userExpertiseLevel === CompetenceLevel.EXPERT &&
      competence === CompetenceLevel.NONE
    ) {
      factors.push('пользователь эксперт, лучше честно признать незнание');
    }

    // Анализ эмоционального состояния
    if (
      context.emotionalState?.includes('расстроен') ||
      context.emotionalState?.includes('грустн')
    ) {
      factors.push('пользователь расстроен, нужно проявить поддержку');
    }

    return factors;
  }

  /**
   * Определяет стратегию ответа на основе компетенции и контекста
   */
  private determineResponseStrategy(
    competence: CompetenceLevel,
    _domain: KnowledgeDomain,
    context: KnowledgeContext,
    _profile: SpecializationProfile,
  ): CompetenceCheck['responseStrategy'] {
    // Если полное незнание и формальная обстановка
    if (competence === CompetenceLevel.NONE && context.socialSetting === 'formal') {
      return 'admit_ignorance';
    }

    // Если полное незнание но близкие отношения
    if (competence === CompetenceLevel.NONE && context.relationshipLevel > 70) {
      return 'express_curiosity';
    }

    // Если полное незнание
    if (competence === CompetenceLevel.NONE) {
      return 'redirect';
    }

    // Если базовая компетенция
    if (competence === CompetenceLevel.BASIC) {
      return 'partial_answer';
    }

    // Если средняя и выше компетенция
    if (
      [CompetenceLevel.INTERMEDIATE, CompetenceLevel.ADVANCED, CompetenceLevel.EXPERT].includes(
        competence,
      )
    ) {
      return 'answer';
    }

    return 'partial_answer';
  }

  // ТРЕБУЕТСЯ ДОРАБОТКА: методы генерации ответов через LLM согласно ТЗ

  /**
   * Получает профиль по умолчанию
   */
  private getDefaultProfile(characterId: number): SpecializationProfile {
    const competenceLevels = {} as Record<KnowledgeDomain, CompetenceLevel>;

    // Инициализируем все домены базовым уровнем
    Object.values(KnowledgeDomain).forEach(domain => {
      competenceLevels[domain] = CompetenceLevel.BASIC;
    });

    // Устанавливаем специфические уровни
    competenceLevels[KnowledgeDomain.GENERAL_CONVERSATION] = CompetenceLevel.ADVANCED;
    competenceLevels[KnowledgeDomain.RELATIONSHIPS] = CompetenceLevel.INTERMEDIATE;
    competenceLevels[KnowledgeDomain.EMOTIONS] = CompetenceLevel.INTERMEDIATE;
    competenceLevels[KnowledgeDomain.DAILY_LIFE] = CompetenceLevel.ADVANCED;

    // Технические и специализированные области - минимальный уровень
    competenceLevels[KnowledgeDomain.TECHNICAL] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.SCIENCE] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.MEDICINE] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.LAW] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.FINANCE] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.POLITICS] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.CRYPTOCURRENCY] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.INVESTING] = CompetenceLevel.NONE;
    competenceLevels[KnowledgeDomain.REAL_ESTATE] = CompetenceLevel.NONE;

    return {
      characterId,
      competenceLevels,
      strongAreas: [KnowledgeDomain.GENERAL_CONVERSATION, KnowledgeDomain.DAILY_LIFE],
      weakAreas: [
        KnowledgeDomain.TECHNICAL,
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.MEDICINE,
        KnowledgeDomain.LAW,
        KnowledgeDomain.FINANCE,
        KnowledgeDomain.CRYPTOCURRENCY,
        KnowledgeDomain.INVESTING,
        KnowledgeDomain.REAL_ESTATE,
      ],
      personalInterests: [],
      professionalBackground: [],
      educationalBackground: [],
      culturalBackground: [],
      naturalIgnorancePatterns: [],
      lastUpdated: new Date(),
      profileVersion: '2.0.0',
    };
  }

  /**
   * Обновляет профиль специализации персонажа
   */
  async updateSpecializationProfile(
    characterId: number,
    updates: Partial<SpecializationProfile>,
  ): Promise<SpecializationProfile> {
    return this.withErrorHandling('обновлении профиля специализации', async () => {
      const currentProfile = await this.getSpecializationProfile(characterId);

      // Объединяем текущий профиль с обновлениями
      const updatedProfile: SpecializationProfile = {
        ...currentProfile,
        ...updates,
        characterId, // Убеждаемся, что ID не изменился
      };

      // Обновляем кэш
      this.specializationProfiles.set(characterId, updatedProfile);

      this.logService.debug(`Профиль специализации персонажа ${characterId} обновлен`);

      return updatedProfile;
    });
  }

  /**
   * Очищает кэш профилей специализации
   */
  clearCache(): void {
    this.specializationProfiles.clear();
    this.logService.debug('Очищен кэш профилей специализации');
  }

  /**
   * Получает статистику использования ограничений
   */
  getUsageStatistics(): Record<string, unknown> {
    return {
      cachedProfiles: this.specializationProfiles.size,
      domains: Object.values(KnowledgeDomain),
      competenceLevels: Object.values(CompetenceLevel),
      specializationTypes: Object.values(SpecializationType),
      learningStyles: Object.values(LearningStyle),
    };
  }

  /**
   * Создает комбинацию специализаций на основе личности персонажа
   */
  createSpecializationCombination(character: Character): SpecializationCombination {
    const personality = (character.personality as unknown as Record<string, unknown>) || {};
    const traits = (personality.traits as string[]) || [];
    const hobbies = (personality.hobbies as string[]) || [];

    // Определяем основной тип специализации
    let primaryType = SpecializationType.GENERALIST;
    let secondaryType: SpecializationType | undefined;

    // Анализируем черты характера для определения типа
    if (traits.includes('любознательный') || traits.includes('исследователь')) {
      primaryType = SpecializationType.CURIOUS;
    } else if (traits.includes('технический') || traits.includes('аналитический')) {
      primaryType = SpecializationType.TECHNICAL;
    } else if (traits.includes('творческий') || traits.includes('художественный')) {
      primaryType = SpecializationType.CREATIVE;
    } else if (traits.includes('общительный') || traits.includes('социальный')) {
      primaryType = SpecializationType.SOCIAL;
    } else if (traits.includes('практичный') || traits.includes('прагматичный')) {
      primaryType = SpecializationType.PRACTICAL;
    } else if (traits.includes('ученый') || traits.includes('академический')) {
      primaryType = SpecializationType.ACADEMIC;
    }

    // Определяем доминирующие области на основе хобби
    const dominantDomains = this.extractDominantDomains(hobbies, traits);
    const supportingDomains = this.extractSupportingDomains(dominantDomains, personality);

    // Определяем стиль обучения
    const learningStyle = this.determineLearningStyle(traits);

    // Вычисляем адаптивность и любознательность
    const adaptabilityScore = this.calculateAdaptabilityScore(traits, primaryType);
    const curiosityLevel = this.calculateCuriosityLevel(traits, hobbies);

    // Определяем социальные предпочтения
    const socialPreference = this.determineSocialPreference(traits);

    return {
      primaryType,
      secondaryType,
      dominantDomains,
      supportingDomains,
      learningStyle,
      adaptabilityScore,
      curiosityLevel,
      socialPreference,
    };
  }

  /**
   * Создает динамическую специализацию для персонажа
   */
  createDynamicSpecialization(
    characterId: number,
    combination: SpecializationCombination,
  ): DynamicSpecialization {
    const learningProgress = {} as Record<KnowledgeDomain, LearningProgress>;

    // Инициализируем прогресс обучения для всех доменов
    Object.values(KnowledgeDomain).forEach(domain => {
      const isDominant = combination.dominantDomains.includes(domain);
      const isSupporting = combination.supportingDomains.includes(domain);

      learningProgress[domain] = {
        domain,
        currentLevel: isDominant
          ? CompetenceLevel.ADVANCED
          : isSupporting
            ? CompetenceLevel.INTERMEDIATE
            : CompetenceLevel.BASIC,
        experiencePoints: isDominant ? 100 : isSupporting ? 50 : 10,
        lastInteraction: new Date(),
        interactionCount: 0,
        learningRate: this.calculateLearningRate(domain, combination),
        plateau: false,
      };
    });

    // Создаем триггеры адаптации
    const adaptationTriggers = this.createAdaptationTriggers(combination);

    return {
      characterId,
      currentCombination: combination,
      evolutionHistory: [],
      learningProgress,
      adaptationTriggers,
    };
  }

  /**
   * Обновляет динамическую специализацию на основе взаимодействий
   */
  async updateDynamicSpecialization(
    characterId: number,
    domain: KnowledgeDomain,
    interactionContext: KnowledgeContext,
  ): Promise<DynamicSpecialization> {
    return this.withErrorHandling('обновлении динамической специализации', async () => {
      const profile = await this.getSpecializationProfile(characterId);

      if (!profile.dynamicSpecialization) {
        throw new Error(`Динамическая специализация не найдена для персонажа ${characterId}`);
      }

      const dynamic = profile.dynamicSpecialization;
      const progress = dynamic.learningProgress[domain];

      // Обновляем прогресс обучения
      progress.lastInteraction = new Date();
      progress.interactionCount++;
      progress.experiencePoints += this.calculateExperienceGain(interactionContext, progress);

      // Проверяем возможность повышения уровня
      const newLevel = this.checkLevelUp(progress);
      if (newLevel !== progress.currentLevel) {
        progress.currentLevel = newLevel;
        this.logService.debug(
          `Персонаж ${characterId} повысил уровень в области ${domain} до ${newLevel}`,
        );
      }

      // Проверяем триггеры адаптации
      await this.checkAdaptationTriggers(dynamic, domain, interactionContext);

      // Обновляем профиль в кэше
      profile.dynamicSpecialization = dynamic;
      profile.lastUpdated = new Date();
      this.specializationProfiles.set(characterId, profile);

      return dynamic;
    });
  }

  /**
   * Получает рекомендации по развитию специализации
   */
  async getSpecializationRecommendations(
    characterId: number,
  ): Promise<SpecializationRecommendation[]> {
    return this.withErrorHandling('получении рекомендаций по специализации', async () => {
      const profile = await this.getSpecializationProfile(characterId);
      const recommendations: SpecializationRecommendation[] = [];

      if (!profile.dynamicSpecialization) {
        return recommendations;
      }

      const dynamic = profile.dynamicSpecialization;
      const combination = dynamic.currentCombination;

      // Анализируем области для развития
      Object.entries(dynamic.learningProgress).forEach(([domain, progress]) => {
        if (progress.plateau && progress.currentLevel < CompetenceLevel.EXPERT) {
          recommendations.push({
            type: 'overcome_plateau',
            domain: domain as KnowledgeDomain,
            currentLevel: progress.currentLevel,
            suggestedLevel: this.getNextLevel(progress.currentLevel),
            reason: 'Достигнуто плато в обучении, рекомендуется изменить подход',
            priority: 'medium',
            actions: ['change_learning_style', 'seek_new_sources', 'practice_more'],
          });
        }

        if (progress.interactionCount > 100 && progress.currentLevel === CompetenceLevel.BASIC) {
          recommendations.push({
            type: 'level_up',
            domain: domain as KnowledgeDomain,
            currentLevel: progress.currentLevel,
            suggestedLevel: CompetenceLevel.INTERMEDIATE,
            reason: 'Большой опыт взаимодействий, готов к повышению уровня',
            priority: 'high',
            actions: ['structured_learning', 'seek_expert_knowledge'],
          });
        }
      });

      // Рекомендации по расширению специализации
      if (combination.curiosityLevel > 70 && combination.dominantDomains.length < 3) {
        const newDomain = this.suggestNewDomain(combination, dynamic);
        if (newDomain) {
          recommendations.push({
            type: 'expand_specialization',
            domain: newDomain,
            currentLevel: CompetenceLevel.NONE,
            suggestedLevel: CompetenceLevel.BASIC,
            reason: 'Высокий уровень любознательности позволяет освоить новую область',
            priority: 'low',
            actions: ['explore_basics', 'find_connections'],
          });
        }
      }

      return recommendations;
    });
  }

  /**
   * Анализирует совместимость двух типов специализации
   */
  analyzeSpecializationCompatibility(
    primary: SpecializationType,
    secondary: SpecializationType,
  ): SpecializationCompatibility {
    const compatibilityMatrix: Record<SpecializationType, Record<SpecializationType, number>> = {
      [SpecializationType.GENERALIST]: {
        [SpecializationType.CURIOUS]: 0.9,
        [SpecializationType.BALANCED]: 0.8,
        [SpecializationType.PRACTICAL]: 0.7,
        [SpecializationType.SOCIAL]: 0.7,
        [SpecializationType.ACADEMIC]: 0.6,
        [SpecializationType.CREATIVE]: 0.6,
        [SpecializationType.TECHNICAL]: 0.5,
        [SpecializationType.SPECIALIST]: 0.3,
        [SpecializationType.EXPERT]: 0.2,
        [SpecializationType.GENERALIST]: 0.5,
      },
      [SpecializationType.SPECIALIST]: {
        [SpecializationType.EXPERT]: 0.8,
        [SpecializationType.TECHNICAL]: 0.7,
        [SpecializationType.ACADEMIC]: 0.7,
        [SpecializationType.CREATIVE]: 0.6,
        [SpecializationType.PRACTICAL]: 0.5,
        [SpecializationType.BALANCED]: 0.4,
        [SpecializationType.CURIOUS]: 0.4,
        [SpecializationType.SOCIAL]: 0.3,
        [SpecializationType.GENERALIST]: 0.2,
        [SpecializationType.SPECIALIST]: 0.6,
      },
      [SpecializationType.EXPERT]: {
        [SpecializationType.SPECIALIST]: 0.8,
        [SpecializationType.ACADEMIC]: 0.7,
        [SpecializationType.TECHNICAL]: 0.6,
        [SpecializationType.PRACTICAL]: 0.4,
        [SpecializationType.CREATIVE]: 0.3,
        [SpecializationType.BALANCED]: 0.3,
        [SpecializationType.CURIOUS]: 0.3,
        [SpecializationType.SOCIAL]: 0.2,
        [SpecializationType.GENERALIST]: 0.1,
        [SpecializationType.EXPERT]: 0.4,
      },
      [SpecializationType.BALANCED]: {
        [SpecializationType.GENERALIST]: 0.8,
        [SpecializationType.SOCIAL]: 0.7,
        [SpecializationType.PRACTICAL]: 0.7,
        [SpecializationType.CURIOUS]: 0.6,
        [SpecializationType.CREATIVE]: 0.6,
        [SpecializationType.ACADEMIC]: 0.5,
        [SpecializationType.TECHNICAL]: 0.4,
        [SpecializationType.SPECIALIST]: 0.3,
        [SpecializationType.EXPERT]: 0.2,
        [SpecializationType.BALANCED]: 0.7,
      },
      [SpecializationType.CURIOUS]: {
        [SpecializationType.GENERALIST]: 0.9,
        [SpecializationType.ACADEMIC]: 0.8,
        [SpecializationType.CREATIVE]: 0.7,
        [SpecializationType.BALANCED]: 0.6,
        [SpecializationType.SOCIAL]: 0.6,
        [SpecializationType.TECHNICAL]: 0.5,
        [SpecializationType.PRACTICAL]: 0.5,
        [SpecializationType.SPECIALIST]: 0.4,
        [SpecializationType.EXPERT]: 0.3,
        [SpecializationType.CURIOUS]: 0.8,
      },
      [SpecializationType.PRACTICAL]: {
        [SpecializationType.BALANCED]: 0.8,
        [SpecializationType.GENERALIST]: 0.7,
        [SpecializationType.SOCIAL]: 0.6,
        [SpecializationType.TECHNICAL]: 0.6,
        [SpecializationType.SPECIALIST]: 0.5,
        [SpecializationType.CURIOUS]: 0.4,
        [SpecializationType.CREATIVE]: 0.4,
        [SpecializationType.ACADEMIC]: 0.3,
        [SpecializationType.EXPERT]: 0.3,
        [SpecializationType.PRACTICAL]: 0.6,
      },
      [SpecializationType.ACADEMIC]: {
        [SpecializationType.CURIOUS]: 0.8,
        [SpecializationType.EXPERT]: 0.7,
        [SpecializationType.SPECIALIST]: 0.7,
        [SpecializationType.TECHNICAL]: 0.6,
        [SpecializationType.GENERALIST]: 0.5,
        [SpecializationType.BALANCED]: 0.4,
        [SpecializationType.CREATIVE]: 0.4,
        [SpecializationType.SOCIAL]: 0.3,
        [SpecializationType.PRACTICAL]: 0.3,
        [SpecializationType.ACADEMIC]: 0.6,
      },
      [SpecializationType.CREATIVE]: {
        [SpecializationType.CURIOUS]: 0.8,
        [SpecializationType.BALANCED]: 0.7,
        [SpecializationType.GENERALIST]: 0.6,
        [SpecializationType.SOCIAL]: 0.6,
        [SpecializationType.ACADEMIC]: 0.5,
        [SpecializationType.PRACTICAL]: 0.4,
        [SpecializationType.TECHNICAL]: 0.4,
        [SpecializationType.SPECIALIST]: 0.3,
        [SpecializationType.EXPERT]: 0.2,
        [SpecializationType.CREATIVE]: 0.7,
      },
      [SpecializationType.TECHNICAL]: {
        [SpecializationType.SPECIALIST]: 0.8,
        [SpecializationType.ACADEMIC]: 0.7,
        [SpecializationType.EXPERT]: 0.6,
        [SpecializationType.PRACTICAL]: 0.6,
        [SpecializationType.CURIOUS]: 0.5,
        [SpecializationType.GENERALIST]: 0.4,
        [SpecializationType.BALANCED]: 0.4,
        [SpecializationType.CREATIVE]: 0.3,
        [SpecializationType.SOCIAL]: 0.3,
        [SpecializationType.TECHNICAL]: 0.6,
      },
      [SpecializationType.SOCIAL]: {
        [SpecializationType.BALANCED]: 0.8,
        [SpecializationType.GENERALIST]: 0.7,
        [SpecializationType.CREATIVE]: 0.6,
        [SpecializationType.CURIOUS]: 0.6,
        [SpecializationType.PRACTICAL]: 0.5,
        [SpecializationType.ACADEMIC]: 0.4,
        [SpecializationType.TECHNICAL]: 0.3,
        [SpecializationType.SPECIALIST]: 0.3,
        [SpecializationType.EXPERT]: 0.2,
        [SpecializationType.SOCIAL]: 0.7,
      },
    };

    const compatibilityScore = compatibilityMatrix[primary]?.[secondary] || 0.1;

    let level: 'excellent' | 'good' | 'fair' | 'poor';
    if (compatibilityScore >= 0.8) level = 'excellent';
    else if (compatibilityScore >= 0.6) level = 'good';
    else if (compatibilityScore >= 0.4) level = 'fair';
    else level = 'poor';

    const benefits = this.getCompatibilityBenefits(primary, secondary, compatibilityScore);
    const challenges = this.getCompatibilityChallenges(primary, secondary, compatibilityScore);

    return {
      primaryType: primary,
      secondaryType: secondary,
      compatibilityScore,
      level,
      benefits,
      challenges,
      recommendedDomains: this.getRecommendedDomainsForCombination(primary, secondary),
    };
  }

  /**
   * Создает оптимальную комбинацию специализаций для персонажа
   */
  async createOptimalSpecializationCombination(
    characterId: number,
  ): Promise<SpecializationCombination> {
    return this.withErrorHandling('создании оптимальной комбинации специализаций', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['personality'],
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      // Анализируем личность персонажа
      const personality = (character.personality as unknown as Record<string, unknown>) || {};
      const traits = (personality.traits as string[]) || [];
      const hobbies = (personality.hobbies as string[]) || [];

      // Определяем наиболее подходящий первичный тип
      const primaryType = this.determineBestPrimaryType(traits, hobbies);

      // Находим наиболее совместимый вторичный тип
      const secondaryType = this.findBestSecondaryType(primaryType, traits, hobbies);

      // Определяем оптимальные домены
      const dominantDomains = this.extractDominantDomains(hobbies, traits);
      const supportingDomains = this.extractSupportingDomains(dominantDomains, personality);

      // Определяем стиль обучения
      const learningStyle = this.determineLearningStyle(traits);

      // Вычисляем показатели
      const adaptabilityScore = this.calculateAdaptabilityScore(traits, primaryType);
      const curiosityLevel = this.calculateCuriosityLevel(traits, hobbies);
      const socialPreference = this.determineSocialPreference(traits);

      return {
        primaryType,
        secondaryType,
        dominantDomains,
        supportingDomains,
        learningStyle,
        adaptabilityScore,
        curiosityLevel,
        socialPreference,
      };
    });
  }

  /**
   * Получает предложения по улучшению комбинации специализаций
   */
  async getSpecializationImprovementSuggestions(
    characterId: number,
  ): Promise<SpecializationImprovementSuggestion[]> {
    return this.withErrorHandling('получении предложений по улучшению специализации', async () => {
      const profile = await this.getSpecializationProfile(characterId);
      const suggestions: SpecializationImprovementSuggestion[] = [];

      if (!profile.specializationCombination || !profile.dynamicSpecialization) {
        return suggestions;
      }

      const combination = profile.specializationCombination;
      const dynamic = profile.dynamicSpecialization;

      // Анализируем текущую эффективность
      const efficiency = this.calculateCombinationEfficiency(combination, dynamic);

      if (efficiency < 0.7) {
        // Предлагаем изменение первичного типа
        const betterPrimaryType = this.suggestBetterPrimaryType(combination, dynamic);
        if (betterPrimaryType && betterPrimaryType !== combination.primaryType) {
          suggestions.push({
            type: 'change_primary_type',
            currentValue: combination.primaryType,
            suggestedValue: betterPrimaryType,
            reason: 'Текущий первичный тип не оптимален для паттернов обучения персонажа',
            expectedImprovement: 0.2,
            priority: 'high',
          });
        }

        // Предлагаем добавление вторичного типа
        if (!combination.secondaryType) {
          const suggestedSecondary = this.findBestSecondaryType(combination.primaryType, [], []);
          suggestions.push({
            type: 'add_secondary_type',
            currentValue: null,
            suggestedValue: suggestedSecondary,
            reason: 'Добавление вторичного типа поможет сбалансировать специализацию',
            expectedImprovement: 0.15,
            priority: 'medium',
          });
        }
      }

      // Анализируем домены
      const underperformingDomains = Object.entries(dynamic.learningProgress)
        .filter(
          ([_, progress]) => progress.plateau && progress.currentLevel < CompetenceLevel.ADVANCED,
        )
        .map(([domain, _]) => domain as KnowledgeDomain);

      if (underperformingDomains.length > 0) {
        suggestions.push({
          type: 'adjust_domains',
          currentValue: combination.dominantDomains,
          suggestedValue: this.suggestDomainAdjustments(combination, underperformingDomains),
          reason: 'Некоторые доминирующие домены показывают низкую эффективность обучения',
          expectedImprovement: 0.1,
          priority: 'medium',
        });
      }

      // Анализируем стиль обучения
      if (this.shouldChangeLearnintStyle(dynamic)) {
        const newStyle = this.suggestNewLearningStyle(combination.learningStyle);
        suggestions.push({
          type: 'change_learning_style',
          currentValue: combination.learningStyle,
          suggestedValue: newStyle,
          reason: 'Текущий стиль обучения не показывает оптимальных результатов',
          expectedImprovement: 0.12,
          priority: 'medium',
        });
      }

      return suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    });
  }

  // Приватные методы для новой функциональности комбинирования

  private getCompatibilityBenefits(
    primary: SpecializationType,
    secondary: SpecializationType,
    score: number,
  ): string[] {
    const benefits: string[] = [];

    if (score >= 0.8) {
      benefits.push('Высокая синергия между типами специализации');
      benefits.push('Взаимное усиление сильных сторон');
    }

    if (score >= 0.6) {
      benefits.push('Хорошая совместимость стилей обучения');
      benefits.push('Возможность компенсации слабых сторон');
    }

    // Специфические комбинации
    if (primary === SpecializationType.CURIOUS && secondary === SpecializationType.ACADEMIC) {
      benefits.push('Отличное сочетание любознательности и глубины знаний');
    }

    if (primary === SpecializationType.PRACTICAL && secondary === SpecializationType.TECHNICAL) {
      benefits.push('Эффективное применение технических знаний на практике');
    }

    return benefits;
  }

  private getCompatibilityChallenges(
    primary: SpecializationType,
    secondary: SpecializationType,
    score: number,
  ): string[] {
    const challenges: string[] = [];

    if (score < 0.4) {
      challenges.push('Низкая совместимость может привести к конфликтам');
      challenges.push('Необходимо тщательное управление балансом');
    }

    if (score < 0.6) {
      challenges.push('Требуется дополнительное внимание к интеграции');
    }

    // Специфические проблемы
    if (primary === SpecializationType.EXPERT && secondary === SpecializationType.GENERALIST) {
      challenges.push('Конфликт между глубиной и широтой знаний');
    }

    return challenges;
  }

  private getRecommendedDomainsForCombination(
    primary: SpecializationType,
    secondary: SpecializationType,
  ): KnowledgeDomain[] {
    const domainRecommendations: Record<SpecializationType, KnowledgeDomain[]> = {
      [SpecializationType.CURIOUS]: [
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.PHILOSOPHY,
        KnowledgeDomain.CULTURE,
      ],
      [SpecializationType.TECHNICAL]: [
        KnowledgeDomain.TECHNICAL,
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.GAMING,
      ],
      [SpecializationType.CREATIVE]: [
        KnowledgeDomain.ARTS,
        KnowledgeDomain.DESIGN,
        KnowledgeDomain.MUSIC,
      ],
      [SpecializationType.SOCIAL]: [
        KnowledgeDomain.RELATIONSHIPS,
        KnowledgeDomain.PSYCHOLOGY,
        KnowledgeDomain.SOCIAL_MEDIA,
      ],
      [SpecializationType.PRACTICAL]: [
        KnowledgeDomain.BUSINESS,
        KnowledgeDomain.CAREER,
        KnowledgeDomain.DAILY_LIFE,
      ],
      [SpecializationType.ACADEMIC]: [
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.HISTORY,
        KnowledgeDomain.LITERATURE,
      ],
      [SpecializationType.BALANCED]: [
        KnowledgeDomain.GENERAL_CONVERSATION,
        KnowledgeDomain.CULTURE,
        KnowledgeDomain.EMOTIONS,
      ],
      [SpecializationType.GENERALIST]: [
        KnowledgeDomain.GENERAL_CONVERSATION,
        KnowledgeDomain.DAILY_LIFE,
        KnowledgeDomain.HOBBIES,
      ],
      [SpecializationType.SPECIALIST]: [
        KnowledgeDomain.TECHNICAL,
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.MEDICINE,
      ],
      [SpecializationType.EXPERT]: [
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.MEDICINE,
        KnowledgeDomain.LAW,
      ],
    };

    const primaryDomains = domainRecommendations[primary] || [];
    const secondaryDomains = domainRecommendations[secondary] || [];

    // Объединяем и убираем дубликаты
    const combined = [...new Set([...primaryDomains, ...secondaryDomains])];
    return combined.slice(0, 5); // Максимум 5 рекомендованных доменов
  }

  private determineBestPrimaryType(traits: string[], hobbies: string[]): SpecializationType {
    const typeScores: Record<SpecializationType, number> = {
      [SpecializationType.CURIOUS]: 0,
      [SpecializationType.TECHNICAL]: 0,
      [SpecializationType.CREATIVE]: 0,
      [SpecializationType.SOCIAL]: 0,
      [SpecializationType.PRACTICAL]: 0,
      [SpecializationType.ACADEMIC]: 0,
      [SpecializationType.BALANCED]: 0,
      [SpecializationType.GENERALIST]: 0,
      [SpecializationType.SPECIALIST]: 0,
      [SpecializationType.EXPERT]: 0,
    };

    // Оценка на основе черт характера
    traits.forEach(trait => {
      switch (trait.toLowerCase()) {
        case 'любознательный':
        case 'исследователь':
          typeScores[SpecializationType.CURIOUS] += 3;
          break;
        case 'технический':
        case 'аналитический':
          typeScores[SpecializationType.TECHNICAL] += 3;
          break;
        case 'творческий':
        case 'художественный':
          typeScores[SpecializationType.CREATIVE] += 3;
          break;
        case 'общительный':
        case 'социальный':
          typeScores[SpecializationType.SOCIAL] += 3;
          break;
        case 'практичный':
        case 'прагматичный':
          typeScores[SpecializationType.PRACTICAL] += 3;
          break;
        case 'ученый':
        case 'академический':
          typeScores[SpecializationType.ACADEMIC] += 3;
          break;
        case 'сбалансированный':
          typeScores[SpecializationType.BALANCED] += 3;
          break;
      }
    });

    // Оценка на основе хобби
    const hobbyTypeMap: Record<string, SpecializationType[]> = {
      программирование: [SpecializationType.TECHNICAL, SpecializationType.SPECIALIST],
      чтение: [SpecializationType.ACADEMIC, SpecializationType.CURIOUS],
      искусство: [SpecializationType.CREATIVE],
      спорт: [SpecializationType.PRACTICAL, SpecializationType.BALANCED],
      музыка: [SpecializationType.CREATIVE, SpecializationType.SPECIALIST],
      путешествия: [SpecializationType.CURIOUS, SpecializationType.SOCIAL],
    };

    hobbies.forEach(hobby => {
      const types = hobbyTypeMap[hobby.toLowerCase()] || [];
      types.forEach(type => {
        typeScores[type] += 2;
      });
    });

    // Находим тип с максимальным счетом
    const maxScore = Math.max(...Object.values(typeScores));
    const bestType = Object.entries(typeScores).find(([_, score]) => score === maxScore)?.[0];

    return (bestType as SpecializationType) || SpecializationType.GENERALIST;
  }

  private findBestSecondaryType(
    primaryType: SpecializationType,
    _traits: string[],
    _hobbies: string[],
  ): SpecializationType | undefined {
    // Анализируем совместимость всех типов с первичным
    const compatibilityScores = Object.values(SpecializationType)
      .filter(type => type !== primaryType)
      .map(type => ({
        type,
        compatibility: this.analyzeSpecializationCompatibility(primaryType, type),
      }))
      .sort((a, b) => b.compatibility.compatibilityScore - a.compatibility.compatibilityScore);

    // Возвращаем наиболее совместимый тип, если совместимость хорошая
    const best = compatibilityScores[0];
    return best.compatibility.compatibilityScore >= 0.6 ? best.type : undefined;
  }

  private calculateCombinationEfficiency(
    combination: SpecializationCombination,
    dynamic: DynamicSpecialization,
  ): number {
    let totalEfficiency = 0;
    let domainCount = 0;

    // Анализируем эффективность в доминирующих доменах
    combination.dominantDomains.forEach(domain => {
      const progress = dynamic.learningProgress[domain];
      if (progress) {
        const efficiency = this.calculateDomainEfficiency(progress);
        totalEfficiency += efficiency * 2; // Удваиваем вес для доминирующих доменов
        domainCount += 2;
      }
    });

    // Анализируем эффективность в поддерживающих доменах
    combination.supportingDomains.forEach(domain => {
      const progress = dynamic.learningProgress[domain];
      if (progress) {
        const efficiency = this.calculateDomainEfficiency(progress);
        totalEfficiency += efficiency;
        domainCount += 1;
      }
    });

    return domainCount > 0 ? totalEfficiency / domainCount : 0;
  }

  private calculateDomainEfficiency(progress: LearningProgress): number {
    // Базовая эффективность на основе уровня
    const levelEfficiency = {
      [CompetenceLevel.NONE]: 0,
      [CompetenceLevel.BASIC]: 0.2,
      [CompetenceLevel.INTERMEDIATE]: 0.5,
      [CompetenceLevel.PROFICIENT]: 0.7,
      [CompetenceLevel.ADVANCED]: 0.9,
      [CompetenceLevel.EXPERT]: 1.0,
    };

    let efficiency = levelEfficiency[progress.currentLevel];

    // Корректировка на основе скорости обучения
    efficiency *= Math.min(progress.learningRate, 2.0) / 2.0;

    // Штраф за плато
    if (progress.plateau) {
      efficiency *= 0.7;
    }

    // Бонус за активное взаимодействие
    if (progress.interactionCount > 50) {
      efficiency *= 1.1;
    }

    return Math.max(0, Math.min(1, efficiency));
  }

  private suggestBetterPrimaryType(
    combination: SpecializationCombination,
    dynamic: DynamicSpecialization,
  ): SpecializationType | null {
    // Анализируем, какой тип лучше подходит на основе фактических данных обучения
    const typePerformance: Partial<Record<SpecializationType, number>> = {};

    Object.values(SpecializationType).forEach(type => {
      typePerformance[type] = this.calculateTypePerformanceScore(type, dynamic);
    });

    const currentScore = typePerformance[combination.primaryType];
    const bestType = Object.entries(typePerformance).reduce(
      (best, [type, score]) =>
        score > best.score ? { type: type as SpecializationType, score } : best,
      { type: combination.primaryType, score: currentScore },
    );

    // Возвращаем новый тип только если он значительно лучше
    return bestType.score > currentScore * 1.2 ? bestType.type : null;
  }

  private calculateTypePerformanceScore(
    type: SpecializationType,
    dynamic: DynamicSpecialization,
  ): number {
    // Упрощенная оценка производительности типа на основе данных обучения
    const typeCharacteristics = this.getTypeCharacteristics(type);
    let score = 0;

    Object.entries(dynamic.learningProgress).forEach(([domain, progress]) => {
      const domainWeight = typeCharacteristics.preferredDomains.includes(domain as KnowledgeDomain)
        ? 2
        : 1;
      const efficiency = this.calculateDomainEfficiency(progress);
      score += efficiency * domainWeight;
    });

    return score / Object.keys(dynamic.learningProgress).length;
  }

  private getTypeCharacteristics(type: SpecializationType): {
    preferredDomains: KnowledgeDomain[];
  } {
    const characteristics: Record<SpecializationType, { preferredDomains: KnowledgeDomain[] }> = {
      [SpecializationType.CURIOUS]: {
        preferredDomains: [
          KnowledgeDomain.SCIENCE,
          KnowledgeDomain.PHILOSOPHY,
          KnowledgeDomain.CULTURE,
        ],
      },
      [SpecializationType.TECHNICAL]: {
        preferredDomains: [
          KnowledgeDomain.TECHNICAL,
          KnowledgeDomain.SCIENCE,
          KnowledgeDomain.GAMING,
        ],
      },
      [SpecializationType.CREATIVE]: {
        preferredDomains: [KnowledgeDomain.ARTS, KnowledgeDomain.DESIGN, KnowledgeDomain.MUSIC],
      },
      [SpecializationType.SOCIAL]: {
        preferredDomains: [
          KnowledgeDomain.RELATIONSHIPS,
          KnowledgeDomain.PSYCHOLOGY,
          KnowledgeDomain.SOCIAL_MEDIA,
        ],
      },
      [SpecializationType.PRACTICAL]: {
        preferredDomains: [
          KnowledgeDomain.BUSINESS,
          KnowledgeDomain.CAREER,
          KnowledgeDomain.DAILY_LIFE,
        ],
      },
      [SpecializationType.ACADEMIC]: {
        preferredDomains: [
          KnowledgeDomain.SCIENCE,
          KnowledgeDomain.HISTORY,
          KnowledgeDomain.LITERATURE,
        ],
      },
      [SpecializationType.BALANCED]: {
        preferredDomains: [
          KnowledgeDomain.GENERAL_CONVERSATION,
          KnowledgeDomain.CULTURE,
          KnowledgeDomain.EMOTIONS,
        ],
      },
      [SpecializationType.GENERALIST]: {
        preferredDomains: [
          KnowledgeDomain.GENERAL_CONVERSATION,
          KnowledgeDomain.DAILY_LIFE,
          KnowledgeDomain.HOBBIES,
        ],
      },
      [SpecializationType.SPECIALIST]: {
        preferredDomains: [
          KnowledgeDomain.TECHNICAL,
          KnowledgeDomain.SCIENCE,
          KnowledgeDomain.MEDICINE,
        ],
      },
      [SpecializationType.EXPERT]: {
        preferredDomains: [KnowledgeDomain.SCIENCE, KnowledgeDomain.MEDICINE, KnowledgeDomain.LAW],
      },
    };

    return characteristics[type];
  }

  private suggestDomainAdjustments(
    combination: SpecializationCombination,
    underperformingDomains: KnowledgeDomain[],
  ): KnowledgeDomain[] {
    // Предлагаем замену неэффективных доменов на более подходящие
    const typeCharacteristics = this.getTypeCharacteristics(combination.primaryType);
    const recommendedDomains = typeCharacteristics.preferredDomains;

    // Заменяем неэффективные домены на рекомендованные
    const newDominantDomains = combination.dominantDomains.filter(
      domain => !underperformingDomains.includes(domain),
    );

    // Добавляем новые домены из рекомендованных
    recommendedDomains.forEach(domain => {
      if (!newDominantDomains.includes(domain) && newDominantDomains.length < 3) {
        newDominantDomains.push(domain);
      }
    });

    return newDominantDomains;
  }

  private shouldChangeLearnintStyle(dynamic: DynamicSpecialization): boolean {
    // Анализируем, нужно ли менять стиль обучения
    const recentProgress = Object.values(dynamic.learningProgress).filter(progress => {
      const daysSinceLastInteraction =
        (Date.now() - progress.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastInteraction <= 30; // Последние 30 дней
    });

    if (recentProgress.length === 0) return false;

    const plateauCount = recentProgress.filter(progress => progress.plateau).length;
    const plateauRatio = plateauCount / recentProgress.length;

    return plateauRatio > 0.5; // Если больше половины доменов в плато
  }

  // Вспомогательные методы для создания специализаций
  private extractDominantDomains(hobbies: string[], traits: string[]): KnowledgeDomain[] {
    const domainMapping: Record<string, KnowledgeDomain[]> = {
      чтение: [KnowledgeDomain.LITERATURE, KnowledgeDomain.EDUCATION],
      музыка: [KnowledgeDomain.MUSIC, KnowledgeDomain.ARTS],
      спорт: [KnowledgeDomain.SPORTS, KnowledgeDomain.FITNESS],
      путешествия: [KnowledgeDomain.TRAVEL, KnowledgeDomain.CULTURE],
      готовка: [KnowledgeDomain.FOOD, KnowledgeDomain.CULTURE],
      технологии: [KnowledgeDomain.TECHNICAL, KnowledgeDomain.SCIENCE],
      искусство: [KnowledgeDomain.ARTS, KnowledgeDomain.DESIGN],
      фотография: [KnowledgeDomain.PHOTOGRAPHY, KnowledgeDomain.ARTS],
      игры: [KnowledgeDomain.GAMING, KnowledgeDomain.ENTERTAINMENT],
      природа: [KnowledgeDomain.NATURE, KnowledgeDomain.ANIMALS],
      здоровье: [KnowledgeDomain.HEALTH, KnowledgeDomain.FITNESS],
      медитация: [KnowledgeDomain.MEDITATION, KnowledgeDomain.PHILOSOPHY],
      карьера: [KnowledgeDomain.CAREER, KnowledgeDomain.BUSINESS],
      'социальные сети': [KnowledgeDomain.SOCIAL_MEDIA, KnowledgeDomain.MARKETING],
      языки: [KnowledgeDomain.LANGUAGES, KnowledgeDomain.CULTURE],
      рукоделие: [KnowledgeDomain.CRAFTS, KnowledgeDomain.ARTS],
      автомобили: [KnowledgeDomain.AUTOMOTIVE, KnowledgeDomain.TECHNICAL],
      недвижимость: [KnowledgeDomain.REAL_ESTATE, KnowledgeDomain.FINANCE],
      инвестиции: [KnowledgeDomain.INVESTING, KnowledgeDomain.FINANCE],
      криптовалюты: [KnowledgeDomain.CRYPTOCURRENCY, KnowledgeDomain.FINANCE],
    };

    const dominantDomains: KnowledgeDomain[] = [];

    // Анализируем хобби
    hobbies.forEach(hobby => {
      const domains = domainMapping[hobby.toLowerCase()];
      if (domains) {
        dominantDomains.push(...domains);
      }
    });

    // Анализируем черты характера
    traits.forEach(trait => {
      if (trait.includes('творческий') || trait.includes('креативный')) {
        dominantDomains.push(KnowledgeDomain.ARTS, KnowledgeDomain.DESIGN);
      } else if (trait.includes('технический') || trait.includes('техничный')) {
        dominantDomains.push(KnowledgeDomain.TECHNICAL, KnowledgeDomain.SCIENCE);
      } else if (trait.includes('социальный') || trait.includes('общительный')) {
        dominantDomains.push(KnowledgeDomain.RELATIONSHIPS, KnowledgeDomain.PSYCHOLOGY);
      } else if (trait.includes('практичный') || trait.includes('прагматичный')) {
        dominantDomains.push(KnowledgeDomain.DAILY_LIFE, KnowledgeDomain.BUSINESS);
      } else if (trait.includes('академический') || trait.includes('ученый')) {
        dominantDomains.push(KnowledgeDomain.SCIENCE, KnowledgeDomain.EDUCATION);
      }
    });

    // Убираем дубликаты и ограничиваем количество
    const uniqueDomains = Array.from(new Set(dominantDomains));
    return uniqueDomains.slice(0, 3);
  }

  private extractSupportingDomains(
    dominantDomains: KnowledgeDomain[],
    _personality: Record<string, unknown>,
  ): KnowledgeDomain[] {
    const supportingDomains: KnowledgeDomain[] = [];

    // Добавляем связанные области для каждой доминирующей
    dominantDomains.forEach(domain => {
      switch (domain) {
        case KnowledgeDomain.ARTS:
          supportingDomains.push(KnowledgeDomain.CULTURE, KnowledgeDomain.HISTORY);
          break;
        case KnowledgeDomain.TECHNICAL:
          supportingDomains.push(KnowledgeDomain.SCIENCE, KnowledgeDomain.BUSINESS);
          break;
        case KnowledgeDomain.RELATIONSHIPS:
          supportingDomains.push(KnowledgeDomain.PSYCHOLOGY, KnowledgeDomain.EMOTIONS);
          break;
        case KnowledgeDomain.BUSINESS:
          supportingDomains.push(KnowledgeDomain.FINANCE, KnowledgeDomain.CAREER);
          break;
        default:
          supportingDomains.push(KnowledgeDomain.GENERAL_CONVERSATION);
      }
    });

    // Добавляем базовые области
    supportingDomains.push(
      KnowledgeDomain.GENERAL_CONVERSATION,
      KnowledgeDomain.DAILY_LIFE,
      KnowledgeDomain.ENTERTAINMENT,
    );

    // Убираем дубликаты и доминирующие области
    const uniqueDomains = Array.from(new Set(supportingDomains)).filter(
      domain => !dominantDomains.includes(domain),
    );

    return uniqueDomains.slice(0, 5);
  }

  private determineLearningStyle(traits: string[]): LearningStyle {
    const traitKeywords = traits.join(' ').toLowerCase();

    if (traitKeywords.includes('быстрый') || traitKeywords.includes('активный')) {
      return LearningStyle.QUICK_LEARNER;
    } else if (traitKeywords.includes('медленный') || traitKeywords.includes('основательный')) {
      return LearningStyle.SLOW_STEADY;
    } else if (traitKeywords.includes('практичный') || traitKeywords.includes('опытный')) {
      return LearningStyle.EXPERIENTIAL;
    } else if (traitKeywords.includes('теоретический') || traitKeywords.includes('академический')) {
      return LearningStyle.THEORETICAL;
    } else if (traitKeywords.includes('социальный') || traitKeywords.includes('общительный')) {
      return LearningStyle.SOCIAL_LEARNER;
    } else if (traitKeywords.includes('независимый') || traitKeywords.includes('самостоятельный')) {
      return LearningStyle.INDEPENDENT;
    } else if (traitKeywords.includes('аналитический') || traitKeywords.includes('логический')) {
      return LearningStyle.PATTERN_BASED;
    } else {
      return LearningStyle.INTUITIVE;
    }
  }

  private calculateAdaptabilityScore(traits: string[], primaryType: SpecializationType): number {
    let score = 50; // Базовый уровень

    // Анализируем черты характера
    traits.forEach(trait => {
      const lowerTrait = trait.toLowerCase();
      if (lowerTrait.includes('гибкий') || lowerTrait.includes('адаптивный')) {
        score += 20;
      } else if (lowerTrait.includes('открытый') || lowerTrait.includes('любознательный')) {
        score += 15;
      } else if (lowerTrait.includes('консервативный') || lowerTrait.includes('упрямый')) {
        score -= 15;
      } else if (lowerTrait.includes('творческий') || lowerTrait.includes('креативный')) {
        score += 10;
      }
    });

    // Корректируем по типу специализации
    switch (primaryType) {
      case SpecializationType.GENERALIST:
      case SpecializationType.CURIOUS:
        score += 20;
        break;
      case SpecializationType.EXPERT:
      case SpecializationType.SPECIALIST:
        score -= 10;
        break;
      case SpecializationType.BALANCED:
        score += 10;
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateCuriosityLevel(traits: string[], hobbies: string[]): number {
    let score = 50; // Базовый уровень

    // Анализируем черты характера
    traits.forEach(trait => {
      const lowerTrait = trait.toLowerCase();
      if (lowerTrait.includes('любознательный') || lowerTrait.includes('интересующийся')) {
        score += 25;
      } else if (lowerTrait.includes('исследователь') || lowerTrait.includes('изучающий')) {
        score += 20;
      } else if (lowerTrait.includes('скучный') || lowerTrait.includes('равнодушный')) {
        score -= 20;
      } else if (lowerTrait.includes('активный') || lowerTrait.includes('энергичный')) {
        score += 10;
      }
    });

    // Количество хобби тоже влияет на любознательность
    score += Math.min(hobbies.length * 5, 30);

    return Math.max(0, Math.min(100, score));
  }

  private determineSocialPreference(traits: string[]): 'introvert' | 'extrovert' | 'ambivert' {
    let extrovertScore = 0;
    let introvertScore = 0;

    traits.forEach(trait => {
      const lowerTrait = trait.toLowerCase();
      if (
        lowerTrait.includes('общительный') ||
        lowerTrait.includes('социальный') ||
        lowerTrait.includes('экстравертный') ||
        lowerTrait.includes('активный')
      ) {
        extrovertScore += 1;
      } else if (
        lowerTrait.includes('замкнутый') ||
        lowerTrait.includes('интровертный') ||
        lowerTrait.includes('тихий') ||
        lowerTrait.includes('застенчивый')
      ) {
        introvertScore += 1;
      }
    });

    if (extrovertScore > introvertScore + 1) {
      return 'extrovert';
    } else if (introvertScore > extrovertScore + 1) {
      return 'introvert';
    } else {
      return 'ambivert';
    }
  }

  private calculateLearningRate(
    domain: KnowledgeDomain,
    combination: SpecializationCombination,
  ): number {
    let rate = 0.5; // Базовая скорость

    // Если это доминирующая область
    if (combination.dominantDomains.includes(domain)) {
      rate += 0.3;
    }

    // Если это поддерживающая область
    if (combination.supportingDomains.includes(domain)) {
      rate += 0.2;
    }

    // Корректируем по стилю обучения
    switch (combination.learningStyle) {
      case LearningStyle.QUICK_LEARNER:
        rate += 0.2;
        break;
      case LearningStyle.SLOW_STEADY:
        rate -= 0.1;
        break;
      case LearningStyle.EXPERIENTIAL:
        rate += 0.1;
        break;
    }

    // Корректируем по любознательности
    rate += (combination.curiosityLevel / 100) * 0.3;

    return Math.max(0.1, Math.min(1.0, rate));
  }

  private createAdaptationTriggers(combination: SpecializationCombination): AdaptationTrigger[] {
    const triggers: AdaptationTrigger[] = [];

    // Триггер для повышения компетенции при высоком опыте
    triggers.push({
      condition: 'high_experience',
      threshold: 100,
      action: 'increase_competence',
    });

    // Триггер для добавления новой области при высокой любознательности
    if (combination.curiosityLevel > 70) {
      triggers.push({
        condition: 'high_curiosity',
        threshold: 50,
        action: 'add_domain',
      });
    }

    // Триггер для изменения стиля обучения при плато
    triggers.push({
      condition: 'learning_plateau',
      threshold: 3,
      action: 'change_style',
    });

    return triggers;
  }

  private calculateExperienceGain(context: KnowledgeContext, progress: LearningProgress): number {
    let gain = 10; // Базовый прирост

    // Корректируем по настройке социального взаимодействия
    switch (context.socialSetting) {
      case 'educational':
        gain += 5;
        break;
      case 'formal':
        gain += 3;
        break;
      case 'personal':
        gain += 2;
        break;
    }

    // Корректируем по уровню отношений
    gain += Math.floor(context.relationshipLevel / 20);

    // Корректируем по скорости обучения
    gain *= progress.learningRate;

    // Если достигнуто плато, опыт растет медленнее
    if (progress.plateau) {
      gain *= 0.5;
    }

    return Math.max(1, Math.floor(gain));
  }

  private checkLevelUp(progress: LearningProgress): CompetenceLevel {
    const thresholds = {
      [CompetenceLevel.NONE]: 0,
      [CompetenceLevel.BASIC]: 50,
      [CompetenceLevel.INTERMEDIATE]: 150,
      [CompetenceLevel.ADVANCED]: 300,
      [CompetenceLevel.EXPERT]: 500,
    };

    let newLevel = progress.currentLevel;

    Object.entries(thresholds).forEach(([level, threshold]) => {
      if (progress.experiencePoints >= threshold) {
        newLevel = level as CompetenceLevel;
      }
    });

    return newLevel;
  }

  private async checkAdaptationTriggers(
    dynamic: DynamicSpecialization,
    domain: KnowledgeDomain,
    context: KnowledgeContext,
  ): Promise<void> {
    const progress = dynamic.learningProgress[domain];

    for (const trigger of dynamic.adaptationTriggers) {
      let shouldTrigger = false;

      switch (trigger.condition) {
        case 'high_experience':
          shouldTrigger = progress.experiencePoints >= trigger.threshold;
          break;
        case 'learning_plateau':
          shouldTrigger = progress.plateau && progress.interactionCount >= trigger.threshold;
          break;
        case 'high_curiosity':
          shouldTrigger = dynamic.currentCombination.curiosityLevel > trigger.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.executeAdaptationAction(trigger, dynamic, domain, context);
      }
    }
  }

  private async executeAdaptationAction(
    trigger: AdaptationTrigger,
    dynamic: DynamicSpecialization,
    _domain: KnowledgeDomain,
    _context: KnowledgeContext,
  ): Promise<void> {
    switch (trigger.action) {
      case 'increase_competence':
        if (trigger.targetDomain && trigger.newValue) {
          const targetProgress = dynamic.learningProgress[trigger.targetDomain];
          if (targetProgress) {
            targetProgress.currentLevel = trigger.newValue as CompetenceLevel;
          }
        }
        break;
      case 'add_domain': {
        // Добавляем новую область в поддерживающие
        const newDomain = this.suggestNewDomain(dynamic.currentCombination, dynamic);
        if (newDomain && !dynamic.currentCombination.supportingDomains.includes(newDomain)) {
          dynamic.currentCombination.supportingDomains.push(newDomain);
        }
        break;
      }
      case 'change_style':
        if (trigger.newValue) {
          dynamic.currentCombination.learningStyle = trigger.newValue as LearningStyle;
        }
        break;
    }
  }

  private getNextLevel(currentLevel: CompetenceLevel): CompetenceLevel {
    const levels = [
      CompetenceLevel.NONE,
      CompetenceLevel.BASIC,
      CompetenceLevel.INTERMEDIATE,
      CompetenceLevel.ADVANCED,
      CompetenceLevel.EXPERT,
    ];

    const currentIndex = levels.indexOf(currentLevel);
    if (currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }
    return currentLevel;
  }

  private suggestNewDomain(
    combination: SpecializationCombination,
    _dynamic: DynamicSpecialization,
  ): KnowledgeDomain | null {
    const allDomains = Object.values(KnowledgeDomain);
    const usedDomains = [...combination.dominantDomains, ...combination.supportingDomains];
    const availableDomains = allDomains.filter(domain => !usedDomains.includes(domain));

    if (availableDomains.length === 0) {
      return null;
    }

    // Предлагаем область, связанную с доминирующими
    const relatedDomains = this.getRelatedDomains(combination.dominantDomains);
    const suggestedDomain = availableDomains.find(domain => relatedDomains.includes(domain));

    return suggestedDomain || availableDomains[0];
  }

  private getRelatedDomains(dominantDomains: KnowledgeDomain[]): KnowledgeDomain[] {
    const related: KnowledgeDomain[] = [];

    dominantDomains.forEach(domain => {
      switch (domain) {
        case KnowledgeDomain.ARTS:
          related.push(
            KnowledgeDomain.CULTURE,
            KnowledgeDomain.HISTORY,
            KnowledgeDomain.PHOTOGRAPHY,
          );
          break;
        case KnowledgeDomain.TECHNICAL:
          related.push(KnowledgeDomain.SCIENCE, KnowledgeDomain.BUSINESS, KnowledgeDomain.GAMING);
          break;
        case KnowledgeDomain.BUSINESS:
          related.push(KnowledgeDomain.FINANCE, KnowledgeDomain.CAREER, KnowledgeDomain.MARKETING);
          break;
        case KnowledgeDomain.HEALTH:
          related.push(
            KnowledgeDomain.FITNESS,
            KnowledgeDomain.MEDITATION,
            KnowledgeDomain.MEDICINE,
          );
          break;
        default:
          related.push(KnowledgeDomain.GENERAL_CONVERSATION);
      }
    });

    return related;
  }

  private suggestNewLearningStyle(currentStyle: LearningStyle): LearningStyle {
    const alternatives: Record<LearningStyle, LearningStyle[]> = {
      [LearningStyle.QUICK_LEARNER]: [LearningStyle.PATTERN_BASED, LearningStyle.INTUITIVE],
      [LearningStyle.SLOW_STEADY]: [LearningStyle.THEORETICAL, LearningStyle.INDEPENDENT],
      [LearningStyle.EXPERIENTIAL]: [LearningStyle.SOCIAL_LEARNER, LearningStyle.INTUITIVE],
      [LearningStyle.THEORETICAL]: [LearningStyle.PATTERN_BASED, LearningStyle.INDEPENDENT],
      [LearningStyle.SOCIAL_LEARNER]: [LearningStyle.EXPERIENTIAL, LearningStyle.INTUITIVE],
      [LearningStyle.INDEPENDENT]: [LearningStyle.THEORETICAL, LearningStyle.SLOW_STEADY],
      [LearningStyle.PATTERN_BASED]: [LearningStyle.QUICK_LEARNER, LearningStyle.THEORETICAL],
      [LearningStyle.INTUITIVE]: [LearningStyle.QUICK_LEARNER, LearningStyle.SOCIAL_LEARNER],
    };

    const options = alternatives[currentStyle] || [LearningStyle.INTUITIVE];
    return options[Math.floor(Math.random() * options.length)];
  }
}

/**
 * Рекомендация по развитию специализации
 */
export interface SpecializationRecommendation {
  type: 'level_up' | 'overcome_plateau' | 'expand_specialization' | 'change_approach';
  domain: KnowledgeDomain;
  currentLevel: CompetenceLevel;
  suggestedLevel: CompetenceLevel;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  actions: string[];
}

/**
 * Анализ совместимости типов специализации
 */
export interface SpecializationCompatibility {
  primaryType: SpecializationType;
  secondaryType: SpecializationType;
  compatibilityScore: number; // 0-1
  level: 'excellent' | 'good' | 'fair' | 'poor';
  benefits: string[];
  challenges: string[];
  recommendedDomains: KnowledgeDomain[];
}

/**
 * Предложение по улучшению специализации
 */
export interface SpecializationImprovementSuggestion {
  type: 'change_primary_type' | 'add_secondary_type' | 'adjust_domains' | 'change_learning_style';
  currentValue: unknown;
  suggestedValue: unknown;
  reason: string;
  expectedImprovement: number; // 0-1
  priority: 'low' | 'medium' | 'high';
}
