/**
 * Единое перечисление для типов действий персонажа
 * Используется как для сущности Action, так и для сервисов
 */
export enum ActionType {
  // Базовые типы действий
  SLEEP = 'SLEEP',
  REST = 'REST',
  WORK = 'WORK',
  ENTERTAINMENT = 'ENTERTAINMENT',
  SOCIALIZATION = 'SOCIALIZATION',
  EMOTIONAL_RESPONSE = 'EMOTIONAL_RESPONSE',
  INITIATE_CONVERSATION = 'INITIATE_CONVERSATION',
  EXPRESS_NEED = 'EXPRESS_NEED',
  CUSTOM = 'CUSTOM',

  // Расширенные типы действий
  READ = 'READ',
  EXERCISE = 'EXERCISE',
  RELAX = 'RELAX',
  CREATE = 'CREATE',
  MEDITATE = 'MEDITATE',
  SOCIALIZE = 'SOCIALIZE',

  // Действия, связанные с пользователем
  SEND_MESSAGE = 'SEND_MESSAGE',
  ASK_QUESTION = 'ASK_QUESTION',
  SHARE_STORY = 'SHARE_STORY',
  SHARE_EMOTION = 'SHARE_EMOTION',

  // Дополнительные типы действий
  SHARE_THOUGHTS = 'SHARE_THOUGHTS',
  EXPRESS_EMOTION = 'EXPRESS_EMOTION',
  CONFESS = 'CONFESS',
  APOLOGIZE = 'APOLOGIZE',
  TEASE = 'TEASE',
  JOKE = 'JOKE',
}
