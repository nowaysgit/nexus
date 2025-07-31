/**
 * Опции для отправки сообщений в Telegram
 */
export interface TelegramSendOptions {
  /** Режим форматирования текста */
  parse_mode?: 'Markdown' | 'HTML';
  /** Разметка клавиатуры */
  reply_markup?: TelegramKeyboardMarkup;
  /** ID сообщения, на которое отвечаем */
  reply_to_message_id?: number;
  /** Отправка без звука уведомления */
  disable_notification?: boolean;
  /** Отключение предпросмотра ссылок */
  disable_web_page_preview?: boolean;
  /** Дополнительные метаданные */
  [key: string]: unknown;
}

/**
 * Типы клавиатур, которые можно использовать в Telegram
 */
export type TelegramKeyboardMarkup =
  | { inline_keyboard: InlineKeyboardButton[][] }
  | {
      keyboard: string[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
      selective?: boolean;
      input_field_placeholder?: string;
    }
  | { remove_keyboard: boolean; selective?: boolean };

/**
 * Кнопка инлайн-клавиатуры
 */
export interface InlineKeyboardButton {
  /** Текст кнопки */
  text: string;
  /** Данные колбэка */
  callback_data?: string;
  /** URL для открытия */
  url?: string;
  /** Текст для поиска в инлайн-режиме */
  switch_inline_query?: string;
  /** Текст для поиска в текущем чате */
  switch_inline_query_current_chat?: string;
}

/**
 * Метаданные для персонажа, отправляемого в Telegram
 */
export interface CharacterMetadata {
  /** ID персонажа */
  id: string;
  /** Имя персонажа */
  name: string;
  /** URL аватара персонажа */
  avatar?: string;
  /** Описание персонажа */
  description?: string;
  /** Является ли персонаж архивированным */
  isArchived?: boolean;
  /** Дата создания персонажа */
  createdAt?: Date;
  /** Дата обновления персонажа */
  updatedAt?: Date;
}

/**
 * Разделитель для данных callback
 */
export enum CallbackDataSeparator {
  MAIN = ':',
  SUB = '|',
}

/**
 * Типы действий для callback-данных
 */
export enum CallbackActionType {
  CHARACTER = 'ch',
  DIALOG = 'dl',
  ARCHETYPE = 'ar',
  SETTINGS = 'st',
  CANCEL = 'cn',
  CONFIRM = 'cf',
  HELP = 'hp',
  ACTION = 'act',
  CHARACTER_SETTINGS = 'character_settings',
}

/**
 * Типы действий с персонажами
 */
export enum CharacterActionType {
  VIEW = 'view',
  EDIT = 'edit',
  DELETE = 'del',
  CHAT = 'chat',
  CREATE = 'create',
  ARCHIVE = 'archive',
  UNARCHIVE = 'unarchive',
}

/**
 * Разбор callback данных
 * @param callbackData строка callback данных
 * @returns массив частей callback данных
 */
export function parseCallbackData(callbackData: string): string[] {
  return callbackData.split(CallbackDataSeparator.MAIN);
}

/**
 * Создание строки callback данных
 * @param parts части callback данных
 * @returns строка callback данных
 */
export function createCallbackData(...parts: string[]): string {
  return parts.join(CallbackDataSeparator.MAIN);
}

/**
 * Опции для создания reply-клавиатуры
 */
export interface ReplyKeyboardOptions {
  /** Автоматически изменять размер клавиатуры */
  resize?: boolean;
  /** Клавиатура доступна только для одного запроса */
  one_time_keyboard?: boolean;
  /** Сделать клавиатуру селективной */
  selective?: boolean;
  /** Вводной текст для клавиатуры */
  input_field_placeholder?: string;
}

/**
 * Интерфейс для фабрики клавиатур
 */
export interface KeyboardFactory {
  /** Создать инлайн-клавиатуру */
  createInlineKeyboard(buttons: InlineKeyboardButton[][]): {
    inline_keyboard: InlineKeyboardButton[][];
  };

  /** Создать обычную клавиатуру */
  createReplyKeyboard(
    buttons: string[][],
    options?: ReplyKeyboardOptions,
  ): {
    keyboard: string[][];
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    selective?: boolean;
    input_field_placeholder?: string;
  };

  /** Удалить клавиатуру */
  removeKeyboard(): { remove_keyboard: boolean; selective?: boolean };
}
