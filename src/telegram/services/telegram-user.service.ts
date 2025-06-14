import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '../interfaces/context.interface';
import { UserService } from '../../user/services/user.service';
import { AccessKey } from '../../user/entities/access-key.entity';
import { MessageService } from './message.service';
import { CacheService } from '../../cache/cache.service';
import { LogService } from '../../logging/log.service';
import {
  CharacterSettings,
  DEFAULT_CHARACTER_SETTINGS,
} from '../interfaces/character-settings.interface';
import { TelegramCharacterSettings } from '../entities/character-settings.entity';

/**
 * Интерфейс настроек пользователя
 */
export interface UserSettings {
  language: string;
  notifications: boolean;
  autoActions: boolean;
  characterSettings: Record<string, any>;
}

/**
 * Интерфейс preferences в User entity
 */
interface UserPreferences {
  receiveNotifications?: boolean;
  notifications?: boolean;
  autoActions?: boolean;
  characterSettings?: Record<string, any>;
  theme?: string;
  timezone?: string;
}

/**
 * Интерфейс результата инициализации
 */
export interface InitializationResult {
  success: boolean;
  isNewUser: boolean;
  userId: string;
  message?: string;
}

/**
 * Интерфейс расширенного контекста с типизированной сессией
 */

/**
 * Объединенный сервис управления пользователями Telegram
 * Включает управление пользователями, настройки, доступ и настройки персонажей
 */
@Injectable()
export class TelegramUserService {
  // Кэш настроек заменен на единый CacheService
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 минут

  constructor(
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(TelegramCharacterSettings)
    private characterSettingsRepository: Repository<TelegramCharacterSettings>,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
    private readonly cacheService: CacheService,
    private readonly logService: LogService,
  ) {}

  // === ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ===

  /**
   * Инициализировать пользователя при первом запуске
   */
  async initializeUser(ctx: Context): Promise<InitializationResult> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || '';

      if (!telegramId) {
        return {
          success: false,
          isNewUser: false,
          userId: '',
          message: 'Не удалось получить ID пользователя',
        };
      }

      // Проверяем существует ли пользователь
      let user = await this.userService.findByTelegramId(telegramId.toString());
      let isNewUser = false;

      if (!user) {
        // Создаем нового пользователя
        user = await this.userService.createUser({
          telegramId: telegramId.toString(),
          username,
          firstName: ctx.from?.first_name || '',
          lastName: ctx.from?.last_name || '',
          language: ctx.from?.language_code || 'ru',
        });
        isNewUser = true;

        this.logService.log('Создан новый пользователь', {
          userId: user.id,
          telegramId: String(telegramId),
          username,
        });
      } else {
        // Обновляем активность существующего пользователя
        await this.userService.updateLastActivity(user.id);

        this.logService.debug('Пользователь найден', {
          userId: user.id,
          telegramId: String(telegramId),
        });
      }

      return {
        success: true,
        isNewUser,
        userId: user.id,
        message: isNewUser ? 'Добро пожаловать!' : 'С возвращением!',
      };
    } catch (error) {
      this.logService.error('Ошибка инициализации пользователя', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        isNewUser: false,
        userId: '',
        message: 'Ошибка инициализации',
      };
    }
  }

  /**
   * Проверить доступ пользователя
   */
  async checkUserAccess(ctx: Context): Promise<boolean> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) return false;

      const user = await this.userService.findByTelegramId(telegramId.toString());
      return user ? user.isActive : false;
    } catch (error) {
      this.logService.error('Ошибка проверки доступа пользователя', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats(ctx: Context): Promise<{
    charactersCount: number;
    messagesCount: number;
    joinDate: Date;
    lastActivity: Date;
  } | null> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) return null;

      const user = await this.userService.findByTelegramId(telegramId.toString());
      if (!user) return null;

      return {
        charactersCount: user.characters?.length || 0,
        messagesCount: user.messagesCount || 0,
        joinDate: user.createdAt,
        lastActivity: user.lastActivity || user.createdAt,
      };
    } catch (error) {
      this.logService.error('Ошибка получения статистики пользователя', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // === НАСТРОЙКИ ПОЛЬЗОВАТЕЛЕЙ ===

  /**
   * Получить настройки пользователя
   */
  async getUserSettings(ctx: Context): Promise<UserSettings | null> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) return null;

      const user = await this.userService.findByTelegramId(telegramId.toString());
      if (!user) return null;

      const preferences = (user.preferences as UserPreferences) || {};

      return {
        language: user.language || 'ru',
        notifications: preferences.notifications !== false,
        autoActions: preferences.autoActions !== false,
        characterSettings: preferences.characterSettings || {},
      };
    } catch (error) {
      this.logService.error('Ошибка получения настроек пользователя', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Обновить настройки пользователя
   */
  async updateUserSettings(ctx: Context, settings: Partial<UserSettings>): Promise<boolean> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) return false;

      const user = await this.userService.findByTelegramId(telegramId.toString());
      if (!user) return false;

      const currentPreferences = (user.preferences as UserPreferences) || {};
      const updatedPreferences: UserPreferences = {
        ...currentPreferences,
        notifications: settings.notifications,
        autoActions: settings.autoActions,
        characterSettings: settings.characterSettings,
      };

      await this.userService.updateUser(user.id, {
        language: settings.language,
        preferences: updatedPreferences,
      });

      this.logService.log('Настройки пользователя обновлены', {
        userId: user.id,
        settings,
      });

      return true;
    } catch (error) {
      this.logService.error('Ошибка обновления настроек пользователя', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Установить язык пользователя
   */
  async setUserLanguage(ctx: Context, language: string): Promise<boolean> {
    return this.updateUserSettings(ctx, { language });
  }

  /**
   * Переключить уведомления
   */
  async toggleNotifications(ctx: Context): Promise<boolean> {
    try {
      const settings = await this.getUserSettings(ctx);
      if (!settings) return false;

      return this.updateUserSettings(ctx, {
        notifications: !settings.notifications,
      });
    } catch (error) {
      this.logService.error('Ошибка переключения уведомлений', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Переключить автоматические действия
   */
  async toggleAutoActions(ctx: Context): Promise<boolean> {
    try {
      const settings = await this.getUserSettings(ctx);
      if (!settings) return false;

      return this.updateUserSettings(ctx, {
        autoActions: !settings.autoActions,
      });
    } catch (error) {
      this.logService.error('Ошибка переключения автодействий', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // === УПРАВЛЕНИЕ ДОСТУПОМ ===

  /**
   * Проверка наличия доступа у пользователя
   */
  async checkAccess(ctx: Context): Promise<boolean> {
    try {
      // Проверяем, есть ли уже пользователь в БД
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return false;

      const user = await this.userService.findByTelegramId(telegramId);

      // Если пользователь есть и активен - доступ разрешен
      if (user && user.isActive) {
        return true;
      }

      await ctx.reply('Доступ к боту ограничен. Пожалуйста, введите ключ доступа:');

      // Сохраняем состояние в сессии
      if (ctx.session) {
        ctx.session.state = 'waiting_for_access_key';
      }

      return false;
    } catch (error) {
      this.logService.error('Ошибка при проверке доступа', {
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('Произошла ошибка при проверке доступа. Попробуйте позже.');
      return false;
    }
  }

  /**
   * Проверка введенного ключа доступа
   */
  async validateAccessKey(ctx: Context, keyValue: string): Promise<boolean> {
    try {
      const key = await this.accessKeyRepository.findOne({
        where: { key: keyValue, isActive: true },
      });

      if (!key) {
        await ctx.reply(
          'Неверный ключ доступа или ключ был деактивирован. Пожалуйста, попробуйте еще раз.',
        );
        return false;
      }

      // Проверяем, не был ли ключ уже использован
      if (key.isUsed) {
        await ctx.reply('Ключ доступа уже был использован. Пожалуйста, используйте другой ключ.');
        return false;
      }

      // Отмечаем ключ как использованный
      key.isUsed = true;
      key.usedAt = new Date();
      await this.accessKeyRepository.save(key);

      // Создаем/активируем пользователя
      const telegramId = ctx.from?.id?.toString();
      const username = ctx.from?.username || '';

      if (!telegramId) {
        await ctx.reply('Ошибка получения ID пользователя.');
        return false;
      }

      // Создаем пользователя активным
      const user = await this.userService.createUser({
        telegramId,
        username,
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
        language: ctx.from?.language_code || 'ru',
      });

      // Активируем пользователя
      await this.userService.updateUser(user.id, { isActive: true });

      await ctx.reply(
        '✅ Доступ предоставлен! Добро пожаловать в симулятор общения с ИИ-персонажами.',
      );
      await this.messageService.sendMainMenu(ctx);

      // Очищаем состояние ожидания ключа
      if (ctx.session) {
        ctx.session.state = 'main';
      }

      return true;
    } catch (error) {
      this.logService.error('Ошибка при валидации ключа', {
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('Произошла ошибка при проверке ключа. Попробуйте позже.');
      return false;
    }
  }

  /**
   * Генерация нового ключа доступа (для админа)
   */
  async generateAccessKey(
    usageLimit: number | null = null,
    expiryDays: number | null = null,
  ): Promise<AccessKey> {
    try {
      // Генерируем случайный ключ
      const keyValue = this.generateRandomKey(12);

      const newKey = new AccessKey();
      newKey.key = keyValue;
      newKey.isActive = true;

      // В будущем можно использовать usageLimit и expiryDays для расширенного функционала

      const _usageLimit = usageLimit;

      const _expiryDays = expiryDays;

      return await this.accessKeyRepository.save(newKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logService.error(`Ошибка при генерации ключа: ${errorMessage}`);
      throw new Error('Не удалось сгенерировать ключ доступа');
    }
  }

  /**
   * Деактивация ключа доступа (для админа)
   */
  async deactivateAccessKey(keyValue: string): Promise<boolean> {
    try {
      const key = await this.accessKeyRepository.findOne({
        where: { key: keyValue },
      });

      if (!key) {
        return false;
      }

      key.isActive = false;
      await this.accessKeyRepository.save(key);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logService.error(`Ошибка при деактивации ключа: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Получение списка всех ключей (для админа)
   */
  async getAllKeys(): Promise<AccessKey[]> {
    return await this.accessKeyRepository.find();
  }

  // === НАСТРОЙКИ ПЕРСОНАЖЕЙ ===

  /**
   * Получает настройки персонажа по его ID
   */
  async getCharacterSettings(characterId: string | number): Promise<CharacterSettings> {
    const cacheKey = this.getCacheKey(characterId);

    const cachedSettings = await this.cacheService.get<CharacterSettings>(cacheKey);
    if (cachedSettings) {
      return cachedSettings;
    }

    const numericCharacterId =
      typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;

    // Получаем настройки из БД
    let dbSettings = await this.characterSettingsRepository.findOne({
      where: { characterId: numericCharacterId },
    });

    // Если настройки не найдены, создаем новые с настройками по умолчанию
    if (!dbSettings) {
      const defaultSettings = this.getDefaultSettings(numericCharacterId);
      dbSettings = this.characterSettingsRepository.create({
        characterId: numericCharacterId,
        autoActions: defaultSettings.autoActions,
        actionNotifications: defaultSettings.actionNotifications,
        notificationType: defaultSettings.notificationType,
        notificationFormat: defaultSettings.notificationFormat,
        progressNotificationFrequency: defaultSettings.progressNotificationFrequency,
        maxDailyActions: defaultSettings.maxDailyActions,
      });
      dbSettings = await this.characterSettingsRepository.save(dbSettings);
    }

    // Конвертируем в формат CharacterSettings
    const settings: CharacterSettings = {
      characterId: dbSettings.characterId,
      autoActions: dbSettings.autoActions,
      actionNotifications: dbSettings.actionNotifications,
      notificationType: dbSettings.notificationType,
      notificationFormat: dbSettings.notificationFormat,
      progressNotificationFrequency: dbSettings.progressNotificationFrequency,
      maxDailyActions: dbSettings.maxDailyActions,
      updatedAt: dbSettings.updatedAt,
    };

    const ttlSeconds = Math.floor(this.cacheTimeout / 1000);
    await this.cacheService.set(cacheKey, settings, ttlSeconds);

    return settings;
  }

  /**
   * Сохраняет настройки персонажа
   */
  async saveCharacterSettings(settings: CharacterSettings): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(settings.characterId);

      // Обновляем или создаем настройки в БД
      await this.characterSettingsRepository.upsert(
        {
          characterId: settings.characterId,
          autoActions: settings.autoActions,
          actionNotifications: settings.actionNotifications,
          notificationType: settings.notificationType,
          notificationFormat: settings.notificationFormat,
          progressNotificationFrequency: settings.progressNotificationFrequency,
          maxDailyActions: settings.maxDailyActions,
        },
        ['characterId'],
      );

      // Обновляем кеш
      settings.updatedAt = new Date();
      const ttlSeconds = Math.floor(this.cacheTimeout / 1000);
      await this.cacheService.set(cacheKey, settings, ttlSeconds);

      return true;
    } catch (error) {
      this.logService.error('Ошибка сохранения настроек персонажа', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Переключает автоматические действия для персонажа
   */
  async toggleCharacterAutoActions(
    characterId: string | number,
    enabled: boolean,
  ): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.autoActions = enabled;
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка переключения автодействий персонажа', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Переключает уведомления о действиях персонажа
   */
  async toggleActionNotifications(
    characterId: string | number,
    enabled: boolean,
  ): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.actionNotifications = enabled;
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка переключения уведомлений персонажа', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Обновляет тип уведомлений персонажа
   */
  async updateNotificationType(
    characterId: string | number,
    type: 'all' | 'start_end' | 'completion' | 'none',
  ): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.notificationType = type;
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка обновления типа уведомлений', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Обновляет формат уведомлений персонажа
   */
  async updateNotificationFormat(
    characterId: string | number,
    format: 'simple' | 'detailed' | 'emoji',
  ): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.notificationFormat = format;
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка обновления формата уведомлений', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Обновляет частоту уведомлений о прогрессе
   */
  async updateProgressNotificationFrequency(
    characterId: string | number,
    frequency: number,
  ): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.progressNotificationFrequency = Math.max(1, Math.min(100, frequency));
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка обновления частоты уведомлений', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Обновляет максимальное количество действий в день
   */
  async updateMaxDailyActions(characterId: string | number, maxActions: number): Promise<boolean> {
    try {
      const settings = await this.getCharacterSettings(characterId);
      settings.maxDailyActions = Math.max(1, maxActions);
      return await this.saveCharacterSettings(settings);
    } catch (error) {
      this.logService.error('Ошибка обновления лимита действий', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  /**
   * Генерирует случайный ключ доступа
   */
  private generateRandomKey(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Генерирует ключ кэша для настроек персонажа
   */
  private getCacheKey(characterId: string | number): string {
    return `character_settings_${characterId}`;
  }

  /**
   * Возвращает настройки персонажа по умолчанию
   */
  private getDefaultSettings(characterId: string | number): CharacterSettings {
    return {
      ...DEFAULT_CHARACTER_SETTINGS,
      characterId: typeof characterId === 'string' ? parseInt(characterId, 10) : characterId,
      updatedAt: new Date(),
    };
  }
}
