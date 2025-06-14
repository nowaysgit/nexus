import { registerAs } from '@nestjs/config';

export default registerAs('character', () => ({
  // Интервалы обновления
  behaviorCycleInterval:
    parseInt(process.env.CHARACTER_BEHAVIOR_CYCLE_INTERVAL, 10) || 5 * 60 * 1000, // 5 минут
  needsUpdateInterval: parseInt(process.env.CHARACTER_NEEDS_UPDATE_INTERVAL, 10) || 60 * 1000, // 1 минута
  motivationCheckInterval:
    parseInt(process.env.CHARACTER_MOTIVATION_CHECK_INTERVAL, 10) || 10 * 60 * 1000, // 10 минут

  // Настройки потребностей
  needs: {
    defaultGrowthRate: parseInt(process.env.CHARACTER_NEEDS_DEFAULT_GROWTH_RATE, 10) || 5,
    maxValue: parseInt(process.env.CHARACTER_NEEDS_MAX_VALUE, 10) || 100,
    motivationThreshold: parseInt(process.env.CHARACTER_MOTIVATION_THRESHOLD, 10) || 70,
  },

  // Настройки действий
  actions: {
    actionChance: parseFloat(process.env.CHARACTER_ACTION_CHANCE) || 0.4,
    defaultDuration: parseInt(process.env.CHARACTER_DEFAULT_ACTION_DURATION, 10) || 30 * 60 * 1000, // 30 минут
    proactiveMessageInterval:
      parseInt(process.env.CHARACTER_PROACTIVE_MESSAGE_INTERVAL, 10) || 6 * 60 * 60 * 1000, // 6 часов
  },

  // Настройки памяти
  memory: {
    maxCount: parseInt(process.env.CHARACTER_MAX_MEMORY_COUNT, 10) || 100,
    defaultImportance: parseInt(process.env.CHARACTER_DEFAULT_MEMORY_IMPORTANCE, 10) || 5,
    retentionTime:
      parseInt(process.env.CHARACTER_MEMORY_RETENTION_TIME, 10) || 30 * 24 * 60 * 60 * 1000, // 30 дней
  },

  // Настройки персонажей по умолчанию
  defaults: {
    archetype: process.env.CHARACTER_DEFAULT_ARCHETYPE || 'gentle',
    ageMin: parseInt(process.env.CHARACTER_DEFAULT_AGE_MIN, 10) || 25,
    ageMax: parseInt(process.env.CHARACTER_DEFAULT_AGE_MAX, 10) || 35,
  },
}));
