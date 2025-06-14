import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessKey } from '../../access/entities/access-key.entity';
import { Context } from '../interfaces/context.interface';
import { Markup } from 'telegraf';
import { MessageService } from './message.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    private messageService: MessageService,
    private userService: UserService,
  ) {}

  // Проверка наличия доступа у пользователя
  async checkAccess(ctx: Context): Promise<boolean> {
    try {
      // Проверяем, есть ли уже пользователь в БД
      const telegramId = ctx.from.id.toString();
      const user = await this.userService.findByTelegramId(telegramId);

      // Если пользователь есть и активен - доступ разрешен
      if (user && user.isActive) {
        return true;
      }

      await ctx.reply('Доступ к боту ограничен. Пожалуйста, введите ключ доступа:');

      // Сохраняем состояние в сессии
      ctx.session.state = 'waiting_for_access_key';

      return false;
    } catch (error) {
      this.logger.error(`Ошибка при проверке доступа: ${error.message}`);
      await ctx.reply('Произошла ошибка при проверке доступа. Попробуйте позже.');
      return false;
    }
  }

  // Проверка введенного ключа доступа
  async validateAccessKey(ctx: Context, keyValue: string): Promise<boolean> {
    try {
      const key = await this.accessKeyRepository.findOne({
        where: { value: keyValue, isActive: true },
      });

      if (!key) {
        await ctx.reply(
          'Неверный ключ доступа или ключ был деактивирован. Пожалуйста, попробуйте еще раз.',
        );
        return false;
      }

      if (key.expiryDate && new Date() > key.expiryDate) {
        await ctx.reply('Ключ доступа истек. Пожалуйста, используйте другой ключ.');
        return false;
      }

      if (key.usageLimit !== null && key.usageCount >= key.usageLimit) {
        await ctx.reply(
          'Достигнут лимит использования ключа. Пожалуйста, используйте другой ключ.',
        );
        return false;
      }

      // Обновляем счетчик использований
      key.usageCount += 1;
      await this.accessKeyRepository.save(key);

      // Создаем/активируем пользователя
      const telegramId = ctx.from.id.toString();
      const username = ctx.from.username || '';

      await this.userService.createOrActivateUser({
        telegramId,
        username,
        isActive: true,
        accessKeyId: key.id,
      });

      await ctx.reply(
        '✅ Доступ предоставлен! Добро пожаловать в симулятор общения с ИИ-персонажами.',
      );
      await this.messageService.sendMainMenu(ctx);

      // Очищаем состояние ожидания ключа
      ctx.session.state = 'main';

      return true;
    } catch (error) {
      this.logger.error(`Ошибка при валидации ключа: ${error.message}`);
      await ctx.reply('Произошла ошибка при проверке ключа. Попробуйте позже.');
      return false;
    }
  }

  // Генерация нового ключа доступа (для админа)
  async generateAccessKey(
    usageLimit: number = null,
    expiryDays: number = null,
  ): Promise<AccessKey> {
    try {
      // Генерируем случайный ключ
      const keyValue = this.generateRandomKey(12);

      const newKey = new AccessKey();
      newKey.value = keyValue;
      newKey.isActive = true;
      newKey.usageCount = 0;
      newKey.usageLimit = usageLimit;

      if (expiryDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        newKey.expiryDate = expiryDate;
      }

      return await this.accessKeyRepository.save(newKey);
    } catch (error) {
      this.logger.error(`Ошибка при генерации ключа: ${error.message}`);
      throw new Error('Не удалось сгенерировать ключ доступа');
    }
  }

  // Деактивация ключа доступа (для админа)
  async deactivateAccessKey(keyValue: string): Promise<boolean> {
    try {
      const key = await this.accessKeyRepository.findOne({
        where: { value: keyValue },
      });

      if (!key) {
        return false;
      }

      key.isActive = false;
      await this.accessKeyRepository.save(key);
      return true;
    } catch (error) {
      this.logger.error(`Ошибка при деактивации ключа: ${error.message}`);
      return false;
    }
  }

  // Получение списка всех ключей (для админа)
  async getAllKeys(): Promise<AccessKey[]> {
    return await this.accessKeyRepository.find();
  }

  // Генерация случайного ключа заданной длины
  private generateRandomKey(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
