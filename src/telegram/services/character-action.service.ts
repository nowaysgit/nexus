import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import {
  ActionService,
  ActionType,
  CharacterAction,
} from '../../character/services/action.service';
import { CharacterService } from '../../character/character.service';
import { SessionService } from './session.service';
import { MessageService } from './message.service';
import { CharacterBehaviorService } from '../../character/services/character-behavior.service';

/**
 * Сервис для управления действиями персонажей в Telegram
 * Интегрирует ActionService с модулем Telegram для выполнения
 * автономных действий и отправки проактивных сообщений пользователям
 */
@Injectable()
export class CharacterActionService {
  private readonly logger = new Logger(CharacterActionService.name);

  // Карта активных разговоров: userId -> characterId
  private activeConversations: Map<number, number> = new Map();

  constructor(
    private actionService: ActionService,
    private characterService: CharacterService,
    private sessionService: SessionService,
    private messageService: MessageService,
    private characterBehaviorService: CharacterBehaviorService,
  ) {
    // Запускаем периодическую проверку для отправки проактивных сообщений
    setInterval(() => this.checkAndSendProactiveMessages(), 3 * 60 * 1000); // Каждые 3 минуты
  }

  /**
   * Регистрирует активный разговор между пользователем и персонажем
   */
  public registerActiveConversation(userId: number, characterId: number): void {
    this.activeConversations.set(userId, characterId);
  }

  /**
   * Удаляет активный разговор
   */
  public removeActiveConversation(userId: number): void {
    this.activeConversations.delete(userId);
  }

  /**
   * Проверяет и обрабатывает сообщение пользователя с учетом текущего действия персонажа
   * @returns true, если сообщение было обработано особым образом; false - если нужна обычная обработка
   */
  public async handleMessageWithActionContext(
    ctx: Context,
    userId: number,
    characterId: number,
    messageText: string,
  ): Promise<boolean> {
    try {
      // Проверяем, выполняет ли персонаж действие
      if (!this.actionService.isPerformingAction(characterId)) {
        return false; // Нет активного действия, обрабатываем сообщение как обычно
      }

      // Получаем текущее действие
      const action = this.actionService.getCurrentAction(characterId);

      if (!action) {
        return false; // На всякий случай, хотя проверка isPerformingAction уже должна была убедиться в наличии действия
      }

      // В зависимости от типа действия, обрабатываем сообщение специальным образом
      switch (action.type) {
        case ActionType.SLEEP:
          // Персонаж спит, отправляем специальное сообщение
          await ctx.reply(
            `*${action.description}*\n\nЯ сейчас сплю и не могу ответить. Разбудите меня позже или подождите, пока я сам проснусь.`,
            { parse_mode: 'Markdown' },
          );
          return true;

        case ActionType.READ:
        case ActionType.WORK:
        case ActionType.EXERCISE:
        case ActionType.RELAX:
        case ActionType.SOCIALIZE:
        case ActionType.CREATE:
        case ActionType.MEDITATE:
          // Персонаж занят, но может кратко ответить
          // Обрабатываем входящее сообщение через CharacterBehaviorService
          await this.characterBehaviorService.processUserMessage(characterId, messageText);

          // Формируем контекст для ответа
          const behaviorContext =
            await this.characterBehaviorService.getBehaviorContextForResponse(characterId);

          // Генерируем краткий ответ с учетом текущего действия
          const response = await this.actionService.generateProactiveMessage(
            characterId,
            ActionType.SEND_MESSAGE,
            `Ты сейчас занимаешься: ${action.description}. Тебе написали сообщение: "${messageText}". Ответь коротко, упоминая, что ты занят, но можешь отвлечься ненадолго. Учитывай свое эмоциональное состояние: ${behaviorContext.emotionalState?.description || 'нейтральное'}.`,
          );

          await ctx.reply(response);
          return true;
      }

      // Для остальных типов действий (общение) используем обычную обработку
      return false;
    } catch (error) {
      this.logger.error(`Ошибка при обработке сообщения с учетом действия: ${error.message}`);
      return false; // В случае ошибки продолжаем с обычной обработкой
    }
  }

  /**
   * Проверяет персонажей и отправляет проактивные сообщения
   */
  private async checkAndSendProactiveMessages(): Promise<void> {
    try {
      // Перебираем активные разговоры
      for (const [userId, characterId] of this.activeConversations.entries()) {
        // Обновляем потребности и генерируем мотивации через CharacterBehaviorService
        await this.characterBehaviorService.processCharacterBehavior(characterId);

        // Получаем мотивации
        const behaviorContext =
          await this.characterBehaviorService.getBehaviorContextForResponse(characterId);
        const motivations = behaviorContext.motivations;

        // Если есть мотивации и случайное число меньше 0.2 (20% шанс)
        if (motivations.length > 0 && Math.random() < 0.2) {
          await this.sendProactiveMessage(userId, characterId, motivations);
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при проверке и отправке проактивных сообщений: ${error.message}`);
    }
  }

  /**
   * Отправляет проактивное сообщение от персонажа пользователю
   */
  private async sendProactiveMessage(
    userId: number,
    characterId: number,
    motivations: any[],
  ): Promise<void> {
    try {
      // Определяем и инициируем действие персонажа
      const action = await this.actionService.determineAndPerformAction(characterId, motivations);

      if (!action) {
        this.logger.log(`Не удалось создать действие для персонажа ${characterId}`);
        return;
      }

      // Получаем данные сессии пользователя
      const session = this.sessionService.getSession(userId);
      if (!session || !session.telegramId) {
        this.logger.warn(`Не удалось найти сессию для пользователя ${userId}`);
        return;
      }

      // Только для действий, связанных с отправкой сообщений
      if (
        [
          ActionType.SEND_MESSAGE,
          ActionType.ASK_QUESTION,
          ActionType.SHARE_STORY,
          ActionType.SHARE_EMOTION,
          ActionType.EXPRESS_NEED,
        ].includes(action.type)
      ) {
        // Получаем контекст поведения персонажа для более точной генерации сообщения
        const behaviorContext =
          await this.characterBehaviorService.getBehaviorContextForResponse(characterId);

        // Генерируем сообщение, если его нет в действии
        const messageContent =
          action.content ||
          (await this.actionService.generateProactiveMessage(
            characterId,
            action.type,
            `Ты хочешь ${action.description}. 
            Твое эмоциональное состояние: ${behaviorContext.emotionalState?.description || 'нейтральное'}.
            Твои основные мотивации: ${motivations
              .slice(0, 2)
              .map(m => m.actionImpulse)
              .join(', ')}. 
            Напиши сообщение в соответствии с этим.`,
          ));

        // Отправляем сообщение пользователю
        await this.messageService.sendMessageToUser(session.telegramId, messageContent, {
          characterId,
          isProactive: true,
          actionType: action.type,
          metadata: action.metadata,
        });

        this.logger.log(
          `Отправлено проактивное сообщение от персонажа ${characterId} пользователю ${userId}: "${messageContent.substring(0, 50)}..."`,
        );
      }
    } catch (error) {
      this.logger.error(`Ошибка при отправке проактивного сообщения: ${error.message}`);
    }
  }

  /**
   * Проверяет, может ли персонаж ответить на сообщение
   * @returns true, если персонаж может ответить; false - если занят и не может ответить
   */
  public canCharacterRespond(characterId: number): boolean {
    // Если персонаж не выполняет действие, он может ответить
    if (!this.actionService.isPerformingAction(characterId)) {
      return true;
    }

    // Получаем текущее действие
    const action = this.actionService.getCurrentAction(characterId);

    if (!action) {
      return true; // Если действие не найдено, считаем что персонаж может ответить
    }

    // Персонаж не может ответить, только если он спит
    return action.type !== ActionType.SLEEP;
  }

  /**
   * Получает контекст действия персонажа для подготовки запроса к нейросети
   */
  public getActionContext(characterId: number): string {
    // Если персонаж не выполняет действие, возвращаем пустую строку
    if (!this.actionService.isPerformingAction(characterId)) {
      return '';
    }

    // Получаем текущее действие
    const action = this.actionService.getCurrentAction(characterId);

    if (!action) {
      return '';
    }

    // Формируем контекст действия
    return (
      `В данный момент ты ${action.description}. ` +
      `Это влияет на твое настроение и доступность для общения.`
    );
  }

  /**
   * Завершает текущее действие персонажа
   */
  public async completeAction(characterId: number): Promise<void> {
    try {
      await this.actionService.completeAction(characterId);
    } catch (error) {
      this.logger.error(`Ошибка при завершении действия: ${error.message}`);
    }
  }

  /**
   * Запускает новое действие персонажа указанного типа
   */
  public async determineAndPerformAction(
    characterId: number,
    motivations: any[],
    actionType?: string,
  ): Promise<CharacterAction | null> {
    try {
      return await this.actionService.determineAndPerformAction(
        characterId,
        motivations,
        actionType,
      );
    } catch (error) {
      this.logger.error(`Ошибка при инициации действия: ${error.message}`);
      return null;
    }
  }
}
