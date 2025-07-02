import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../entities/character.entity';
// LLM импорты удалены - требуется доработка интеграции с LLM согласно ТЗ
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';
import { LLMService } from '../../llm/services/llm.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { ILLMMessage, LLMMessageRole } from '../../common/interfaces/llm-provider.interface';

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
    // Базовые уровни компетенции
    const competenceLevels: Record<KnowledgeDomain, CompetenceLevel> = {
      [KnowledgeDomain.GENERAL_CONVERSATION]: CompetenceLevel.ADVANCED,
      [KnowledgeDomain.RELATIONSHIPS]: CompetenceLevel.INTERMEDIATE,
      [KnowledgeDomain.EMOTIONS]: CompetenceLevel.INTERMEDIATE,
      [KnowledgeDomain.HOBBIES]: CompetenceLevel.BASIC,
      [KnowledgeDomain.ENTERTAINMENT]: CompetenceLevel.BASIC,
      [KnowledgeDomain.DAILY_LIFE]: CompetenceLevel.ADVANCED,
      [KnowledgeDomain.PHILOSOPHY]: CompetenceLevel.BASIC,
      [KnowledgeDomain.PSYCHOLOGY]: CompetenceLevel.BASIC,
      [KnowledgeDomain.TECHNICAL]: CompetenceLevel.NONE,
      [KnowledgeDomain.SCIENCE]: CompetenceLevel.NONE,
      [KnowledgeDomain.HISTORY]: CompetenceLevel.BASIC,
      [KnowledgeDomain.CULTURE]: CompetenceLevel.BASIC,
      [KnowledgeDomain.MEDICINE]: CompetenceLevel.NONE,
      [KnowledgeDomain.LAW]: CompetenceLevel.NONE,
      [KnowledgeDomain.FINANCE]: CompetenceLevel.NONE,
      [KnowledgeDomain.POLITICS]: CompetenceLevel.NONE,
      [KnowledgeDomain.RELIGION]: CompetenceLevel.BASIC,
    };

    // Адаптируем уровни на основе личности персонажа
    if (character.personality) {
      this.adaptCompetenceLevelsToPersonality(competenceLevels, character.personality);
    }

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
    };
  }

  /**
   * Адаптирует уровни компетенции на основе личности персонажа
   */
  private adaptCompetenceLevelsToPersonality(
    competenceLevels: Record<KnowledgeDomain, CompetenceLevel>,
    personality: { traits?: string[]; hobbies?: string[] } | undefined,
  ): void {
    // Если персонаж интроверт, повышаем компетенцию в философии и психологии
    if (
      personality.traits &&
      Array.isArray(personality.traits) &&
      personality.traits.includes('интроверт')
    ) {
      competenceLevels[KnowledgeDomain.PHILOSOPHY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.PSYCHOLOGY] = CompetenceLevel.INTERMEDIATE;
    }

    // Если у персонажа есть технические хобби, повышаем техническую компетенцию
    if (
      personality.hobbies &&
      Array.isArray(personality.hobbies) &&
      personality.hobbies.some(
        (hobby: string) =>
          hobby.includes('компьютер') ||
          hobby.includes('технологии') ||
          hobby.includes('программирование'),
      )
    ) {
      competenceLevels[KnowledgeDomain.TECHNICAL] = CompetenceLevel.INTERMEDIATE;
    }

    // Если персонаж любит читать, повышаем компетенцию в истории и культуре
    if (
      personality.hobbies &&
      Array.isArray(personality.hobbies) &&
      personality.hobbies.includes('чтение')
    ) {
      competenceLevels[KnowledgeDomain.HISTORY] = CompetenceLevel.INTERMEDIATE;
      competenceLevels[KnowledgeDomain.CULTURE] = CompetenceLevel.INTERMEDIATE;
    }
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
    return {
      characterId,
      competenceLevels: {
        [KnowledgeDomain.GENERAL_CONVERSATION]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.RELATIONSHIPS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.EMOTIONS]: CompetenceLevel.INTERMEDIATE,
        [KnowledgeDomain.HOBBIES]: CompetenceLevel.BASIC,
        [KnowledgeDomain.ENTERTAINMENT]: CompetenceLevel.BASIC,
        [KnowledgeDomain.DAILY_LIFE]: CompetenceLevel.ADVANCED,
        [KnowledgeDomain.PHILOSOPHY]: CompetenceLevel.BASIC,
        [KnowledgeDomain.PSYCHOLOGY]: CompetenceLevel.BASIC,
        [KnowledgeDomain.TECHNICAL]: CompetenceLevel.NONE,
        [KnowledgeDomain.SCIENCE]: CompetenceLevel.NONE,
        [KnowledgeDomain.HISTORY]: CompetenceLevel.BASIC,
        [KnowledgeDomain.CULTURE]: CompetenceLevel.BASIC,
        [KnowledgeDomain.MEDICINE]: CompetenceLevel.NONE,
        [KnowledgeDomain.LAW]: CompetenceLevel.NONE,
        [KnowledgeDomain.FINANCE]: CompetenceLevel.NONE,
        [KnowledgeDomain.POLITICS]: CompetenceLevel.NONE,
        [KnowledgeDomain.RELIGION]: CompetenceLevel.BASIC,
      },
      strongAreas: [KnowledgeDomain.GENERAL_CONVERSATION, KnowledgeDomain.DAILY_LIFE],
      weakAreas: [
        KnowledgeDomain.TECHNICAL,
        KnowledgeDomain.SCIENCE,
        KnowledgeDomain.MEDICINE,
        KnowledgeDomain.LAW,
      ],
      personalInterests: [],
      professionalBackground: [],
      educationalBackground: [],
      culturalBackground: [],
      naturalIgnorancePatterns: [],
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
    };
  }
}
