/**
 * Интерфейс настроек персонажа
 */
export interface CharacterSettings {
  /**
   * ID персонажа
   */
  characterId: number;

  /**
   * Флаг, указывающий, включены ли автоматические действия для персонажа
   */
  autoActions: boolean;

  /**
   * Флаг, указывающий, включены ли уведомления о действиях персонажа
   */
  actionNotifications: boolean;

  /**
   * Тип уведомлений (все, только начало/конец, только завершение, отключены)
   */
  notificationType: 'all' | 'start_end' | 'completion' | 'none';

  /**
   * Формат уведомлений (простой текст, детальный, с эмодзи)
   */
  notificationFormat: 'simple' | 'detailed' | 'emoji';

  /**
   * Частота уведомлений о прогрессе действия (в процентах).
   * 0 - только начало и конец
   */
  progressNotificationFrequency: number;

  /**
   * Максимальное количество автоматических действий в день.
   * 0 - без ограничений
   */
  maxDailyActions: number;

  /**
   * Дата последнего обновления настроек
   */
  updatedAt: Date;
}

/**
 * Стандартные настройки персонажа по умолчанию
 */
export const DEFAULT_CHARACTER_SETTINGS: CharacterSettings = {
  characterId: 0,
  autoActions: false,
  actionNotifications: true,
  notificationType: 'start_end',
  notificationFormat: 'detailed',
  progressNotificationFrequency: 25,
  maxDailyActions: 5,
  updatedAt: new Date(),
};
