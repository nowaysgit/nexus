/**
 * Детализированный психологический профиль согласно ТЗ ПЕРСОНА
 */
export interface PsychologicalProfile {
  // Основные черты характера с интенсивностью (0-100)
  coreTraits: Record<string, number>;

  // Эмоциональные особенности
  emotionalPatterns: {
    dominantEmotions: string[]; // Основные эмоциональные состояния
    emotionalVolatility: number; // Эмоциональная изменчивость (0-100)
    empathyLevel: number; // Уровень эмпатии (0-100)
    emotionalIntelligence: number; // Эмоциональный интеллект (0-100)
  };

  // Когнитивные особенности
  cognitiveStyle: {
    analyticalThinking: number; // Аналитическое мышление (0-100)
    creativity: number; // Креативность (0-100)
    intuition: number; // Интуиция (0-100)
    detailOrientation: number; // Внимание к деталям (0-100)
    decisionMakingStyle: 'impulsive' | 'deliberate' | 'balanced'; // Стиль принятия решений
  };

  // Социальные особенности
  socialPatterns: {
    extraversion: number; // Экстраверсия (0-100)
    socialConfidence: number; // Социальная уверенность (0-100)
    conflictStyle: 'avoidant' | 'assertive' | 'collaborative' | 'competitive'; // Стиль поведения в конфликте
    leadershipTendency: number; // Склонность к лидерству (0-100)
  };

  // Система ценностей
  valueSystem: {
    coreValues: string[]; // Основные жизненные ценности
    moralFlexibility: number; // Моральная гибкость (0-100)
    traditionalism: number; // Приверженность традициям (0-100)
    individualismVsCollectivism: number; // Индивидуализм vs коллективизм (-100 до +100)
  };

  // Поведенческие паттерны
  behavioralPatterns: {
    communicationStyle: 'direct' | 'indirect' | 'diplomatic' | 'emotional'; // Стиль общения
    stressResponse: string[]; // Реакции на стресс
    motivationTriggers: string[]; // Триггеры мотивации
    comfortZone: string[]; // Зона комфорта
  };

  // Личная история и травмы
  psychologicalHistory: {
    significantEvents: string[]; // Значимые события
    traumas: string[]; // Психологические травмы
    achievements: string[]; // Достижения
    regrets: string[]; // Сожаления
  };
}

/**
 * Система предпочтений персонажа согласно ТЗ ПЕРСОНА
 */
export interface PreferencesSystem {
  // Предпочтения в общении
  communicationPreferences: {
    topicInterests: Record<string, number>; // Интерес к темам (0-100)
    conversationStyle: 'casual' | 'deep' | 'playful' | 'intellectual'; // Предпочитаемый стиль беседы
    humorStyle: string[]; // Типы юмора
    personalSpaceBoundaries: number; // Границы личного пространства (0-100)
  };

  // Предпочтения в активностях
  activityPreferences: {
    indoorActivities: Record<string, number>; // Домашние активности с рейтингом
    outdoorActivities: Record<string, number>; // Уличные активности с рейтингом
    creativeActivities: Record<string, number>; // Творческие активности с рейтингом
    socialActivities: Record<string, number>; // Социальные активности с рейтингом
  };

  // Эстетические предпочтения
  aestheticPreferences: {
    fashionStyle: string[]; // Стиль в одежде
    interiorStyle: string[]; // Стиль интерьера
    artPreferences: string[]; // Предпочтения в искусстве
    colorPalette: string[]; // Любимые цвета
  };

  // Предпочтения в еде и напитках
  culinaryPreferences: {
    cuisineTypes: Record<string, number>; // Типы кухни с рейтингом
    dietaryRestrictions: string[]; // Диетические ограничения
    cookingInterest: number; // Интерес к готовке (0-100)
    favoriteRestaurants: string[]; // Любимые рестораны
  };

  // Предпочтения в развлечениях
  entertainmentPreferences: {
    movieGenres: Record<string, number>; // Жанры фильмов с рейтингом
    bookGenres: Record<string, number>; // Жанры книг с рейтингом
    musicGenres: Record<string, number>; // Музыкальные жанры с рейтингом
    gameTypes: Record<string, number>; // Типы игр с рейтингом
  };
}

/**
 * Психологический портрет идеального партнера согласно ТЗ ПЕРСОНА
 */
export interface IdealPartnerProfile {
  // Физические предпочтения
  physicalPreferences: {
    ageRange: { min: number; max: number }; // Возрастной диапазон
    heightPreference: { min: number; max: number }; // Предпочтения по росту (см)
    buildPreference: string[]; // Предпочтения по телосложению
    appearanceImportance: number; // Важность внешности (0-100)
  };

  // Личностные предпочтения
  personalityPreferences: {
    desiredTraits: Record<string, number>; // Желаемые черты характера с важностью
    dealBreakers: string[]; // Неприемлемые черты
    compatibilityFactors: string[]; // Факторы совместимости
    complementaryTraits: string[]; // Дополняющие черты
  };

  // Социально-экономические предпочтения
  socialEconomicPreferences: {
    educationLevel: string[]; // Предпочтения по образованию
    careerImportance: number; // Важность карьеры (0-100)
    financialStability: number; // Важность финансовой стабильности (0-100)
    socialStatus: number; // Важность социального статуса (0-100)
  };

  // Предпочтения в отношениях
  relationshipPreferences: {
    commitmentLevel: 'casual' | 'serious' | 'marriage_oriented'; // Уровень серьезности отношений
    intimacyPreferences: {
      emotionalIntimacy: number; // Желаемый уровень эмоциональной близости (0-100)
      physicalIntimacy: number; // Желаемый уровень физической близости (0-100)
      intellectualIntimacy: number; // Желаемый уровень интеллектуальной близости (0-100)
    };
    communicationExpectations: string[]; // Ожидания от общения
    conflictResolutionStyle: string[]; // Предпочтения в решении конфликтов
  };

  // Предпочтения в образе жизни
  lifestylePreferences: {
    activityLevel: number; // Желаемый уровень активности партнера (0-100)
    socialLevel: number; // Желаемый уровень социальности (0-100)
    adventurousness: number; // Желаемый уровень авантюризма (0-100)
    homeBodyVsOutgoing: number; // Домосед vs любитель выходить (-100 до +100)
    sharedInterests: string[]; // Желаемые общие интересы
  };

  // Ценностная совместимость
  valueCompatibility: {
    coreValues: string[]; // Обязательные общие ценности
    religiousPreferences: string[]; // Религиозные предпочтения
    politicalCompatibility: number; // Важность политической совместимости (0-100)
    familyValues: string[]; // Семейные ценности
  };

  // Гибкость критериев
  flexibilityFactors: {
    negotiableAspects: string[]; // Аспекты, где возможны компромиссы
    absoluteRequirements: string[]; // Абсолютные требования
    willingnessToCompromise: number; // Готовность к компромиссам (0-100)
  };
}
