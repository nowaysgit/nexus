import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';

/**
 * Типы проактивных действий персонажа
 */
export enum ProactiveActionType {
  GREETING = 'greeting',
  QUESTION = 'question',
  STORY_CONTINUATION = 'story_continuation',
  EMOTIONAL_RESPONSE = 'emotional_response',
  CURIOSITY = 'curiosity',
  SUGGESTION = 'suggestion',
  MEMORY_SHARING = 'memory_sharing',
  OTHER = 'other',
}

/**
 * DTO для создания проактивного сообщения персонажа
 */
export class CreateProactiveMessageDto {
  /**
   * Тип проактивного действия
   */
  @IsEnum(ProactiveActionType)
  actionType: ProactiveActionType;

  /**
   * Название действия
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  actionName: string;

  /**
   * Описание действия/содержимое сообщения
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  actionDescription: string;

  /**
   * Дополнительные метаданные
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
