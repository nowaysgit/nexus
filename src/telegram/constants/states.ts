/**
 * Константы для состояний приложения
 */
export const STATES = {
  /** Начальное состояние после команды /start */
  INITIAL: 'initial',

  /** Процесс прохождения психологического теста */
  PSYCHOLOGICAL_TEST: {
    IN_PROGRESS: 'psychological_test.in_progress',
    COMPLETED: 'psychological_test.completed',
  },

  /** Процесс создания персонажа */
  CHARACTER_CREATION: {
    SELECTING_ARCHETYPE: 'character_creation.selecting_archetype',
    IN_PROGRESS: 'character_creation.in_progress',
    COMPLETED: 'character_creation.completed',
  },

  /** Общение с персонажем */
  CHAT: {
    ACTIVE: 'chat.active',
    PAUSED: 'chat.paused',
    SELECTING_ACTION: 'chat.selecting_action',
  },

  /** Настройки пользователя */
  SETTINGS: {
    MAIN: 'settings.main',
    NOTIFICATION: 'settings.notification',
    PRIVACY: 'settings.privacy',
  },
};
