import { MessageContext } from './message-processor.interface';

/**
 * Базовые интерфейсы сообщений
 */
export interface IMessage {
  userId: string | number;
  text: string;
  messageId?: string | number;
  context?: MessageContext;
}

export interface IMessageOptions {
  parseMode?: 'HTML' | 'Markdown';
  replyToMessageId?: number;
  replyMarkup?: Record<string, unknown>;
  webPreview?: boolean;
  silent?: boolean;
  entities?: Record<string, unknown>[];
  priority?: number;
}

/**
 * Единый интерфейс для отправки сообщений
 * Объединяет функциональность IMessageService и ITelegramService
 */
export interface IMessagingService {
  /**
   * Отправляет сообщение пользователю
   * @param chatId ID чата/пользователя
   * @param message Текст сообщения
   * @param options Дополнительные опции сообщения
   */
  sendMessage(
    chatId: number | string,
    message: string,
    options?: {
      characterId?: number;
      isProactive?: boolean;
      actionType?: string;
      metadata?: Record<string, unknown>;
      extra?: Record<string, unknown>;
    },
  ): Promise<void>;
}

/**
 * Расширенный интерфейс для действий персонажей
 * Наследует основную функциональность отправки сообщений
 */
export interface ICharacterMessagingService extends IMessagingService {
  /**
   * Отправляет сообщение от имени персонажа
   * @param chatId ID чата/пользователя
   * @param message Текст сообщения
   * @param characterId ID персонажа
   * @param options Дополнительные опции
   */
  sendCharacterMessage(
    chatId: number | string,
    message: string,
    characterId: number,
    options?: {
      isProactive?: boolean;
      actionType?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
}
