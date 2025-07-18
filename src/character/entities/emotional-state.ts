// Эмоциональное состояние персонажа
export interface EmotionalState {
  // Основная эмоция
  primary: string;

  // Вторичная эмоция
  secondary: string;

  // Интенсивность эмоционального состояния (0-100)
  intensity: number;

  // Стабильность эмоционального состояния (0-100)
  stability?: number;

  // Триггеры, вызывающие эмоцию
  triggers?: string[];

  // Продолжительность эмоции в минутах
  duration?: number;

  // Время последнего обновления
  lastUpdated?: Date;

  // Текстовое описание эмоционального состояния
  description?: string;

  // Новые расширенные поля
  valence?: number; // Валентность эмоции (-100 до +100, от крайне негативной до крайне позитивной)
  arousal?: number; // Возбуждение (0-100, от спокойствия до высокого возбуждения)
  dominance?: number; // Доминантность (0-100, от покорности до доминирования)
  complexity?: EmotionalComplexity; // Сложность эмоционального состояния
  origin?: EmotionalOrigin; // Происхождение эмоции
  regulation?: EmotionalRegulation; // Информация о регуляции эмоций
}

// Мотивация персонажа к действию
export interface Motivation {
  // Тип потребности, вызывающей мотивацию
  needType: string;

  // Приоритет мотивации (0-100)
  priority: number;

  // Пороговое значение для генерации действия
  threshold: number;

  // Описание импульса к действию
  actionImpulse: string;
}

// Различные категории эмоций
export enum EmotionCategory {
  // Позитивные эмоции
  POSITIVE = 'positive',

  // Негативные эмоции
  NEGATIVE = 'negative',

  // Нейтральные эмоции
  NEUTRAL = 'neutral',

  // Социальные эмоции
  SOCIAL = 'social',

  // Эмоции, связанные с потребностями
  NEED_BASED = 'need_based',

  // Новые категории
  COMPLEX = 'complex', // Сложные смешанные эмоции
  SELF_CONSCIOUS = 'self_conscious', // Самосознательные эмоции (стыд, гордость)
  MORAL = 'moral', // Моральные эмоции (вина, возмущение)
  AESTHETIC = 'aesthetic', // Эстетические эмоции (восхищение, отвращение к уродству)
  EXISTENTIAL = 'existential', // Экзистенциальные эмоции (тревога, меланхолия)
}

// Типы эмоциональных реакций
export enum EmotionalReactionType {
  // Вербальная реакция
  VERBAL = 'verbal',

  // Физическая реакция
  PHYSICAL = 'physical',

  // Изменение темы
  TOPIC_CHANGE = 'topic_change',

  // Эмоциональное раскрытие
  EMOTIONAL_DISCLOSURE = 'emotional_disclosure',

  // Избегание
  AVOIDANCE = 'avoidance',

  // Новые типы реакций
  COGNITIVE = 'cognitive', // Изменение мышления и восприятия
  BEHAVIORAL = 'behavioral', // Изменение поведенческих паттернов
  SOCIAL = 'social', // Изменение социального взаимодействия
  CREATIVE = 'creative', // Творческое выражение эмоций
  REGULATORY = 'regulatory', // Попытки регуляции эмоций
}

/**
 * Сложность эмоционального состояния
 */
export interface EmotionalComplexity {
  isComplex: boolean; // Является ли состояние сложным (смешанным)
  conflictingEmotions: string[]; // Конфликтующие эмоции
  emotionalBlends: EmotionalBlend[]; // Смеси эмоций
  ambivalence: number; // Уровень амбивалентности (0-100)
  coherence: number; // Согласованность эмоций (0-100)
}

/**
 * Смесь эмоций
 */
export interface EmotionalBlend {
  emotions: string[]; // Смешиваемые эмоции
  weights: number[]; // Веса каждой эмоции
  resultingEmotion: string; // Результирующая эмоция
  stability: number; // Стабильность смеси (0-100)
}

/**
 * Происхождение эмоции
 */
export interface EmotionalOrigin {
  source: 'internal' | 'external' | 'memory' | 'anticipation' | 'social' | 'cognitive';
  trigger: string; // Конкретный триггер
  context: string; // Контекст возникновения
  timestamp: Date; // Время возникновения
  causality: EmotionalCausality; // Причинно-следственные связи
}

/**
 * Причинно-следственные связи эмоций
 */
export interface EmotionalCausality {
  primaryCause: string; // Основная причина
  secondaryCauses: string[]; // Второстепенные причины
  consequentEmotions: string[]; // Эмоции-следствия
  feedbackLoops: string[]; // Обратные связи
}

/**
 * Регуляция эмоций
 */
export interface EmotionalRegulation {
  strategy: EmotionalRegulationStrategy; // Стратегия регуляции
  effectiveness: number; // Эффективность (0-100)
  effort: number; // Затрачиваемые усилия (0-100)
  automaticity: number; // Автоматичность (0-100)
  adaptiveness: number; // Адаптивность стратегии (0-100)
}

/**
 * Стратегии эмоциональной регуляции
 */
export enum EmotionalRegulationStrategy {
  REAPPRAISAL = 'reappraisal', // Переоценка ситуации
  SUPPRESSION = 'suppression', // Подавление эмоций
  DISTRACTION = 'distraction', // Отвлечение
  ACCEPTANCE = 'acceptance', // Принятие эмоций
  PROBLEM_SOLVING = 'problem_solving', // Решение проблемы
  SOCIAL_SUPPORT = 'social_support', // Поиск социальной поддержки
  RUMINATION = 'rumination', // Руминация (негативная стратегия)
  AVOIDANCE = 'avoidance', // Избегание
  EXPRESSION = 'expression', // Выражение эмоций
  MINDFULNESS = 'mindfulness', // Осознанность
}

/**
 * Эмоциональная память
 */
export interface EmotionalMemory {
  id: string; // Уникальный идентификатор воспоминания
  characterId: number; // ID персонажа
  emotionalState: EmotionalState; // Эмоциональное состояние в момент события
  trigger: string; // Триггер, вызвавший эмоцию
  context: EmotionalContext; // Контекст события
  timestamp: Date; // Время события
  significance: number; // Значимость воспоминания (0-100)
  vividness: number; // Яркость воспоминания (0-100)
  accessibility: number; // Доступность для извлечения (0-100)
  decay: number; // Уровень затухания (0-100)
  associations: EmotionalAssociation[]; // Ассоциации с другими воспоминаниями
  tags: string[]; // Теги для категоризации
}

/**
 * Эмоциональная ассоциация между воспоминаниями
 */
export interface EmotionalAssociation {
  targetMemoryId: string; // ID связанного воспоминания
  strength: number; // Сила связи (0-100)
  type: 'similarity' | 'contrast' | 'sequence' | 'causal' | 'contextual';
  description: string; // Описание связи
}

/**
 * Эмоциональный переход
 */
export interface EmotionalTransition {
  id: string; // Уникальный идентификатор перехода
  characterId: number; // ID персонажа
  fromState: EmotionalState; // Исходное состояние
  toState: EmotionalState; // Целевое состояние
  trigger: string; // Триггер перехода
  duration: number; // Длительность перехода в секундах
  smoothness: number; // Плавность перехода (0-100)
  intensity: number; // Интенсивность перехода (0-100)
  timestamp: Date; // Время перехода
  pathway: EmotionalPathway; // Путь перехода
  resistance: number; // Сопротивление переходу (0-100)
}

/**
 * Путь эмоционального перехода
 */
export interface EmotionalPathway {
  intermediateStates: EmotionalState[]; // Промежуточные состояния
  milestones: EmotionalMilestone[]; // Вехи перехода
  blockers: string[]; // Препятствия на пути
  facilitators: string[]; // Факторы, облегчающие переход
}

/**
 * Веха эмоционального перехода
 */
export interface EmotionalMilestone {
  state: EmotionalState; // Состояние в данной точке
  timestamp: Date; // Время достижения вехи
  significance: number; // Значимость вехи (0-100)
  description: string; // Описание вехи
}

/**
 * Эмоциональный профиль персонажа
 */
export interface EmotionalProfile {
  characterId: number; // ID персонажа
  baselineEmotions: Record<string, number>; // Базовые уровни эмоций
  emotionalRange: EmotionalRange; // Эмоциональный диапазон
  regulationCapacity: EmotionalRegulationCapacity; // Способности к регуляции
  vulnerabilities: EmotionalVulnerability[]; // Эмоциональные уязвимости
  strengths: EmotionalStrength[]; // Эмоциональные сильные стороны
  patterns: EmotionalPattern[]; // Эмоциональные паттерны
  adaptability: number; // Адаптивность (0-100)
  resilience: number; // Устойчивость (0-100)
  sensitivity: number; // Чувствительность (0-100)
  expressiveness: number; // Экспрессивность (0-100)
}

/**
 * Эмоциональный диапазон
 */
export interface EmotionalRange {
  maxIntensity: number; // Максимальная интенсивность (0-100)
  minIntensity: number; // Минимальная интенсивность (0-100)
  variability: number; // Изменчивость (0-100)
  accessibility: Record<string, number>; // Доступность различных эмоций
}

/**
 * Способности к эмоциональной регуляции
 */
export interface EmotionalRegulationCapacity {
  strategies: Record<EmotionalRegulationStrategy, number>; // Владение стратегиями
  flexibility: number; // Гибкость в выборе стратегий (0-100)
  effectiveness: number; // Общая эффективность регуляции (0-100)
  awareness: number; // Осознанность эмоций (0-100)
  control: number; // Контроль над эмоциями (0-100)
}

/**
 * Эмоциональная уязвимость
 */
export interface EmotionalVulnerability {
  emotion: string; // Уязвимая эмоция
  triggers: string[]; // Триггеры уязвимости
  severity: number; // Серьезность уязвимости (0-100)
  frequency: number; // Частота проявления (0-100)
  impact: string; // Влияние на поведение
  copingMechanisms: string[]; // Механизмы совладания
}

/**
 * Эмоциональная сильная сторона
 */
export interface EmotionalStrength {
  emotion: string; // Сильная эмоция
  advantages: string[]; // Преимущества
  effectiveness: number; // Эффективность (0-100)
  stability: number; // Стабильность (0-100)
  applications: string[]; // Области применения
}

/**
 * Эмоциональный паттерн
 */
export interface EmotionalPattern {
  id: string; // Идентификатор паттерна
  name: string; // Название паттерна
  sequence: string[]; // Последовательность эмоций
  frequency: number; // Частота проявления (0-100)
  predictability: number; // Предсказуемость (0-100)
  triggers: string[]; // Триггеры паттерна
  outcomes: string[]; // Результаты паттерна
  adaptiveness: number; // Адаптивность паттерна (0-100)
}

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

  // Расширенные контекстные факторы
  culturalContext: string; // Культурный контекст
  historicalContext: string; // Исторический контекст взаимодействий
  emotionalClimate: string; // Эмоциональная атмосфера
  expectations: string[]; // Ожидания от взаимодействия
  constraints: string[]; // Ограничения в выражении эмоций
  opportunities: string[]; // Возможности для эмоционального выражения
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
    
    // Расширенные поведенческие изменения
    communicationStyle: string; // Стиль коммуникации
    decisionMaking: string; // Влияние на принятие решений
    riskTaking: string; // Склонность к риску
    creativity: string; // Влияние на креативность
    empathy: string; // Изменение эмпатии
  };
  physicalSigns: string[]; // Физические признаки эмоции
  cognitiveEffects: {
    attentionFocus: string; // Фокус внимания
    memoryBias: string; // Искажение памяти
    decisionMaking: string; // Влияние на принятие решений
    
    // Расширенные когнитивные эффекты
    perceptionBias: string; // Искажение восприятия
    judgmentBias: string; // Искажение суждений
    learningCapacity: string; // Влияние на способность к обучению
    creativity: string; // Влияние на креативность
    problemSolving: string; // Влияние на решение проблем
  };

  // Новые типы проявлений
  socialEffects: {
    interpersonalBehavior: string; // Межличностное поведение
    groupDynamics: string; // Влияние на групповую динамику
    leadership: string; // Влияние на лидерские качества
    cooperation: string; // Склонность к сотрудничеству
    conflict: string; // Поведение в конфликтах
  };
  
  motivationalEffects: {
    goalPursuit: string; // Влияние на достижение целей
    persistence: string; // Настойчивость
    initiative: string; // Инициативность
    exploration: string; // Исследовательское поведение
    achievement: string; // Стремление к достижениям
  };
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

  // Расширенные поля
  cascadeEffects: EmotionalCascade[]; // Каскадные эффекты
  interactions: EmotionalInteraction[]; // Взаимодействия с другими эмоциями
  resistance: number; // Сопротивление воздействию (0-100)
  amplifiers: string[]; // Факторы, усиливающие воздействие
  dampeners: string[]; // Факторы, ослабляющие воздействие
}

/**
 * Каскадный эмоциональный эффект
 */
export interface EmotionalCascade {
  triggerEmotion: string; // Эмоция-триггер
  resultingEmotions: string[]; // Результирующие эмоции
  delay: number; // Задержка в секундах
  probability: number; // Вероятность срабатывания (0-100)
  conditions: string[]; // Условия срабатывания
}

/**
 * Взаимодействие эмоций
 */
export interface EmotionalInteraction {
  emotions: string[]; // Взаимодействующие эмоции
  type: 'synergy' | 'conflict' | 'suppression' | 'amplification' | 'transformation';
  strength: number; // Сила взаимодействия (0-100)
  outcome: string; // Результат взаимодействия
  conditions: string[]; // Условия взаимодействия
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

  // Расширенные поля
  context?: EmotionalContext; // Контекст обновления
  expectedDuration?: number; // Ожидаемая длительность
  regulation?: EmotionalRegulation; // Информация о регуляции
  cascades?: EmotionalCascade[]; // Ожидаемые каскадные эффекты
}

/**
 * Эмоциональное событие для системы памяти
 */
export interface EmotionalEvent {
  id: string; // Уникальный идентификатор
  characterId: number; // ID персонажа
  type: 'state_change' | 'transition' | 'regulation' | 'cascade' | 'interaction';
  timestamp: Date; // Время события
  data: any; // Данные события
  significance: number; // Значимость события (0-100)
  participants: number[]; // Участники события (другие персонажи)
  context: EmotionalContext; // Контекст события
  outcomes: string[]; // Результаты события
  metadata: Record<string, any>; // Дополнительные метаданные
}
