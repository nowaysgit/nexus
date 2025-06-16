import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  UseFilters,
  UsePipes,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { DialogService } from '../services/dialog.service';
import { Message } from '../entities/message.entity';
import { LogService } from '../../logging/log.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';
import { GlobalExceptionFilter } from '../../logging/global-exception.filter';
import { CreateMessageDto, CreateProactiveMessageDto } from '../dto';

@Controller('dialogs')
@UseFilters(GlobalExceptionFilter)
@UsePipes(new ValidationPipe({ transform: true }))
export class DialogController {
  constructor(
    private readonly dialogService: DialogService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(DialogController.name);
  }

  @Get(':telegramId/:characterId/history')
  async getDialogHistory(
    @Param('telegramId') telegramId: string,
    @Param('characterId') characterId: number,
    @Query('limit') limit: number = 20,
  ): Promise<Message[]> {
    return withErrorHandling(
      async () => {
        this.logService.info(
          `Получение истории диалога для ${telegramId} и персонажа ${characterId}`,
          {
            telegramId,
            characterId,
            limit,
          },
        );

        const messages = await this.dialogService.getDialogHistory(telegramId, characterId, limit);

        if (messages.length === 0) {
          this.logService.warn(
            `Диалог не найден для телеграм ID ${telegramId} и персонажа ${characterId}`,
            { telegramId, characterId, limit },
          );
        }

        return messages;
      },
      'получении истории диалога',
      this.logService,
      { telegramId, characterId, limit },
      [],
    );
  }

  @Post(':telegramId/:characterId/message')
  async processUserMessage(
    @Param('telegramId') telegramId: string,
    @Param('characterId') characterId: number,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    try {
      this.logService.info(`Обработка сообщения пользователя для персонажа ${characterId}`, {
        telegramId,
        characterId,
      });

      const content = createMessageDto.content;

      // Сохраняем сообщение пользователя
      const userMessage = await this.dialogService.saveUserMessage(
        telegramId,
        characterId,
        content,
      );

      return userMessage;
    } catch (error) {
      this.logService.error(
        error instanceof Error ? error : `Ошибка при обработке сообщения пользователя: ${error}`,
        { telegramId, characterId },
      );
      throw error;
    }
  }

  @Post(':telegramId/:characterId/initial')
  async generateInitialMessage(
    @Param('telegramId') telegramId: string,
    @Param('characterId') characterId: number,
  ): Promise<Message> {
    if (!telegramId || telegramId.trim() === '') {
      throw new BadRequestException('Telegram ID не может быть пустым');
    }

    if (isNaN(characterId) || characterId <= 0) {
      throw new BadRequestException('ID персонажа должен быть положительным числом');
    }

    try {
      this.logService.info(`Генерация начального сообщения для персонажа ${characterId}`, {
        telegramId,
        characterId,
      });

      // Получаем или создаем диалог
      const dialog = await this.dialogService.getOrCreateDialog(telegramId, characterId);

      // Создаем начальное сообщение
      const initialMessage = await this.dialogService.saveCharacterMessageDirect(
        dialog.id,
        'Привет! Как дела?',
        {
          isProactive: true,
          actionType: 'initial_greeting',
        },
      );

      return initialMessage;
    } catch (error) {
      this.logService.error(
        error instanceof Error ? error : `Ошибка при генерации начального сообщения: ${error}`,
        { telegramId, characterId },
      );
      throw error;
    }
  }

  @Post(':telegramId/:characterId/proactive')
  async generateProactiveMessage(
    @Param('telegramId') telegramId: string,
    @Param('characterId') characterId: number,
    @Body() createProactiveMessageDto: CreateProactiveMessageDto,
  ): Promise<Message> {
    try {
      this.logService.info(`Генерация проактивного сообщения для персонажа ${characterId}`, {
        telegramId,
        characterId,
        actionType: createProactiveMessageDto.actionType,
      });

      // Получаем диалог
      const dialog = await this.dialogService.findActiveDialogByParticipants(
        characterId,
        telegramId,
      );

      if (!dialog) {
        throw new NotFoundException('Активный диалог не найден');
      }

      // Создаем проактивное сообщение
      const proactiveMessage = await this.dialogService.saveCharacterMessageDirect(
        dialog.id,
        createProactiveMessageDto.actionDescription,
        {
          isProactive: true,
          actionType: createProactiveMessageDto.actionType.toString(),
          metadata: {
            actionName: createProactiveMessageDto.actionName,
          },
        },
      );

      return proactiveMessage;
    } catch (error) {
      this.logService.error(
        error instanceof Error ? error : `Ошибка при генерации проактивного сообщения: ${error}`,
        { telegramId, characterId },
      );
      throw error;
    }
  }

  @Get(':id/messages')
  async getDialogWithMessages(@Param('id') dialogId: number): Promise<Record<string, any> | null> {
    try {
      this.logService.info(`Получение диалога с сообщениями для ID: ${dialogId}`);

      const dialog = await this.dialogService.getDialogById(dialogId);
      if (!dialog) {
        throw new NotFoundException(`Диалог с ID ${dialogId} не найден`);
      }

      const messagesResult = await this.dialogService.getDialogMessages(dialogId, 1, 100);

      // Проверяем формат возвращаемого значения и получаем нужные данные
      let messages: Message[];
      let totalMessages: number;

      if (Array.isArray(messagesResult)) {
        // Если это массив сообщений (в тестовом окружении)
        messages = messagesResult;
        totalMessages = messages.length;
      } else {
        // Если это объект с пагинацией (в продакшене)
        messages = messagesResult.messages;
        totalMessages = messagesResult.total;
      }

      return {
        dialog,
        messages,
        totalMessages,
      };
    } catch (error) {
      this.logService.error(
        error instanceof Error ? error : `Ошибка при получении диалога с сообщениями: ${error}`,
        { dialogId },
      );
      throw error;
    }
  }
}
