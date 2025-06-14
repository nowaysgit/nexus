import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { DialogService } from '../services/dialog.service';
import { Message } from '../entities/message.entity';

@Controller('dialogs')
export class DialogController {
  private readonly logger = new Logger(DialogController.name);

  constructor(private readonly dialogService: DialogService) {}

  @Get(':telegramId/:characterId/history')
  async getDialogHistory(
    @Param('telegramId') telegramId: string,
    @Param('characterId') characterId: number,
    @Query('limit') limit: number = 20,
  ): Promise<Message[]> {
    this.logger.log(`Получение истории диалога для ${telegramId} и персонажа ${characterId}`);
    return this.dialogService.getDialogHistory(telegramId, characterId, limit);
  }
}
