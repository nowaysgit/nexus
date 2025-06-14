import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { ConfigService } from '@nestjs/config';
import { CharacterMetadata, TelegramKeyboardMarkup } from '../interfaces/telegram.interfaces';

/**
 * Сервис для создания и форматирования клавиатур Telegram
 * Извлечен из MessageFormatterService для соблюдения принципа единственной ответственности
 */
@Injectable()
export class KeyboardFormatterService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(KeyboardFormatterService.name);
    this.logService.log('KeyboardFormatterService инициализирован');
  }

  /**
   * Создает главное меню
   */
  createMainMenuKeyboard(): TelegramKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '👤 Мои персонажи', callback_data: 'characters_list' }],
        [{ text: '➕ Создать персонажа', callback_data: 'character_create' }],
        [{ text: '❓ Помощь', callback_data: 'help' }],
      ],
    };
  }

  /**
   * Создает клавиатуру профиля персонажа
   */
  async createCharacterProfileKeyboard(
    character: CharacterMetadata,
  ): Promise<TelegramKeyboardMarkup> {
    const buttons = [
      [
        { text: '💬 Написать', callback_data: `character_chat_${character.id}` },
        { text: '📊 Статус', callback_data: `character_status_${character.id}` },
      ],
      [
        { text: '⚙️ Действия', callback_data: `character_actions_${character.id}` },
        { text: '📝 Редактировать', callback_data: `character_edit_${character.id}` },
      ],
    ];

    // Добавляем кнопку архивирования/разархивирования
    if (character.isArchived) {
      buttons.push([
        { text: '📤 Разархивировать', callback_data: `character_unarchive_${character.id}` },
      ]);
    } else {
      buttons.push([
        { text: '📥 Архивировать', callback_data: `character_archive_${character.id}` },
      ]);
    }

    buttons.push([{ text: '🔙 Назад', callback_data: 'characters_list' }]);

    return { inline_keyboard: buttons };
  }

  /**
   * Создает клавиатуру подтверждения действия
   */
  createConfirmationKeyboard(action: string, entityId: string | number): TelegramKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '✅ Да', callback_data: `confirm_${action}_${entityId}` },
          { text: '❌ Нет', callback_data: `cancel_${action}_${entityId}` },
        ],
      ],
    };
  }

  /**
   * Создает клавиатуру действий персонажа
   */
  createCharacterActionsKeyboard(characterId: string): TelegramKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🎯 Начать действие', callback_data: `action_start_${characterId}` },
          { text: '⏸️ Приостановить', callback_data: `action_pause_${characterId}` },
        ],
        [
          { text: '⏹️ Остановить', callback_data: `action_stop_${characterId}` },
          { text: '📊 Прогресс', callback_data: `action_progress_${characterId}` },
        ],
        [{ text: '🔙 Назад к персонажу', callback_data: `character_profile_${characterId}` }],
      ],
    };
  }

  /**
   * Создает клавиатуру с действиями для персонажа
   */
  createActionKeyboard(characterId: string, actions: string[]): TelegramKeyboardMarkup {
    const buttons = actions.map((action, index) => [
      { text: `${index + 1}. ${action}`, callback_data: `action_${characterId}_${index}` },
    ]);
    buttons.push([{ text: '🔙 Назад', callback_data: `character_status_${characterId}` }]);

    return { inline_keyboard: buttons };
  }

  /**
   * Создает клавиатуру списка персонажей
   */
  createCharacterListKeyboard(characters: CharacterMetadata[]): TelegramKeyboardMarkup {
    const buttons = characters.map(character => [
      { text: character.name, callback_data: `character_view_${character.id}` },
    ]);
    buttons.push([
      { text: '➕ Создать нового', callback_data: 'character_create' },
      { text: '🔙 Главное меню', callback_data: 'main_menu' },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Создает клавиатуру выбора архетипа
   */
  createArchetypeKeyboard(archetypes: string[]): TelegramKeyboardMarkup {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < archetypes.length; i += 2) {
      const row: Array<{ text: string; callback_data: string }> = [];
      row.push({ text: archetypes[i], callback_data: `archetype_${archetypes[i].toLowerCase()}` });
      if (i + 1 < archetypes.length) {
        row.push({
          text: archetypes[i + 1],
          callback_data: `archetype_${archetypes[i + 1].toLowerCase()}`,
        });
      }
      buttons.push(row);
    }
    buttons.push([{ text: '🔙 Назад', callback_data: 'main_menu' }]);

    return { inline_keyboard: buttons };
  }
}
