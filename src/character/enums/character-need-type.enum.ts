/**
 * Типы потребностей персонажа
 * Основаны на иерархии потребностей Маслоу и других психологических теориях
 */
export enum CharacterNeedType {
  // Базовые физиологические потребности
  HUNGER = 'HUNGER',
  THIRST = 'THIRST',
  REST = 'REST',

  // Потребности в безопасности
  SECURITY = 'SECURITY',
  STABILITY = 'STABILITY',
  COMFORT = 'COMFORT',

  // Социальные потребности
  SOCIAL_CONNECTION = 'SOCIAL_CONNECTION',
  ATTENTION = 'ATTENTION',
  ACCEPTANCE = 'ACCEPTANCE',
  BELONGING = 'BELONGING',
  COMMUNICATION = 'COMMUNICATION',
  COMPANIONSHIP = 'COMPANIONSHIP',
  INTIMACY = 'INTIMACY',
  VALIDATION = 'VALIDATION',
  AFFECTION = 'AFFECTION',

  // Потребности в уважении и признании
  RESPECT = 'RESPECT',
  RECOGNITION = 'RECOGNITION',
  STATUS = 'STATUS',
  POWER = 'POWER',
  AUTONOMY = 'AUTONOMY',
  COMPETENCE = 'COMPETENCE',

  // Потребности в самоактуализации
  SELF_EXPRESSION = 'SELF_EXPRESSION',
  CREATIVITY = 'CREATIVITY',
  GROWTH = 'GROWTH',
  MEANING = 'MEANING',
  PURPOSE = 'PURPOSE',
  ACHIEVEMENT = 'ACHIEVEMENT',

  // Эмоциональные потребности
  EXCITEMENT = 'EXCITEMENT',
  PLEASURE = 'PLEASURE',
  JOY = 'JOY',
  RELAXATION = 'RELAXATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  FUN = 'FUN',

  // Когнитивные потребности
  KNOWLEDGE = 'KNOWLEDGE',
  UNDERSTANDING = 'UNDERSTANDING',
  EXPLORATION = 'EXPLORATION',
  CURIOSITY = 'CURIOSITY',
  MENTAL_STIMULATION = 'MENTAL_STIMULATION',

  // Дополнительные эмоциональные потребности
  FREEDOM = 'FREEDOM',
  CONNECTION = 'CONNECTION',
  SELF_REALIZATION = 'SELF_REALIZATION',

  // Системные потребности
  USER_COMMAND = 'USER_COMMAND',
  USER_REQUEST = 'USER_REQUEST',
  SYSTEM = 'SYSTEM',
}
