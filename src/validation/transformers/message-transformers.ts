import { MessageTransformer } from '../../common/interfaces/message-validation.interface';
import { MessageContext } from '../../common/interfaces/message-processor.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Создает базовый трансформер для сообщений с указанием источника
 */
function createBaseMessageTransformerFunction(source: string) {
  return async (message: MessageContext): Promise<MessageContext> => {
    return {
      ...message,
      metadata: {
        ...message.metadata,
        source,
      },
    };
  };
}

/**
 * Создает стандартный трансформер для телеграм-сообщений
 */
export function createTelegramMessageTransformer() {
  return createBaseMessageTransformerFunction('telegram');
}

/**
 * Создает трансформер для сообщений из API
 */
export function createApiMessageTransformer() {
  return createBaseMessageTransformerFunction('api');
}

/**
 * Создает трансформер для преобразования сообщений из системы диалогов
 */
export function createDialogMessageTransformer() {
  return createBaseMessageTransformerFunction('dialog');
}

/**
 * Создает трансформер для преобразования оповещений и системных сообщений
 */
export function createNotificationTransformer(): MessageTransformer<any, MessageContext> {
  return {
    name: 'notification-transformer',
    transform: (notification: Record<string, unknown>): MessageContext => {
      return {
        id: (notification?.id as string) || uuidv4(),
        type: 'notification',
        source: (notification?.source as string) || 'system',
        content: (notification?.content as string) || (notification?.message as string) || '',
        metadata: {
          level: (notification?.level as string) || 'info',
          targetId: notification?.targetId,
          targetType: notification?.targetType,
          ...(notification?.metadata as Record<string, any>),
        },
        createdAt: (notification?.createdAt as Date) || new Date(),
      };
    },
  };
}

/**
 * Создает трансформер для преобразования внутренних событий системы
 */
export function createSystemEventTransformer(): MessageTransformer<
  Record<string, unknown>,
  MessageContext
> {
  return {
    name: 'system-event-transformer',
    transform: (event: Record<string, unknown>): MessageContext => {
      return {
        id: (event?.id as string) || uuidv4(),
        type: 'system_event',
        source: 'system',
        content: (event?.content as string) || '',
        metadata: {
          eventType: (event?.eventType as string) || '',
          eventData: (event?.eventData as Record<string, unknown>) || {},
          ...(event?.metadata as Record<string, unknown>),
        },
        createdAt: (event?.createdAt as Date) || new Date(),
      };
    },
  };
}

/**
 * Создает трансформер для преобразования действий персонажей
 */
export function createCharacterActionTransformer(): MessageTransformer<
  Record<string, unknown>,
  MessageContext
> {
  return {
    name: 'character-action-transformer',
    transform: (action: Record<string, unknown>): MessageContext => {
      return {
        id: (action?.id as string) || uuidv4(),
        type: 'character_action',
        source: 'character',
        content: (action?.content as string) || (action?.description as string) || '',
        metadata: {
          characterId: action?.characterId,
          actionType: action?.actionType,
          targetId: action?.targetId,
          targetType: action?.targetType,
          duration: action?.duration,
          ...(action?.metadata as Record<string, unknown>),
        },
        createdAt: (action?.createdAt as Date) || new Date(),
      };
    },
  };
}
