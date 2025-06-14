import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { DialogService } from './dialog.service';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private dialogService: DialogService,
  ) {}

  /**
   * Получение сообщения по ID
   */
  async findById(id: number): Promise<Message | null> {
    try {
      return await this.messageRepository.findOne({
        where: { id },
        relations: ['dialog'],
      });
    } catch (error) {
      this.logger.error(`Ошибка при получении сообщения: ${error.message}`);
      return null;
    }
  }

  /**
   * Получение последних сообщений из диалога
   */
  async findLastMessages(dialogId: number, limit: number = 10): Promise<Message[]> {
    try {
      return await this.messageRepository.find({
        where: { dialogId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Ошибка при получении последних сообщений: ${error.message}`);
      return [];
    }
  }

  /**
   * Формирование истории диалога в формате для отправки в нейросеть
   */
  async getFormattedDialogHistory(
    telegramId: string,
    characterId: number,
    limit: number = 20,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const messages = await this.dialogService.getDialogHistory(telegramId, characterId, limit);

    return messages.map(message => ({
      role: message.isFromUser ? 'user' : 'assistant',
      content: message.content,
    }));
  }
}
