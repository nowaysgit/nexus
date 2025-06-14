/**
 * Константы токенов для Telegram модуля
 */

export const TELEGRAF_TOKEN = 'TELEGRAF_TOKEN';
export const TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
export const TELEGRAM_CONFIG_TOKEN = 'TELEGRAM_CONFIG_TOKEN';
export const TELEGRAM_SESSION_TOKEN = 'TELEGRAM_SESSION_TOKEN';
export const TELEGRAM_MIDDLEWARE_TOKEN = 'TELEGRAM_MIDDLEWARE_TOKEN';

/**
 * Токены для инжекции зависимостей
 */
export const TELEGRAM_TOKENS = {
  BOT: TELEGRAF_TOKEN,
  CONFIG: TELEGRAM_CONFIG_TOKEN,
  SESSION: TELEGRAM_SESSION_TOKEN,
  MIDDLEWARE: TELEGRAM_MIDDLEWARE_TOKEN,
} as const;

/**
 * Типы токенов
 */
export type TelegramTokenType = keyof typeof TELEGRAM_TOKENS;
