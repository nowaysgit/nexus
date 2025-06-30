import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { getErrorMessage } from '../../common/utils/error.utils';

/**
 * Интерфейс для парсинга callback данных
 */
export interface ParsedCallback {
  action: string;
  entityId?: string;
  subAction?: string;
  params?: Record<string, any>;
}

/**
 * Объединенный обработчик callback запросов
 * Включает действия, диалоги и настройки
 */
@Injectable()
export class CallbackHandler extends BaseService {
  constructor(logService: LogService) {
    super(logService);
  }

  /**
   * Обработать callback query
   */
  async handleCallback(ctx: Context): Promise<void> {
    try {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const callbackData = this.parseCallbackData(ctx.callbackQuery.data);

      this.logDebug('Обработка callback', {
        userId: ctx.from?.id,
        action: callbackData.action,
        entityId: callbackData.entityId,
      });

      switch (callbackData.action) {
        // Основные действия
        case 'main_menu':
          await this.handleMainMenu(ctx);
          break;
        case 'my_characters':
          await this.handleMyCharacters(ctx);
          break;
        case 'create_character':
          await this.handleCreateCharacter(ctx);
          break;
        case 'help':
          await this.handleHelp(ctx);
          break;

        // Действия с персонажами
        case 'char':
          await this.handleCharacterAction(ctx, callbackData);
          break;

        // Диалоги
        case 'dialog':
          await this.handleDialogAction(ctx, callbackData);
          break;

        // Настройки
        case 'settings':
          await this.handleSettingsAction(ctx, callbackData);
          break;

        default:
          await ctx.answerCbQuery('❌ Неизвестное действие');
          this.logWarning('Неизвестное callback действие', { action: callbackData.action });
      }

      await ctx.answerCbQuery();
    } catch (error) {
      this.logError('Ошибка при обработке callback query', {
        error: getErrorMessage(error),
        callbackData: (ctx.callbackQuery as { data?: string })?.data,
        userId: ctx.from?.id,
      });

      await ctx.answerCbQuery('Произошла ошибка при обработке запроса');
    }
  }

  /**
   * Парсинг callback данных
   */
  private parseCallbackData(data: string): ParsedCallback {
    try {
      const parts = data.split('_');

      return {
        action: parts[0],
        subAction: parts[1],
        entityId: parts[2],
        params: parts.slice(3).reduce(
          (acc, part, index) => {
            acc[`param${index}`] = part;
            return acc;
          },
          {} as Record<string, any>,
        ),
      };
    } catch (error) {
      this.logWarning('Ошибка парсинга callback данных', {
        data,
        error: getErrorMessage(error),
      });
      return { action: 'unknown' };
    }
  }

  // === ОСНОВНЫЕ ДЕЙСТВИЯ ===

  private async handleMainMenu(ctx: Context): Promise<void> {
    const message = `
🤖 *Главное меню*

Выберите действие:
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👥 Мои персонажи', callback_data: 'my_characters' },
          { text: '➕ Создать персонажа', callback_data: 'create_character' },
        ],
        [
          { text: '⚙️ Настройки', callback_data: 'settings_show' },
          { text: '❓ Помощь', callback_data: 'help' },
        ],
      ],
    };

    if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  private async handleMyCharacters(ctx: Context): Promise<void> {
    // Здесь будет логика получения списка персонажей
    const message = `
👥 *Ваши персонажи*

Загружаю список персонажей...
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [{ text: '➕ Создать нового', callback_data: 'create_character' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleCreateCharacter(ctx: Context): Promise<void> {
    const message = `
🎭 *Создание персонажа*

Для создания нового персонажа используйте команду /create или следуйте инструкциям в меню.
    `.trim();

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'main_menu' }]],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleHelp(ctx: Context): Promise<void> {
    const message = `
❓ *Справка*

📚 *Доступные команды:*
/start - Начать работу с ботом
/create - Создать нового персонажа
/list - Показать список персонажей
/settings - Настройки аккаунта
/help - Показать эту справку

💡 *Совет:* Используйте кнопки меню для удобной навигации!
    `.trim();

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Главное меню', callback_data: 'main_menu' }]],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // === ДЕЙСТВИЯ С ПЕРСОНАЖАМИ ===

  private async handleCharacterAction(ctx: Context, data: ParsedCallback): Promise<void> {
    const { subAction, entityId } = data;

    if (!entityId) {
      await ctx.answerCbQuery('❌ Не указан ID персонажа');
      return;
    }

    switch (subAction) {
      case 'select':
        await this.selectCharacter(ctx, entityId);
        break;
      case 'chat':
        await this.startCharacterChat(ctx, entityId);
        break;
      case 'settings':
        await this.showCharacterSettings(ctx, entityId);
        break;
      case 'delete':
        await this.deleteCharacter(ctx, entityId);
        break;
      default:
        await ctx.answerCbQuery('❌ Неизвестное действие с персонажем');
    }
  }

  private async selectCharacter(ctx: Context, characterId: string): Promise<void> {
    const message = `✅ Персонаж выбран\n\nВыберите действие:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💬 Начать чат', callback_data: `char_chat_${characterId}` },
          { text: '⚙️ Настройки', callback_data: `char_settings_${characterId}` },
        ],
        [
          { text: '🗑 Удалить', callback_data: `char_delete_${characterId}` },
          { text: '🔙 К списку', callback_data: 'my_characters' },
        ],
      ],
    };

    await ctx.editMessageText(message, { reply_markup: keyboard });
  }

  private async startCharacterChat(ctx: Context, characterId: string): Promise<void> {
    const message = `💬 Чат с персонажем начат\n\nТеперь вы можете писать сообщения.`;

    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Назад', callback_data: `char_select_${characterId}` }]],
    };

    await ctx.editMessageText(message, { reply_markup: keyboard });
  }

  private async showCharacterSettings(ctx: Context, characterId: string): Promise<void> {
    const message = `
⚙️ *Настройки персонажа*

Выберите настройку для изменения:
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [{ text: '🤖 Автодействия', callback_data: `settings_char_auto_${characterId}` }],
        [{ text: '🔔 Уведомления', callback_data: `settings_char_notify_${characterId}` }],
        [{ text: '📊 Лимиты', callback_data: `settings_char_limits_${characterId}` }],
        [{ text: '🔙 Назад', callback_data: `char_select_${characterId}` }],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async deleteCharacter(ctx: Context, characterId: string): Promise<void> {
    const message = `
⚠️ *Удаление персонажа*

Вы уверены, что хотите удалить этого персонажа?

❗ Это действие нельзя отменить!
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить', callback_data: `char_confirm_delete_${characterId}` },
          { text: '❌ Отмена', callback_data: `char_select_${characterId}` },
        ],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // === ДИАЛОГИ ===

  private async handleDialogAction(ctx: Context, data: ParsedCallback): Promise<void> {
    const { subAction } = data;

    switch (subAction) {
      case 'start':
        await this.startDialog(ctx);
        break;
      case 'end':
        await this.endDialog(ctx);
        break;
      case 'history':
        await this.showDialogHistory(ctx);
        break;
      default:
        await ctx.answerCbQuery('❌ Неизвестное действие с диалогом');
    }
  }

  private async startDialog(ctx: Context): Promise<void> {
    const message = `💬 Диалог начат`;
    const keyboard = {
      inline_keyboard: [[{ text: '🔚 Завершить', callback_data: 'dialog_end' }]],
    };
    await ctx.editMessageText(message, { reply_markup: keyboard });
  }

  private async endDialog(ctx: Context): Promise<void> {
    const message = `✅ Диалог завершен`;
    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Главное меню', callback_data: 'main_menu' }]],
    };
    await ctx.editMessageText(message, { reply_markup: keyboard });
  }

  private async showDialogHistory(ctx: Context): Promise<void> {
    const message = `📚 История диалогов`;
    const keyboard = {
      inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'main_menu' }]],
    };
    await ctx.editMessageText(message, { reply_markup: keyboard });
  }

  // === НАСТРОЙКИ ===

  private async handleSettingsAction(ctx: Context, data: ParsedCallback): Promise<void> {
    const { subAction } = data;

    switch (subAction) {
      case 'show':
        await this.showSettings(ctx);
        break;
      case 'language':
        await this.showLanguageSettings(ctx);
        break;
      case 'notifications':
        await this.showNotificationSettings(ctx);
        break;
      default:
        await ctx.answerCbQuery('❌ Неизвестная настройка');
    }
  }

  private async showSettings(ctx: Context): Promise<void> {
    const message = `
⚙️ *Настройки*

Выберите раздел:
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🌐 Язык', callback_data: 'settings_language' },
          { text: '🔔 Уведомления', callback_data: 'settings_notifications' },
        ],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async showLanguageSettings(ctx: Context): Promise<void> {
    const message = `
🌐 *Настройки языка*

Выберите язык интерфейса:
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🇷🇺 Русский', callback_data: 'settings_set_lang_ru' },
          { text: '🇺🇸 English', callback_data: 'settings_set_lang_en' },
        ],
        [{ text: '🔙 Назад', callback_data: 'settings_show' }],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async showNotificationSettings(ctx: Context): Promise<void> {
    const message = `
🔔 *Настройки уведомлений*

Управление уведомлениями:
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Включить все', callback_data: 'settings_notify_all_on' },
          { text: '❌ Отключить все', callback_data: 'settings_notify_all_off' },
        ],
        [{ text: '🔙 Назад', callback_data: 'settings_show' }],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}
