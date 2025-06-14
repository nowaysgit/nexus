/**
 * Типы записей в памяти персонажа
 */
export enum MemoryType {
  /** Запись о диалоге с пользователем */
  CONVERSATION = 'conversation',

  /** Запись об изменении потребности */
  NEED_CHANGE = 'need_change',

  /** Запись о выполнении действия */
  ACTION = 'action',

  /** Запись о важном событии */
  EVENT = 'event',

  /** Запись о предпочтении пользователя */
  USER_PREFERENCE = 'user_preference',

  /** Запись о обещании */
  PROMISE = 'promise',

  /** Запись о конфликте */
  CONFLICT = 'conflict',
}
