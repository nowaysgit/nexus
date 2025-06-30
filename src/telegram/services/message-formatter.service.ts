import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Character } from '../../character/entities/character.entity';
import { BaseService } from '../../common/base/base.service';
import { Retry } from '../../common/decorators/retry.decorator';
import { CharacterMetadata } from '../interfaces/telegram.interfaces';
import { LogService } from '../../logging/log.service';

/**
 * Типы сообщений для форматирования в Telegram
 */
export enum TelegramMessageType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  CHARACTER_MESSAGE = 'character_message',
  SYSTEM = 'system',
}

/**
 * Интерфейс для шаблона сообщения
 */
export interface MessageTemplate {
  title?: string;
  content: string;
  footer?: string;
  parseMode?: 'Markdown' | 'HTML';
  emoji?: boolean;
}

/**
 * Сервис форматирования сообщений для Telegram
 * Функциональность клавиатур вынесена в отдельный KeyboardFormatterService
 */
@Injectable()
export class MessageFormatterService extends BaseService {
  private readonly maxMessageLength = 4096;

  constructor(
    private readonly configService: ConfigService,
    logService: LogService,
  ) {
    super(logService);
    this.logInfo('Объединенный MessageFormatterService инициализирован');
  }

  // Эмодзи для различных типов сообщений
  private readonly typeEmojis = {
    [TelegramMessageType.INFO]: 'ℹ️',
    [TelegramMessageType.SUCCESS]: '✅',
    [TelegramMessageType.WARNING]: '⚠️',
    [TelegramMessageType.ERROR]: '❌',
    [TelegramMessageType.CHARACTER_MESSAGE]: '💬',
    [TelegramMessageType.SYSTEM]: '🔧',
  };

  // === ФОРМАТИРОВАНИЕ СООБЩЕНИЙ ===

  /**
   * Форматирует сообщение согласно типу и шаблону
   * @param type Тип сообщения
   * @param template Шаблон сообщения
   * @returns Форматированное сообщение
   */
  format(type: TelegramMessageType, template: MessageTemplate): string {
    try {
      const { title, content, footer, emoji = true } = template;
      const prefix = emoji ? `${this.typeEmojis[type]} ` : '';

      let message = '';

      // Добавляем заголовок, если есть
      if (title) {
        message +=
          template.parseMode === 'Markdown'
            ? `*${prefix}${title}*\n\n`
            : `<b>${prefix}${title}</b>\n\n`;
      }

      // Добавляем основное содержимое
      message += content;

      // Добавляем подвал, если есть
      if (footer) {
        message += template.parseMode === 'Markdown' ? `\n\n_${footer}_` : `\n\n<i>${footer}</i>`;
      }

      return message;
    } catch (error) {
      this.logError('Ошибка форматирования сообщения', {
        error: error instanceof Error ? error.message : String(error),
      });
      return template.content; // Возвращаем исходный контент в случае ошибки
    }
  }

  /**
   * Форматирует информационное сообщение
   * @param content Содержимое
   * @param title Заголовок (опционально)
   * @param footer Подвал (опционально)
   * @returns Форматированное информационное сообщение
   */
  formatInfo(content: string, title?: string, footer?: string): string {
    return this.format(TelegramMessageType.INFO, {
      title,
      content,
      footer,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует сообщение об успешном действии
   * @param content Содержимое
   * @param title Заголовок (опционально)
   * @param footer Подвал (опционально)
   * @returns Форматированное сообщение об успехе
   */
  formatSuccess(content: string, title?: string, footer?: string): string {
    return this.format(TelegramMessageType.SUCCESS, {
      title: title || 'Успешно',
      content,
      footer,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует предупреждающее сообщение
   * @param content Содержимое
   * @param title Заголовок (опционально)
   * @param footer Подвал (опционально)
   * @returns Форматированное предупреждение
   */
  formatWarning(content: string, title?: string, footer?: string): string {
    return this.format(TelegramMessageType.WARNING, {
      title: title || 'Внимание',
      content,
      footer,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует сообщение об ошибке
   * @param content Содержимое
   * @param title Заголовок (опционально)
   * @param footer Подвал (опционально)
   * @returns Форматированное сообщение об ошибке
   */
  formatError(content: string, title?: string, footer?: string): string {
    return this.format(TelegramMessageType.ERROR, {
      title: title || 'Ошибка',
      content,
      footer,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует сообщение от персонажа
   * @param character Персонаж
   * @param content Содержимое сообщения
   * @param emotionalState Эмоциональное состояние (опционально)
   * @returns Форматированное сообщение от персонажа
   */
  formatCharacterMessage(character: Character, content: string, emotionalState?: string): string {
    let message = content;

    // Добавляем эмоциональное состояние, если оно указано
    if (emotionalState) {
      message = `_${emotionalState}_\n\n${message}`;
    }

    return this.format(TelegramMessageType.CHARACTER_MESSAGE, {
      title: character.name,
      content: message,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует системное сообщение
   * @param content Содержимое
   * @returns Форматированное системное сообщение
   */
  formatSystemMessage(content: string): string {
    return this.format(TelegramMessageType.SYSTEM, {
      title: 'Система',
      content,
      parseMode: 'Markdown',
    });
  }

  /**
   * Форматирует справочное сообщение
   */
  @Retry()
  async formatHelpMessage(): Promise<string> {
    return this.withErrorHandling('форматировании справочного сообщения', async () => {
      let message = `*Справка по использованию бота*\n\n`;

      message += `🎭 *Персонажи*\n`;
      message += `• /characters - Список ваших персонажей\n`;
      message += `• /create - Создать нового персонажа\n`;
      message += `• /archive - Архивировать персонажа\n\n`;

      message += `💬 *Общение*\n`;
      message += `• Просто напишите сообщение для общения с активным персонажем\n`;
      message += `• Используйте кнопки для быстрых действий\n\n`;

      message += `⚙️ *Настройки*\n`;
      message += `• /settings - Настройки персонажа\n`;
      message += `• /help - Эта справка\n\n`;

      message += `_Для получения дополнительной помощи обратитесь к администратору._`;

      return message;
    });
  }

  /**
   * Форматирует информацию о персонаже
   */
  async formatCharacterInfo(character: CharacterMetadata): Promise<string> {
    return this.withErrorHandling('форматировании информации о персонаже', async () => {
      let message = `🎭 *${character.name}*\n\n`;

      if (character.description) {
        message += `📝 *Описание:*\n${character.description}\n\n`;
      }

      message += `📅 *Создан:* ${character.createdAt.toLocaleDateString('ru-RU')}\n`;
      message += `🔄 *Обновлен:* ${character.updatedAt.toLocaleDateString('ru-RU')}\n`;

      if (character.isArchived) {
        message += `\n📦 *Статус:* Архивирован`;
      }

      return message;
    });
  }

  /**
   * Форматирует информацию о новом персонаже
   */
  async formatNewCharacterInfo(character: CharacterMetadata): Promise<string> {
    return this.withErrorHandling('форматировании информации о новом персонаже', async () => {
      let message = `🎉 *Новый персонаж создан!*\n\n`;
      message += `🎭 *Имя:* ${character.name}\n`;

      if (character.description) {
        message += `📝 *Описание:* ${character.description}\n`;
      }

      message += `\n✨ Персонаж готов к общению!`;

      return message;
    });
  }

  /**
   * Форматирует список персонажей
   */
  async formatCharacterList(characters: CharacterMetadata[]): Promise<string> {
    return this.withErrorHandling('форматировании списка персонажей', async () => {
      if (characters.length === 0) {
        return `🎭 *Ваши персонажи*\n\nУ вас пока нет персонажей.\nИспользуйте /create для создания нового персонажа.`;
      }

      let message = `🎭 *Ваши персонажи* (${characters.length})\n\n`;

      characters.forEach(character => {
        const status = character.isArchived ? '📦' : '✨';
        message += `${status} *${character.name}*\n`;
        if (character.description) {
          const shortDesc =
            character.description.length > 50
              ? character.description.substring(0, 50) + '...'
              : character.description;
          message += `   _${shortDesc}_\n`;
        }
        message += `\n`;
      });

      return message;
    });
  }

  /**
   * Форматирует статус персонажа
   */
  async formatCharacterStatus(character: CharacterMetadata, status: string): Promise<string> {
    return this.withErrorHandling('форматировании статуса персонажа', async () => {
      let message = `🎭 *${character.name}*\n\n`;
      message += `📊 *Текущий статус:* ${this.formatStatus(status)}\n`;

      const statusEmoji = this.getStatusEmoji(status);
      if (statusEmoji) {
        message = `${statusEmoji} ${message}`;
      }

      return message;
    });
  }

  /**
   * Форматирует прогресс выполнения действия
   */
  async formatActionProgress(
    characterName: string,
    action: {
      name: string;
      description: string;
      id: string;
      duration?: number;
    },
    progress: {
      percentage: number;
      status: string;
      timeRemaining?: number;
      message?: string;
    },
  ): Promise<string> {
    return this.withErrorHandling('форматировании прогресса действия', async () => {
      let message = `🎭 *${characterName}*\n\n`;
      message += `⚡ *Действие:* ${action.name}\n`;

      if (action.description) {
        message += `📝 *Описание:* ${action.description}\n`;
      }

      // Прогресс-бар
      const progressBar = this.createProgressBar(progress.percentage);
      message += `\n📊 *Прогресс:* ${progress.percentage}%\n${progressBar}\n`;

      message += `📈 *Статус:* ${this.formatStatus(progress.status)}\n`;

      if (progress.timeRemaining) {
        const minutes = Math.ceil(progress.timeRemaining / 60);
        message += `⏱️ *Осталось:* ~${minutes} мин.\n`;
      }

      if (progress.message) {
        message += `\n💬 ${progress.message}`;
      }

      return message;
    });
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  private getStatusEmoji(status: string): string {
    const statusEmojis: Record<string, string> = {
      active: '🟢',
      inactive: '🔴',
      busy: '🟡',
      sleeping: '😴',
      thinking: '🤔',
      talking: '💬',
      working: '⚡',
      resting: '😌',
    };

    return statusEmojis[status.toLowerCase()] || '⚪';
  }

  private formatStatus(status: string): string {
    const statusTranslations: Record<string, string> = {
      active: 'Активен',
      inactive: 'Неактивен',
      busy: 'Занят',
      sleeping: 'Спит',
      thinking: 'Думает',
      talking: 'Разговаривает',
      working: 'Работает',
      resting: 'Отдыхает',
    };

    return statusTranslations[status.toLowerCase()] || status;
  }

  private createProgressBar(percentage: number): string {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }

  private truncateText(text: string): string {
    if (text.length <= this.maxMessageLength) {
      return text;
    }

    return text.substring(0, this.maxMessageLength - 3) + '...';
  }
}
