import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';
import { Character } from '../../character/entities/character.entity';
import { TelegramBotProvider } from '../providers/telegram-bot.provider';
import { DialogService } from '../../dialog/services/dialog.service';
import { CharacterService } from './character.service';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private readonly bot;

  constructor(
    private telegramBotProvider: TelegramBotProvider,
    private dialogService: DialogService,
    private characterService: CharacterService,
  ) {
    this.bot = this.telegramBotProvider.getBot();
  }

  // Добавляем новый метод для отправки сообщений от персонажа пользователю
  // Это будет использоваться для проактивных сообщений от персонажей

  /**
   * Отправка сообщения от персонажа пользователю
   * @param telegramId - ID пользователя в Telegram
   * @param message - Текст сообщения
   * @param options - Дополнительные опции (characterId, isProactive, etc.)
   */
  async sendMessageToUser(
    telegramId: string | number,
    message: string,
    options: {
      characterId: number;
      isProactive?: boolean;
      actionType?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      // Отправляем сообщение пользователю
      await this.bot.telegram.sendMessage(telegramId, message);

      // Если указан characterId, сохраняем сообщение в диалог
      if (options.characterId) {
        // Создаем запись в диалоге
        const character = await this.characterService.getCharacterById(options.characterId);
        if (character) {
          // Получаем или создаем диалог
          const dialog = await this.dialogService.getOrCreateDialog(
            telegramId.toString(),
            options.characterId,
          );

          // Сохраняем сообщение как сообщение персонажа
          await this.dialogService.saveCharacterMessageDirect(dialog.id, message, {
            isProactive: options.isProactive || false,
            actionType: options.actionType,
            metadata: options.metadata,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при отправке сообщения пользователю ${telegramId}: ${error.message}`,
      );
    }
  }

  // Отправка главного меню
  async sendMainMenu(ctx: Context): Promise<void> {
    try {
      const keyboard = Markup.keyboard([
        ['👥 Мои персонажи', '➕ Создать персонажа'],
        ['❓ Помощь', '⚙️ Настройки'],
      ])
        .resize()
        .oneTime(false);

      await ctx.reply('Выберите действие:', keyboard);
    } catch (error) {
      this.logger.error(`Ошибка при отправке главного меню: ${error.message}`);
    }
  }

  // Отправка информации о персонаже
  async sendCharacterInfo(ctx: Context, character: Character): Promise<void> {
    const personalityInfo =
      `🌟 Черты характера: ${character.personality.traits.join(', ')}\n` +
      `🎭 Хобби: ${character.personality.hobbies.join(', ')}\n` +
      `😨 Страхи: ${character.personality.fears.join(', ')}\n` +
      `💖 Ценности: ${character.personality.values.join(', ')}\n` +
      `🎵 Муз. вкусы: ${character.personality.musicTaste.join(', ')}`;

    await ctx.reply(
      `📋 Информация о персонаже\n\n` +
        `👤 ${character.name}, ${character.age} лет\n` +
        `🔮 Архетип: ${character.archetype}\n\n` +
        `📝 Биография:\n${character.biography}\n\n` +
        `👗 Внешность:\n${character.appearance}\n\n` +
        `${personalityInfo}\n\n` +
        `📊 Текущее состояние:\n` +
        `💓 Привязанность: ${character.affection}/100\n` +
        `🤝 Доверие: ${character.trust}/100\n` +
        `⚡ Энергия: ${character.energy}/100\n` +
        `🔄 Этап отношений: ${character.relationshipStage}`,
      Markup.inlineKeyboard([
        Markup.button.callback('💬 Начать общение', `chat_with_${character.id}`),
        Markup.button.callback('🔙 К списку персонажей', 'show_characters'),
      ]),
    );
  }

  // Отправка состояния персонажа
  async sendCharacterStatus(ctx: Context, character: any): Promise<void> {
    try {
      let statusText = `
*${character.name}*
Архетип: ${character.archetype}
Личность: ${character.personality}

*Потребности:*
`;

      // Добавляем информацию о потребностях
      if (character.needs && character.needs.length > 0) {
        character.needs.forEach(need => {
          // Определяем индикатор для потребности
          let indicator = '';
          if (need.value >= 80)
            indicator = '🔴'; // Критический уровень
          else if (need.value >= 60)
            indicator = '🟠'; // Высокий уровень
          else if (need.value >= 40)
            indicator = '🟡'; // Средний уровень
          else if (need.value >= 20)
            indicator = '🟢'; // Низкий уровень
          else indicator = '🔵'; // Минимальный уровень

          statusText += `${indicator} ${need.type}: ${need.value}%\n`;
        });
      } else {
        statusText += 'Информация о потребностях недоступна\n';
      }

      // Клавиатура для взаимодействия с персонажем
      const keyboard = Markup.keyboard([['📊 Статус персонажа'], ['🏁 Завершить общение']])
        .resize()
        .oneTime(false);

      await ctx.reply(statusText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Ошибка при отправке статуса персонажа: ${error.message}`);
    }
  }

  // Отправка информации о созданном персонаже
  async sendNewCharacterInfo(ctx: Context, character: Character): Promise<void> {
    const personalityInfo =
      `🌟 Черты характера: ${character.personality.traits.join(', ')}\n` +
      `🎭 Хобби: ${character.personality.hobbies.join(', ')}\n` +
      `😨 Страхи: ${character.personality.fears.join(', ')}\n` +
      `💖 Ценности: ${character.personality.values.join(', ')}\n` +
      `🎵 Муз. вкусы: ${character.personality.musicTaste.join(', ')}`;

    await ctx.reply(
      `✅ Персонаж успешно создан!\n\n` +
        `👤 ${character.name}, ${character.age} лет\n\n` +
        `📝 Биография:\n${character.biography.slice(0, 300)}...\n\n` +
        `👗 Внешность:\n${character.appearance.slice(0, 200)}...\n\n` +
        `${personalityInfo}`,
      Markup.inlineKeyboard([
        Markup.button.callback('💬 Начать общение', `chat_with_${character.id}`),
        Markup.button.callback('🔙 К списку персонажей', 'show_characters'),
      ]),
    );
  }

  // Отправка списка персонажей
  async sendCharacterList(ctx: Context, characters: Character[]): Promise<void> {
    if (characters.length === 0) {
      await ctx.reply(
        'У вас пока нет персонажей. Создайте своего первого персонажа!',
        Markup.inlineKeyboard([Markup.button.callback('Создать персонажа', 'create_character')]),
      );
      return;
    }

    const message =
      'Ваши персонажи:\n\n' +
      characters
        .map((character, index) => {
          return `${index + 1}. ${character.name} (${character.age}), ${character.archetype}\n`;
        })
        .join('\n');

    const buttons = characters.map(character => [
      Markup.button.callback(`💬 ${character.name}`, `chat_with_${character.id}`),
      Markup.button.callback(`ℹ️ Инфо`, `info_${character.id}`),
    ]);

    await ctx.reply(message, Markup.inlineKeyboard(buttons));
  }

  // Отправка кнопок выбора архетипа
  async sendArchetypeSelection(ctx: Context): Promise<void> {
    const archetypeButtons = [
      [
        Markup.button.callback('Нежная', 'archetype_gentle'),
        Markup.button.callback('Роковая', 'archetype_femme_fatale'),
      ],
      [
        Markup.button.callback('Интеллектуалка', 'archetype_intellectual'),
        Markup.button.callback('Авантюристка', 'archetype_adventurous'),
      ],
      [
        Markup.button.callback('Загадочная', 'archetype_mysterious'),
        Markup.button.callback('Заботливая', 'archetype_nurturing'),
      ],
      [
        Markup.button.callback('Бунтарка', 'archetype_rebel'),
        Markup.button.callback('Романтичная', 'archetype_romantic'),
      ],
    ];

    await ctx.reply(
      'Выберите архетип персонажа. ИИ дополнит его биографию, внешность и другие детали автоматически.',
      Markup.inlineKeyboard(archetypeButtons),
    );
  }

  // Отправка справки
  async sendHelpMessage(ctx: Context): Promise<void> {
    try {
      const helpText = `
*AI Character Chat Bot* - бот для общения с виртуальными персонажами, созданными с помощью искусственного интеллекта.

*Основные команды:*
/start - Начать работу с ботом
/characters - Показать ваших персонажей
/create - Создать нового персонажа
/help - Показать эту справку

*Как пользоваться:*
1. Создайте персонажа с помощью команды /create
2. Выберите персонажа из списка /characters
3. Общайтесь с персонажем, отправляя текстовые сообщения
4. Для завершения общения, отправьте /stop

*Особенности персонажей:*
- Персонажи помнят ваши разговоры
- У персонажей есть собственные потребности, которые влияют на их эмоциональное состояние
- Персонажи могут проявлять инициативу и начинать разговор
- Персонажи могут заниматься своими делами, когда вы с ними не общаетесь

По всем вопросам обращайтесь к разработчику: @yourdeveloper
      `;

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error(`Ошибка при отправке справки: ${error.message}`);
    }
  }
}
