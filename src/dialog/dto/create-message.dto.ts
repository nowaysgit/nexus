import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO для создания сообщения пользователя
 */
export class CreateMessageDto {
  /**
   * Содержимое сообщения
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  /**
   * Дополнительные метаданные сообщения
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
