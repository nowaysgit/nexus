/**
 * Объединенное перечисление для всех типов потребностей персонажа
 */
export enum CharacterNeedType {
  // Потребности из common/enums/need-type.enum.ts
  ATTENTION = 'attention',
  CONNECTION = 'connection',
  FREEDOM = 'freedom',
  VALIDATION = 'validation',
  FUN = 'fun',
  SECURITY = 'security',
  GROWTH = 'growth',

  // Дополнительные потребности из character/entities/need.entity.ts
  COMMUNICATION = 'communication',
  ENTERTAINMENT = 'entertainment',
  SELF_REALIZATION = 'self_realization',
  AFFECTION = 'affection',
  RESPECT = 'respect',

  // Специальные типы для команд пользователя и системных нужд
  USER_COMMAND = 'user_command',
  SYSTEM = 'system',
}
