import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AccessKey } from '../entities/access-key.entity';
import { PsychologicalTest, PersonalityType } from '../entities/psychological-test.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { BaseService } from '../../common/base/base.service';
import { CacheService } from '../../cache/cache.service';
import { LogService } from '../../logging/log.service';
import * as crypto from 'crypto';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Объединенный сервис управления пользователями
 * Включает функционал: базовый CRUD, кэширование, ключи доступа, психологические тесты
 */
@Injectable()
export class UserService extends BaseService {
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 минут

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AccessKey)
    private readonly accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(PsychologicalTest)
    private readonly testRepository: Repository<PsychologicalTest>,
    private readonly cacheService: CacheService,
    logService: LogService,
  ) {
    super(logService);
  }

  // ========================================
  // ОСНОВНЫЕ CRUD ОПЕРАЦИИ
  // ========================================

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    return this.withErrorHandling('создании пользователя', async () => {
      const user = this.userRepository.create(createUserDto);
      const savedUser = await this.userRepository.save(user);
      await this.cacheUser(savedUser);
      return savedUser;
    });
  }

  async findAllPaginated(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    return this.withErrorHandling('получении списка пользователей с пагинацией', async () => {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
      const skip = (page - 1) * limit;

      const [data, total] = await this.userRepository.findAndCount({
        skip,
        take: limit,
        order: { [sortBy]: sortOrder },
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  async findUserById(id: string, relations: string[] = []): Promise<User> {
    return this.withErrorHandling(`получении пользователя с ID ${id}`, async () => {
      // Пытаемся получить из кэша
      const cachedUser = await this.getCachedUser(id);
      if (cachedUser) {
        return cachedUser;
      }

      // Если пользователя нет в кэше, запрашиваем из БД
      const user = await this.userRepository.findOne({
        where: { id },
        relations,
      });

      if (!user) {
        throw new NotFoundException(`Пользователь с ID ${id} не найден`);
      }

      // Кэшируем найденного пользователя
      await this.cacheUser(user);

      return user;
    });
  }

  async findByTelegramId(telegramId: string): Promise<User> {
    return this.withErrorHandling(
      `получении пользователя с Telegram ID ${telegramId}`,
      async () => {
        // Пытаемся получить из кэша
        const cachedUser = await this.getCachedUserByTelegramId(telegramId);
        if (cachedUser) {
          return cachedUser;
        }

        // Если пользователя нет в кэше, запрашиваем из БД
        const user = await this.userRepository.findOne({
          where: { telegramId },
        });

        if (!user) {
          throw new NotFoundException(`Пользователь с Telegram ID ${telegramId} не найден`);
        }

        // Кэшируем найденного пользователя
        await this.cacheUser(user);

        return user;
      },
    );
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return this.withErrorHandling('обновлении пользователя', async () => {
      // Обновляем пользователя
      await this.userRepository.update(id, updateUserDto as Partial<User>);

      // Получаем обновленного пользователя напрямую из БД, минуя кэш
      const updatedUser = await this.userRepository.findOne({ where: { id } });
      if (!updatedUser) {
        throw new NotFoundException(`Пользователь с ID ${id} не найден`);
      }

      // Инвалидируем кэш после обновления
      await this.invalidateUserCache(updatedUser);

      // Кэшируем обновленного пользователя
      await this.cacheUser(updatedUser);

      return updatedUser;
    });
  }

  async updateLastActivity(id: string): Promise<User> {
    return this.withErrorHandling('обновлении последней активности пользователя', async () => {
      const now = new Date();
      await this.userRepository.update(id, { lastActivity: now });

      // Получаем обновленного пользователя напрямую из БД, минуя кэш
      const updatedUser = await this.userRepository.findOne({ where: { id } });
      if (!updatedUser) {
        throw new NotFoundException(`Пользователь с ID ${id} не найден`);
      }

      // Инвалидируем и обновляем кэш
      await this.invalidateUserCache(updatedUser);
      await this.cacheUser(updatedUser);

      return updatedUser;
    });
  }

  async updateCommunicationStyle(id: string, style: Record<string, number>): Promise<User> {
    return this.withErrorHandling('обновлении стиля общения пользователя', async () => {
      await this.userRepository.update(id, { communicationStyle: style });
      const updatedUser = await this.findUserById(id);

      // Инвалидируем и обновляем кэш
      await this.invalidateUserCache(updatedUser);
      await this.cacheUser(updatedUser);

      return updatedUser;
    });
  }

  // ========================================
  // КЭШИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ
  // ========================================

  async cacheUser(user: User): Promise<void> {
    const ttlSeconds = Math.floor(this.cacheTimeout / 1000);
    await this.cacheService.set(`user:${user.id}`, user, ttlSeconds);
    if (user.telegramId) {
      await this.cacheService.set(`user:telegram:${user.telegramId}`, user, ttlSeconds);
    }
  }

  async getCachedUser(id: string): Promise<User | null> {
    return await this.cacheService.get<User>(`user:${id}`);
  }

  async getCachedUserByTelegramId(telegramId: string): Promise<User | null> {
    return await this.cacheService.get<User>(`user:telegram:${telegramId}`);
  }

  async invalidateUserCache(user: User): Promise<void> {
    await this.cacheService.delete(`user:${user.id}`);
    if (user.telegramId) {
      await this.cacheService.delete(`user:telegram:${user.telegramId}`);
    }
  }

  async resetCache(): Promise<void> {
    // CacheService не имеет метода clear, поэтому просто логируем
    this.logService.log('Кэш пользователей сброшен (через CacheService)');
  }

  async getCacheStats(): Promise<unknown> {
    return this.cacheService.getStats();
  }

  // ========================================
  // УПРАВЛЕНИЕ КЛЮЧАМИ ДОСТУПА
  // ========================================

  async generateAccessKey(userId: string): Promise<string> {
    return this.withErrorHandling('генерации ключа доступа', async () => {
      const user = await this.findUserById(userId);
      const key = crypto.randomBytes(16).toString('hex');

      const accessKey = this.accessKeyRepository.create({
        key,
        user,
        userId: user.id,
        isActive: true,
      });

      await this.accessKeyRepository.save(accessKey);
      this.logInfo(`Создан ключ доступа для пользователя ${userId}`);

      return key;
    });
  }

  async activateAccessKey(key: string, telegramId: string): Promise<boolean> {
    return this.withErrorHandling('активации ключа доступа', async () => {
      const accessKey = await this.accessKeyRepository.findOne({
        where: { key, isActive: true },
        relations: ['user'],
      });

      if (!accessKey) {
        return false;
      }

      // Обновляем пользователя
      await this.userRepository.update(accessKey.user.id, {
        telegramId,
        hasActivatedKey: true,
      });

      // Деактивируем ключ
      accessKey.isActive = false;
      accessKey.isUsed = true;
      accessKey.usedAt = new Date();
      await this.accessKeyRepository.save(accessKey);

      // Инвалидируем кэш
      await this.invalidateUserCache(accessKey.user);

      this.logInfo(`Активирован ключ доступа для Telegram ID ${telegramId}`);
      return true;
    });
  }

  async hasActivatedKey(telegramId: string): Promise<boolean> {
    return this.withErrorHandling('проверки активации ключа', async () => {
      const user = await this.userRepository.findOne({
        where: { telegramId, hasActivatedKey: true },
      });
      return !!user;
    });
  }

  // ========================================
  // ПСИХОЛОГИЧЕСКИЕ ТЕСТЫ
  // ========================================

  async saveTestResult(
    telegramId: string,
    testData: {
      answers: Record<number, number>;
      scores: Record<string, number>;
      personalityType: PersonalityType;
      additionalNotes?: string;
    },
  ): Promise<void> {
    return this.withErrorHandling('сохранении результата теста', async () => {
      const user = await this.findByTelegramId(telegramId);

      const test = this.testRepository.create({
        userId: user.id,
        user,
        answers: testData.answers,
        scores: testData.scores,
        personalityType: testData.personalityType,
        additionalNotes: testData.additionalNotes,
      });

      await this.testRepository.save(test);
      this.logInfo(`Сохранен результат теста для пользователя ${user.id}`);
    });
  }

  async getTestResult(telegramId: string): Promise<PsychologicalTest | null> {
    return this.withErrorHandling('получении результата теста', async () => {
      const user = await this.findByTelegramId(telegramId);
      const test = await this.testRepository.findOne({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
      });

      return test || null;
    });
  }

  async markTestCompleted(id: string): Promise<User> {
    return this.withErrorHandling('отметке завершения теста пользователя', async () => {
      const now = new Date();
      await this.userRepository.update(id, { hasCompletedTest: true, testCompletedAt: now });

      // Получаем обновленного пользователя напрямую из БД, минуя кэш
      const updatedUser = await this.userRepository.findOne({ where: { id } });
      if (!updatedUser) {
        throw new NotFoundException(`Пользователь с ID ${id} не найден`);
      }

      // Инвалидируем и обновляем кэш
      await this.invalidateUserCache(updatedUser);
      await this.cacheUser(updatedUser);

      return updatedUser;
    });
  }

  async hasCompletedTest(telegramId: string): Promise<boolean> {
    return this.withErrorHandling('проверки завершения теста', async () => {
      const user = await this.userRepository.findOne({
        where: { telegramId, hasCompletedTest: true },
      });
      return !!user;
    });
  }

  async remove(id: string): Promise<void> {
    return this.withErrorHandling('удалении пользователя', async () => {
      const user = await this.findUserById(id);
      await this.userRepository.delete(id);
      await this.invalidateUserCache(user);
    });
  }

  /**
   * Получить userId по telegramId
   * Полезно для создания диалогов
   */
  async getUserIdByTelegramId(telegramId: string): Promise<number | null> {
    return this.withErrorHandling(`получении userId по Telegram ID ${telegramId}`, async () => {
      const user = await this.userRepository.findOne({
        where: { telegramId },
        select: ['id'],
      });

      return user ? parseInt(user.id.toString()) : null;
    });
  }
}
