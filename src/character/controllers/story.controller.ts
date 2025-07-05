import { Controller, Get, Post, Body, Param, Put, NotFoundException } from '@nestjs/common';
import { StoryService } from '../services/core/story.service';
import { StoryEvent } from '../entities/story-event.entity';
import { MessageQueueService, MessagePriority } from '../../message-queue/message-queue.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import {
  MessageContext,
  MessageProcessingResult,
} from '../../common/interfaces/message-processor.interface';
import { LogService } from '../../logging/log.service';

// Функции для безопасного парсинга JSON
function parseCreateEventMessage(content: string): {
  characterId: number;
  eventData: Partial<StoryEvent>;
} {
  const parsed = JSON.parse(content) as unknown;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'characterId' in parsed &&
    'eventData' in parsed
  ) {
    return parsed as { characterId: number; eventData: Partial<StoryEvent> };
  }
  throw new Error('Invalid create event message format');
}

function parseCheckEventMessage(content: string): { characterId: number; dialogId: number } {
  const parsed = JSON.parse(content) as unknown;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'characterId' in parsed &&
    'dialogId' in parsed
  ) {
    return parsed as { characterId: number; dialogId: number };
  }
  throw new Error('Invalid check event message format');
}

function parseDefaultEventMessage(content: string): { characterId: number } {
  const parsed = JSON.parse(content) as unknown;
  if (typeof parsed === 'object' && parsed !== null && 'characterId' in parsed) {
    return parsed as { characterId: number };
  }
  throw new Error('Invalid default event message format');
}

@Controller('story')
export class StoryController {
  constructor(
    private readonly storyService: StoryService,
    private readonly messageQueueService: MessageQueueService,
    private readonly logService: LogService,
  ) {}

  @Post('events/:characterId')
  async createEvent(
    @Param('characterId') characterId: number,
    @Body() eventData: Partial<StoryEvent>,
  ): Promise<StoryEvent> {
    return withErrorHandling(
      async () => {
        // Создаем контекст сообщения для асинхронной обработки
        const messageId = `create_event_${characterId}_${Date.now()}`;
        const messageContext: MessageContext = {
          id: messageId,
          type: 'create_story_event',
          source: 'api',
          content: JSON.stringify({ characterId, eventData }),
          createdAt: new Date(),
          metadata: { characterId, messageId },
        };

        // Функция обработки в очереди
        const processor = async (
          message: MessageContext,
        ): Promise<MessageProcessingResult<StoryEvent>> => {
          let parsed: { characterId: number; eventData: Partial<StoryEvent> } | null = null;
          try {
            parsed = parseCreateEventMessage(message.content);
            const result = await this.storyService.createStoryEvent(
              parsed.characterId,
              parsed.eventData,
            );
            if (!result) {
              throw new NotFoundException(
                `Не удалось создать событие для персонажа ${parsed.characterId}`,
              );
            }
            return { success: true, result, handled: true, context: message };
          } catch (error) {
            this.logService.error('Ошибка при создании события в очереди', {
              error: error as Error,
              characterId: parsed?.characterId || 'unknown',
              messageId: message.metadata?.messageId as string,
            });
            return {
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
              handled: false,
              context: message,
            };
          }
        };

        // Отправляем задачу в очередь с нормальным приоритетом для админ операций
        const result = await this.messageQueueService.enqueue(messageContext, processor, {
          priority: MessagePriority.NORMAL,
          metadata: { operation: 'create_story_event', characterId, messageId },
        });

        if (!result.success) {
          throw new Error(`Ошибка при создании события: ${result.error}`);
        }

        if (!result.result) {
          throw new NotFoundException(`Не удалось создать событие для персонажа ${characterId}`);
        }

        return result.result;
      },
      'создании события',
      this.logService,
      { characterId },
    );
  }

  @Get('events/pending/:characterId')
  async findPendingEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return this.storyService.findPendingEvents(characterId);
  }

  @Get('events/triggered/:characterId')
  async findTriggeredEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return this.storyService.findTriggeredEvents(characterId);
  }

  @Post('events/check/:characterId/:dialogId')
  async checkEvents(
    @Param('characterId') characterId: number,
    @Param('dialogId') dialogId: number,
  ): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        // Создаем контекст сообщения для асинхронной обработки
        const messageId = `check_events_${characterId}_${dialogId}_${Date.now()}`;
        const messageContext: MessageContext = {
          id: messageId,
          type: 'check_story_events',
          source: 'api',
          content: JSON.stringify({ characterId, dialogId }),
          createdAt: new Date(),
          metadata: { characterId, dialogId, messageId },
        };

        // Функция обработки в очереди
        const processor = async (
          message: MessageContext,
        ): Promise<MessageProcessingResult<StoryEvent[]>> => {
          try {
            const parsed = parseCheckEventMessage(message.content);
            const result = await this.storyService.checkEventTriggers(
              parsed.characterId,
              parsed.dialogId,
            );
            // Если result не определен, вернем пустой массив
            return { success: true, result: result || [], handled: true, context: message };
          } catch (error) {
            const parsed = parseCheckEventMessage(message.content);
            this.logService.error('Ошибка при проверке событий в очереди', {
              error: error as Error,
              characterId: parsed.characterId,
              dialogId: parsed.dialogId,
              messageId: message.metadata?.messageId as string,
            });
            return {
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
              handled: false,
              context: message,
            };
          }
        };

        // Отправляем задачу в очередь с высоким приоритетом для интерактивных запросов
        const result = await this.messageQueueService.enqueue(messageContext, processor, {
          priority: MessagePriority.HIGH,
          metadata: { operation: 'check_story_events', characterId, dialogId, messageId },
        });

        if (!result.success) {
          throw new Error(`Ошибка при проверке событий: ${result.error}`);
        }

        // Возвращаем результат или пустой массив в случае undefined
        return result.result || [];
      },
      'проверке событий',
      this.logService,
      { characterId, dialogId },
    );
  }

  @Put('events/:id/complete')
  async completeEvent(@Param('id') id: number): Promise<StoryEvent> {
    return this.storyService.completeEvent(id);
  }

  @Put('events/:id/skip')
  async skipEvent(@Param('id') id: number): Promise<StoryEvent> {
    return this.storyService.skipEvent(id);
  }

  @Post('events/default/:characterId')
  async createDefaultEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return withErrorHandling(
      async () => {
        // Создаем контекст сообщения для асинхронной обработки
        const messageId = `create_default_events_${characterId}_${Date.now()}`;
        const messageContext: MessageContext = {
          id: messageId,
          type: 'create_default_events',
          source: 'api',
          content: JSON.stringify({ characterId }),
          createdAt: new Date(),
          metadata: { characterId, messageId },
        };

        // Функция обработки в очереди
        const processor = async (
          message: MessageContext,
        ): Promise<MessageProcessingResult<StoryEvent[]>> => {
          try {
            const parsed = parseDefaultEventMessage(message.content);
            const result = await this.storyService.createDefaultEvents(parsed.characterId);
            // Если result не определен, вернем пустой массив
            return { success: true, result: result || [], handled: true, context: message };
          } catch (error) {
            const parsed = parseDefaultEventMessage(message.content);
            this.logService.error('Ошибка при создании стандартных событий в очереди', {
              error: error as Error,
              characterId: parsed.characterId,
              messageId: message.metadata?.messageId as string,
            });
            return {
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
              handled: false,
              context: message,
            };
          }
        };

        // Отправляем задачу в очередь с низким приоритетом для неинтерактивных операций
        const result = await this.messageQueueService.enqueue(messageContext, processor, {
          priority: MessagePriority.LOW,
          metadata: { operation: 'create_default_events', characterId, messageId },
        });

        if (!result.success) {
          throw new Error(`Ошибка при создании стандартных событий: ${result.error}`);
        }

        // Возвращаем результат или пустой массив в случае undefined
        return result.result || [];
      },
      'создании стандартных событий',
      this.logService,
      { characterId },
    );
  }
}
