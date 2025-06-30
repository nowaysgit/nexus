import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../logging/log.service';
import { Context } from '../interfaces/context.interface';
import { BaseService } from '../../common/base/base.service';
import { getErrorMessage } from '../../common/utils/error.utils';

// === ТИПЫ И ИНТЕРФЕЙСЫ ===

type CommandHandler = (ctx: Context, ...args: string[]) => Promise<void>;
type CallbackHandler = (ctx: Context, data: string) => Promise<void>;

interface Command {
  name: string;
  description: string;
  handler: CommandHandler;
  isAdmin?: boolean;
  argsCount?: number;
}

interface CallbackAction {
  pattern: string | RegExp;
  handler: CallbackHandler;
  description?: string;
}

/**
 * Основной сервис взаимодействия с пользователями Telegram
 * Объединяет команды, callback обработку и базовое управление состояниями
 */
@Injectable()
export class TelegramCoreService extends BaseService {
  constructor(
    logService: LogService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(logService);
  }

  // === КОМАНДЫ ===
  private readonly commands: Map<string, Command> = new Map();

  // === CALLBACK ОБРАБОТКА ===
  private readonly callbackActions: CallbackAction[] = [];

  // === ОБРАБОТКА КОМАНД ===

  /**
   * Регистрирует новую команду
   */
  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
    this.logInfo(`Зарегистрирована команда: /${command.name}`);
  }

  /**
   * Регистрирует набор команд
   */
  registerCommands(commands: Command[]): void {
    commands.forEach(command => this.registerCommand(command));
  }

  /**
   * Проверяет, существует ли команда
   */
  hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }

  /**
   * Получает информацию о команде
   */
  getCommand(commandName: string): Command | undefined {
    return this.commands.get(commandName);
  }

  /**
   * Получает список всех команд
   */
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Получает список админских команд
   */
  getAdminCommands(): Command[] {
    return this.getAllCommands().filter(cmd => cmd.isAdmin);
  }

  /**
   * Получает список обычных команд
   */
  getUserCommands(): Command[] {
    return this.getAllCommands().filter(cmd => !cmd.isAdmin);
  }

  /**
   * Обрабатывает команду
   */
  async executeCommand(ctx: Context, commandName: string, args: string[] = []): Promise<void> {
    return this.withErrorHandling(`выполнении команды /${commandName}`, async () => {
      const command = this.commands.get(commandName);
      if (!command) {
        await ctx.reply(`Команда /${commandName} не найдена.`);
        return;
      }

      // Проверяем количество аргументов
      if (command.argsCount !== undefined && args.length < command.argsCount) {
        await ctx.reply(`Команда /${commandName} требует ${command.argsCount} аргумент(ов).`);
        return;
      }

      // Выполняем команду
      await command.handler(ctx, ...args);
    });
  }

  /**
   * Обрабатывает текстовое сообщение, проверяя наличие команд
   */
  async handleTextAsCommand(ctx: Context, text: string): Promise<boolean> {
    // Проверяем, является ли сообщение командой
    if (!text.startsWith('/')) return false;

    // Разбираем команду и аргументы
    const parts = text.split(' ');
    const commandWithSlash = parts[0];
    const commandName = commandWithSlash.substring(1); // Убираем слеш
    const args = parts.slice(1);

    // Проверяем, существует ли команда
    if (!this.hasCommand(commandName)) return false;

    // Выполняем команду
    await this.executeCommand(ctx, commandName, args);
    return true;
  }

  /**
   * Генерирует сообщение справки со списком доступных команд
   */
  getHelpMessage(includeAdmin: boolean = false): string {
    const commands = includeAdmin ? this.getAllCommands() : this.getUserCommands();
    const commandList = commands.map(cmd => `/${cmd.name} - ${cmd.description}`).join('\n');

    return `Доступные команды:\n\n${commandList}`;
  }

  // === ОБРАБОТКА CALLBACK ЗАПРОСОВ ===

  /**
   * Регистрирует обработчик callback запроса
   */
  registerCallbackAction(action: CallbackAction): void {
    this.callbackActions.push(action);
    this.logInfo(`Зарегистрирован callback обработчик: ${action.pattern}`);
  }

  /**
   * Регистрирует несколько обработчиков callback запросов
   */
  registerCallbackActions(actions: CallbackAction[]): void {
    actions.forEach(action => this.registerCallbackAction(action));
  }

  /**
   * Обрабатывает callback запрос
   */
  async handleCallback(ctx: Context, callbackData: string): Promise<boolean> {
    return this.withErrorHandling(`обработке callback запроса: ${callbackData}`, async () => {
      for (const action of this.callbackActions) {
        let isMatch = false;

        if (typeof action.pattern === 'string') {
          isMatch = callbackData === action.pattern || callbackData.startsWith(action.pattern);
        } else if (action.pattern instanceof RegExp) {
          isMatch = action.pattern.test(callbackData);
        }

        if (isMatch) {
          await action.handler(ctx, callbackData);
          return true;
        }
      }

      // Если не найден подходящий обработчик
      this.logWarning(`Не найден обработчик для callback: ${callbackData}`);
      await ctx.answerCbQuery('Действие не поддерживается');
      return false;
    });
  }

  /**
   * Парсит callback данные в формате "action_param1_param2"
   */
  parseCallbackData(callbackData: string): { action: string; params: string[] } {
    const parts = callbackData.split('_');
    return {
      action: parts[0],
      params: parts.slice(1),
    };
  }

  /**
   * Создает callback данные в формате "action_param1_param2"
   */
  createCallbackData(action: string, ...params: (string | number)[]): string {
    return [action, ...params.map(String)].join('_');
  }

  /**
   * Получает список зарегистрированных callback действий
   */
  getCallbackActions(): CallbackAction[] {
    return [...this.callbackActions];
  }

  /**
   * Проверяет, есть ли обработчик для callback данных
   */
  hasCallbackHandler(callbackData: string): boolean {
    return this.callbackActions.some(action => {
      if (typeof action.pattern === 'string') {
        return callbackData === action.pattern || callbackData.startsWith(action.pattern);
      } else if (action.pattern instanceof RegExp) {
        return action.pattern.test(callbackData);
      }
      return false;
    });
  }

  /**
   * Отвечает на callback запрос
   */
  async answerCallback(ctx: Context, text?: string, showAlert: boolean = false): Promise<void> {
    return this.withErrorHandling('ответе на callback запрос', async () => {
      await ctx.answerCbQuery(text, { show_alert: showAlert });
    });
  }

  /**
   * Обрабатывает callback подтверждения
   */
  async handleConfirmationCallback(
    ctx: Context,
    callbackData: string,
    onConfirm: () => Promise<void>,
    onCancel?: () => Promise<void>,
  ): Promise<void> {
    return this.withErrorHandling('обработке callback подтверждения', async () => {
      if (callbackData.endsWith('_confirm')) {
        await onConfirm();
        await this.answerCallback(ctx, 'Подтверждено');
      } else if (callbackData.endsWith('_cancel')) {
        if (onCancel) {
          await onCancel();
        }
        await this.answerCallback(ctx, 'Отменено');
      }
    });
  }

  /**
   * Получает общую статистику взаимодействий
   */
  getInteractionStats(): {
    commandsCount: number;
    callbackActionsCount: number;
  } {
    return {
      commandsCount: this.commands.size,
      callbackActionsCount: this.callbackActions.length,
    };
  }

  /**
   * Обработчик события для отправки инициативного сообщения
   */
  @OnEvent('telegram.send_initiative_message')
  async handleSendInitiativeMessage(payload: {
    characterId: number;
    message: string;
    context: string;
  }): Promise<void> {
    try {
      this.logInfo(
        `Получен запрос на отправку инициативного сообщения для персонажа ${payload.characterId}`,
        {
          messageLength: payload.message.length,
          context: payload.context,
        },
      );

      // Эмитируем событие для получения активных диалогов персонажа
      this.eventEmitter.emit('telegram.get_active_dialogs', {
        characterId: payload.characterId,
        message: payload.message,
        context: payload.context,
      });

      this.logInfo(
        `Запрос на получение активных диалогов отправлен для персонажа ${payload.characterId}`,
      );
    } catch (error) {
      this.logError('Ошибка обработки запроса на отправку инициативного сообщения', {
        payload,
        error: getErrorMessage(error),
      });
    }
  }
}
