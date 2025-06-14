import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dialog } from '../entities/dialog.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class DialogService {
  private readonly logger = new Logger(DialogService.name);

  constructor(
    @InjectRepository(Dialog)
    private dialogRepository: Repository<Dialog>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  /**
   * Сохраняет сообщение пользователя
   */
  async saveUserMessage(
    telegramId: string,
    characterId: number,
    content: string,
  ): Promise<Message> {
    try {
      // Получаем или создаем диалог
      const dialog = await this.getOrCreateDialog(telegramId, characterId);

      // Создаем новое сообщение
      const message = new Message();
      message.dialog = dialog;
      message.dialogId = dialog.id;
      message.content = content;
      message.isFromUser = true;
      message.createdAt = new Date();

      // Сохраняем сообщение в БД
      const savedMessage = await this.messageRepository.save(message);

      // Обновляем время последнего сообщения в диалоге
      dialog.lastMessageAt = new Date();
      await this.dialogRepository.save(dialog);

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Ошибка при сохранении сообщения пользователя: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Сохраняет сообщение персонажа в ответ на сообщение пользователя
   */
  async saveCharacterMessage(
    userMessageId: number,
    content: string,
  ): Promise<Message> {
    try {
      // Находим сообщение пользователя
      const userMessage = await this.messageRepository.findOne({
        where: { id: userMessageId },
        relations: ['dialog'],
      });

      if (!userMessage) {
        throw new Error(
          `Сообщение пользователя с ID ${userMessageId} не найдено`,
        );
      }

      // Создаем новое сообщение от персонажа
      const message = new Message();
      message.dialog = userMessage.dialog;
      message.dialogId = userMessage.dialogId;
      message.content = content;
      message.isFromUser = false;
      message.replyToMessageId = userMessageId;
      message.createdAt = new Date();

      // Сохраняем сообщение в БД
      const savedMessage = await this.messageRepository.save(message);

      // Обновляем время последнего сообщения в диалоге
      userMessage.dialog.lastMessageAt = new Date();
      await this.dialogRepository.save(userMessage.dialog);

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Ошибка при сохранении сообщения персонажа: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Сохраняет сообщение персонажа напрямую в диалог
   * Используется для проактивных сообщений от персонажей
   */
  async saveCharacterMessageDirect(
    dialogId: number,
    content: string,
    options: {
      isProactive?: boolean;
      actionType?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<Message> {
    try {
      const dialog = await this.dialogRepository.findOne({
        where: { id: dialogId },
        relations: ['messages'],
      });

      if (!dialog) {
        throw new Error(`Диалог с ID ${dialogId} не найден`);
      }

      // Создаем новое сообщение
      const message = new Message();
      message.dialog = dialog;
      message.dialogId = dialog.id;
      message.content = content;
      message.isFromUser = false;
      message.metadata = {
        ...(options.metadata || {}),
        isProactive: options.isProactive || false,
        actionType: options.actionType,
      };
      message.createdAt = new Date();

      // Сохраняем сообщение в БД
      const savedMessage = await this.messageRepository.save(message);

      // Обновляем время последнего сообщения в диалоге
      dialog.lastMessageAt = new Date();
      await this.dialogRepository.save(dialog);

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Ошибка при сохранении сообщения персонажа: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Получает или создает диалог между пользователем и персонажем
   */
  async getOrCreateDialog(
    telegramId: string,
    characterId: number,
  ): Promise<Dialog> {
    try {
      // Ищем существующий диалог
      let dialog = await this.dialogRepository.findOne({
        where: {
          telegramId,
          characterId,
        },
      });

      // Если диалог не найден, создаем новый
      if (!dialog) {
        dialog = new Dialog();
        dialog.telegramId = telegramId;
        dialog.characterId = characterId;
        dialog.startedAt = new Date();
        dialog.lastMessageAt = new Date();
        dialog = await this.dialogRepository.save(dialog);
      }

      return dialog;
    } catch (error) {
      this.logger.error(
        `Ошибка при получении/создании диалога: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Получает историю сообщений диалога
   */
  async getDialogHistory(
    telegramId: string,
    characterId: number,
    limit: number = 20,
  ): Promise<Message[]> {
    try {
      // Получаем диалог
      const dialog = await this.dialogRepository.findOne({
        where: {
          telegramId,
          characterId,
        },
      });

      if (!dialog) {
        return [];
      }

      // Получаем сообщения
      const messages = await this.messageRepository.find({
        where: { dialogId: dialog.id },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return messages.reverse(); // Возвращаем сообщения в хронологическом порядке
    } catch (error) {
      this.logger.error(
        `Ошибка при получении истории диалога: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Форматирует историю диалога для нейросети
   */
  async getFormattedDialogHistoryForAI(
    telegramId: string,
    characterId: number,
    limit: number = 20,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const messages = await this.getDialogHistory(
      telegramId,
      characterId,
      limit,
    );

    return messages.map((message) => ({
      role: message.isFromUser ? 'user' : 'assistant',
      content: message.content,
    }));
  }

  /**
   * Создает новое сообщение в диалоге
   */
  async createMessage(data: {
    dialogId: number;
    content: string;
    isFromUser: boolean;
    replyToMessageId?: number;
    metadata?: Record<string, any>;
  }): Promise<Message> {
    try {
      const dialog = await this.dialogRepository.findOne({
        where: { id: data.dialogId },
      });

      if (!dialog) {
        throw new Error(`Диалог с ID ${data.dialogId} не найден`);
      }

      // Создаем новое сообщение
      const message = new Message();
      message.dialog = dialog;
      message.dialogId = dialog.id;
      message.content = data.content;
      message.isFromUser = data.isFromUser;
      if (data.replyToMessageId) {
        message.replyToMessageId = data.replyToMessageId;
      }
      if (data.metadata) {
        message.metadata = data.metadata;
      }
      message.createdAt = new Date();

      // Сохраняем сообщение в БД
      const savedMessage = await this.messageRepository.save(message);

      // Обновляем время последнего сообщения в диалоге
      dialog.lastMessageAt = new Date();
      await this.dialogRepository.save(dialog);

      return savedMessage;
    } catch (error) {
      this.logger.error(`Ошибка при создании сообщения: ${error.message}`);
      throw error;
    }
  }

  /**
   * Найти диалог по идентификаторам пользователя и персонажа
   */
  async findDialogByUserAndCharacter(
    telegramId: string,
    characterId: number,
  ): Promise<Dialog | null> {
    try {
      return await this.dialogRepository.findOne({
        where: {
          telegramId,
          characterId,
        },
      });
    } catch (error) {
      this.logger.error(`Ошибка при поиске диалога: ${error.message}`);
      return null;
    }
  }

  /**
   * Удалить диалог и все его сообщения
   */
  async deleteDialog(dialogId: number): Promise<boolean> {
    try {
      // Сначала удаляем все сообщения диалога
      await this.messageRepository.delete({ dialogId });

      // Затем удаляем сам диалог
      const result = await this.dialogRepository.delete(dialogId);

      return result.affected > 0;
    } catch (error) {
      this.logger.error(`Ошибка при удалении диалога: ${error.message}`);
      return false;
    }
  }
}
