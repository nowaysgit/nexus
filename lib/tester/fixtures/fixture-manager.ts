import { Repository, DataSource, EntityTarget } from 'typeorm';
import { Character, CharacterGender } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { User } from '../../../src/user/entities/user.entity';
import { Need } from '../../../src/character/entities/need.entity';
import {
  CharacterMotivation,
  MotivationStatus,
  MotivationIntensity,
} from '../../../src/character/entities/character-motivation.entity';
import { Dialog } from '../../../src/dialog/entities/dialog.entity';
import { Message } from '../../../src/dialog/entities/message.entity';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { Action, ActionStatus } from '../../../src/character/entities/action.entity';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import {
  CharacterMemory,
  MemoryImportanceLevel,
} from '../../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../../src/character/interfaces/memory.interfaces';
import { clearGlobalMemoryStorage } from '../utils/data-source';

/**
 * Типы тестовых данных
 */
export interface ITestData {
  /** Пользователи */
  users?: User[];
  /** Персонажи */
  characters?: Character[];
  /** Потребности */
  needs?: Need[];
  /** Мотивации */
  motivations?: CharacterMotivation[];
  /** Диалоги */
  dialogs?: Dialog[];
  /** Сообщения */
  messages?: Message[];
  /** Действия персонажей */
  actions?: Action[];
  /** Воспоминания персонажей */
  characterMemories?: CharacterMemory[];
  /** Пользовательские данные */
  [key: string]: any;
}

/**
 * Интерфейс для фикстур теста
 */
export interface IFixtureOptions {
  /** Очищать БД перед созданием фикстур */
  cleanBeforeCreate?: boolean;
  /** Очищать БД после выполнения теста */
  cleanAfterTest?: boolean;
}

/**
 * Фабрика фикстур для тестов (только PostgreSQL)
 */
export class FixtureManager {
  private dataSource: DataSource;
  private testData: ITestData = {};
  private options: IFixtureOptions = {
    cleanBeforeCreate: true,
    cleanAfterTest: true,
  };

  /**
   * Конструктор фабрики фикстур
   * @param dataSource DataSource для работы с БД
   * @param options Опции для фикстур
   */
  constructor(dataSource: DataSource, options?: Partial<IFixtureOptions>) {
    this.dataSource = dataSource;
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Получить репозиторий для сущности
   * @param entity Класс сущности
   * @returns Репозиторий для работы с сущностью
   */
  public getRepository<T>(entity: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(entity);
  }

  /**
   * Создает тестового пользователя
   * @param userData Данные пользователя
   * @returns Созданный пользователь
   */
  public async createUser(userData: Partial<User> = {}): Promise<User> {
    const userRepository = this.getRepository(User);

    const defaultUser: Partial<User> = {
      telegramId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: `testuser_${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      ...userData,
    };

    // Проверяем, есть ли метод create в репозитории (реальный PostgreSQL репозиторий)
    const user = userRepository.create
      ? userRepository.create(defaultUser)
      : Object.assign(new User(), defaultUser);
    const savedUser = await userRepository.save(user);

    if (!this.testData.users) {
      this.testData.users = [];
    }
    this.testData.users.push(savedUser);

    return savedUser;
  }

  /**
   * Создает тестового персонажа
   * @param characterData Данные персонажа
   * @returns Созданный персонаж
   */
  public async createCharacter(characterData: Partial<Character> = {}): Promise<Character> {
    const characterRepository = this.getRepository(Character);

    // Если передан user объект, извлекаем userId
    let userId: string | undefined;
    if ('user' in characterData && characterData.user) {
      userId = characterData.user.id;
      // Удаляем user из characterData чтобы не было конфликта
      const { user, ...restCharacterData } = characterData;
      characterData = restCharacterData;
    }

    const defaultCharacter: Partial<Character> = {
      name: `TestCharacter_${Date.now()}`,
      age: 25,
      biography: 'Test character biography',
      appearance: 'Test character appearance',
      gender: CharacterGender.FEMALE,
      archetype: CharacterArchetype.MENTOR,
      personality: {
        traits: ['friendly', 'helpful'],
        values: ['honesty', 'kindness'],
        hobbies: ['technology', 'science'],
        fears: [],
        musicTaste: [],
        strengths: ['empathy'],
        weaknesses: [],
      },
      isActive: true,
      // Устанавливаем userId если он был передан
      ...(userId && { userId }),
      ...characterData,
    };

    const character = characterRepository.create
      ? characterRepository.create(defaultCharacter)
      : Object.assign(new Character(), defaultCharacter);
    const savedCharacter = await characterRepository.save(character);

    if (!this.testData.characters) {
      this.testData.characters = [];
    }
    this.testData.characters.push(savedCharacter);

    return savedCharacter;
  }

  /**
   * Создает потребность персонажа
   * @param needData Данные потребности
   * @returns Созданная потребность
   */
  public async createNeed(needData: Partial<Need> = {}): Promise<Need> {
    const needRepository = this.getRepository(Need);

    const defaultNeed: Partial<Need> = {
      type: CharacterNeedType.COMMUNICATION,
      currentValue: 0,
      maxValue: 100,
      growthRate: 1.0,
      decayRate: 0.1,
      priority: 5,
      threshold: 70,
      isActive: true,
      ...needData,
    };

    const need = needRepository.create
      ? needRepository.create(defaultNeed)
      : Object.assign(new Need(), defaultNeed);
    const savedNeed = await needRepository.save(need);

    if (!this.testData.needs) {
      this.testData.needs = [];
    }
    this.testData.needs.push(savedNeed);

    return savedNeed;
  }

  /**
   * Создает мотивацию персонажа
   * @param characterId ID персонажа
   * @param motivationData Данные мотивации
   * @returns Созданная мотивация
   */
  public async createMotivation(
    characterId: number,
    motivationData: Partial<CharacterMotivation> = {},
  ): Promise<CharacterMotivation> {
    const motivationRepository = this.getRepository(CharacterMotivation);

    const defaultMotivation: Partial<CharacterMotivation> = {
      characterId,
      motivationId: `motivation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: 'Test motivation',
      priority: 5,
      relatedNeed: CharacterNeedType.COMMUNICATION,
      status: MotivationStatus.ACTIVE,
      intensity: MotivationIntensity.MODERATE,
      thresholdValue: 70,
      currentValue: 0,
      accumulationRate: 1.0,
      resourceCost: 10,
      successProbability: 80,
      ...motivationData,
    };

    const motivation = motivationRepository.create
      ? motivationRepository.create(defaultMotivation)
      : Object.assign(new CharacterMotivation(), defaultMotivation);
    const savedMotivation = await motivationRepository.save(motivation);

    if (!this.testData.motivations) {
      this.testData.motivations = [];
    }
    this.testData.motivations.push(savedMotivation);

    return savedMotivation;
  }

  /**
   * Создает диалог
   * @param dialogData Данные диалога
   * @returns Созданный диалог
   */
  public async createDialog(dialogData: Partial<Dialog> = {}): Promise<Dialog> {
    const dialogRepository = this.getRepository(Dialog);

    const defaultDialog: Partial<Dialog> = {
      telegramId: `test_dialog_${Date.now()}`,
      isActive: true,
      title: 'Test Dialog',
      ...dialogData,
    };

    const dialog = dialogRepository.create
      ? dialogRepository.create(defaultDialog)
      : Object.assign(new Dialog(), defaultDialog);
    const savedDialog = await dialogRepository.save(dialog);

    if (!this.testData.dialogs) {
      this.testData.dialogs = [];
    }
    this.testData.dialogs.push(savedDialog);

    return savedDialog;
  }

  /**
   * Создает сообщение в диалоге
   * @param messageData Данные сообщения
   * @returns Созданное сообщение
   */
  public async createMessage(messageData: Partial<Message> = {}): Promise<Message> {
    const messageRepository = this.getRepository(Message);

    const defaultMessage: Partial<Message> = {
      content: 'Test message content',
      isFromUser: true,
      ...messageData,
    };

    const message = messageRepository.create
      ? messageRepository.create(defaultMessage)
      : Object.assign(new Message(), defaultMessage);
    const savedMessage = await messageRepository.save(message);

    if (!this.testData.messages) {
      this.testData.messages = [];
    }
    this.testData.messages.push(savedMessage);

    return savedMessage;
  }

  /**
   * Создает действие персонажа
   * @param actionData Данные действия
   * @returns Созданное действие
   */
  public async createAction(actionData: Partial<Action> = {}): Promise<Action> {
    const actionRepository = this.getRepository(Action);

    const defaultAction: Partial<Action> = {
      type: ActionType.SOCIALIZATION,
      description: 'Test action',
      status: ActionStatus.IN_PROGRESS,
      startTime: new Date(),
      resourceCost: 10,
      successProbability: 80,
      ...actionData,
    };

    const action = actionRepository.create
      ? actionRepository.create(defaultAction)
      : Object.assign(new Action(), defaultAction);
    const savedAction = await actionRepository.save(action);

    if (!this.testData.actions) {
      this.testData.actions = [];
    }
    this.testData.actions.push(savedAction);

    return savedAction;
  }

  /**
   * Создает воспоминание персонажа
   * @param characterId ID персонажа
   * @param memoryData Данные воспоминания
   * @returns Созданное воспоминание
   */
  public async createMemory(
    characterId: number,
    memoryData: Partial<CharacterMemory> = {},
  ): Promise<CharacterMemory> {
    const memoryRepository = this.getRepository(CharacterMemory);

    const defaultMemory: Partial<CharacterMemory> = {
      characterId,
      content: 'Test memory content',
      type: MemoryType.CONVERSATION,
      importance: MemoryImportanceLevel.AVERAGE,
      isActive: true,
      recallCount: 0,
      ...memoryData,
    };

    const memory = memoryRepository.create
      ? memoryRepository.create(defaultMemory)
      : Object.assign(new CharacterMemory(), defaultMemory);
    const savedMemory = await memoryRepository.save(memory);

    if (!this.testData.characterMemories) {
      this.testData.characterMemories = [];
    }
    this.testData.characterMemories.push(savedMemory);

    return savedMemory;
  }

  /**
   * Создает множественные воспоминания персонажа
   * @param characterId ID персонажа
   * @param count Количество воспоминаний
   * @returns Массив созданных воспоминаний
   */
  public async createManyMemories(characterId: number, count: number): Promise<CharacterMemory[]> {
    const memories: CharacterMemory[] = [];

    for (let i = 0; i < count; i++) {
      const memory = await this.createMemory(characterId, {
        content: `Test memory ${i + 1}`,
        importance: MemoryImportanceLevel.AVERAGE,
      });
      memories.push(memory);
    }

    return memories;
  }

  /**
   * Сохраняет пользовательские данные
   * @param key Ключ данных
   * @param data Данные для сохранения
   */
  public saveCustomData(key: string, data: unknown): void {
    this.testData[key] = data;
  }

  /**
   * Получает все тестовые данные
   * @returns Объект с тестовыми данными
   */
  public getTestData(): ITestData {
    return this.testData;
  }

  /**
   * Получает данные по ключу
   * @param key Ключ данных
   * @returns Данные по ключу
   */
  public getData<T>(key: keyof ITestData): T {
    return this.testData[key] as T;
  }

  /**
   * Очищает базу данных
   */
  public async cleanDatabase(): Promise<void> {
    // Очищаем таблицы в обратном порядке зависимостей
    const tableNames = [
      'messages',
      'dialogs',
      'character_memories',
      'character_motivations',
      'character_needs',
      'actions',
      'characters',
      'users',
    ];

    for (const tableName of tableNames) {
      try {
        await this.dataSource.query(`DELETE FROM "${tableName}";`);
        // Сбрасываем автоинкремент для PostgreSQL
        await this.dataSource
          .query(`ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH 1;`)
          .catch(() => {
            // Игнорируем ошибки сброса последовательности
          });
      } catch (error) {
        console.warn(
          `Не удалось очистить таблицу ${tableName}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Очищаем локальные данные
    this.testData = {};

    // Очищаем глобальное хранилище мок DataSource
    clearGlobalMemoryStorage();
  }

  /**
   * Инициализация фикстур
   */
  public async setup(): Promise<void> {
    if (this.options.cleanBeforeCreate) {
      await this.cleanDatabase();
    }
  }

  /**
   * Очистка после тестов
   */
  public async cleanup(): Promise<void> {
    if (this.options.cleanAfterTest) {
      await this.cleanDatabase();
    }
  }

  /**
   * Быстрая оптимизированная очистка
   */
  public async fastCleanupOptimized(): Promise<void> {
    try {
      // Используем TRUNCATE для быстрой очистки (только PostgreSQL)
      const tableNames = [
        'messages',
        'dialogs',
        'character_memories',
        'character_motivations',
        'character_needs',
        'actions',
        'characters',
        'users',
      ];

      // Отключаем проверки внешних ключей
      await this.dataSource.query('SET session_replication_role = replica;');

      for (const tableName of tableNames) {
        await this.dataSource
          .query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`)
          .catch(() => {
            // Fallback к DELETE если TRUNCATE не работает
            this.dataSource.query(`DELETE FROM "${tableName}";`);
          });
      }

      // Включаем обратно проверки внешних ключей
      await this.dataSource.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.warn(
        'Fallback к стандартной очистке:',
        error instanceof Error ? error.message : String(error),
      );
      await this.cleanDatabase();
    }

    this.testData = {};
  }

  /**
   * Создает пакет пользователей, персонажей и диалогов для тестирования
   */
  public async createBatchUserCharacterDialog(
    options: {
      usersCount?: number;
      charactersPerUser?: number;
      dialogsPerCharacter?: number;
      messagesPerDialog?: number;
    } = {},
  ): Promise<{
    users: User[];
    characters: Character[];
    dialogs: Dialog[];
    messages: Message[];
  }> {
    const {
      usersCount = 2,
      charactersPerUser = 2,
      dialogsPerCharacter = 2,
      messagesPerDialog = 3,
    } = options;

    const users: User[] = [];
    const characters: Character[] = [];
    const dialogs: Dialog[] = [];
    const messages: Message[] = [];

    // Создаем пользователей
    for (let i = 0; i < usersCount; i++) {
      const user = await this.createUser({
        username: `testuser_${i}`,
        firstName: `TestUser${i}`,
      });
      users.push(user);

      // Создаем персонажей для каждого пользователя
      for (let j = 0; j < charactersPerUser; j++) {
        const character = await this.createCharacter({
          name: `TestCharacter_${i}_${j}`,
          user: user, // Передаем user объект для установки userId
        });
        characters.push(character);

        // Создаем диалоги для персонажа
        for (let k = 0; k < dialogsPerCharacter; k++) {
          const dialog = await this.createDialog({
            userId: user.id,
            characterId: character.id,
            telegramId: `test_dialog_${i}_${j}_${k}`,
          });
          dialogs.push(dialog);

          // Создаем сообщения для диалога
          for (let l = 0; l < messagesPerDialog; l++) {
            const message = await this.createMessage({
              dialogId: dialog.id,
              // Временно не используем userId из-за несоответствия типов (string vs number)
              // userId: l % 2 === 0 ? user.id : undefined,
              characterId: l % 2 === 1 ? character.id : undefined,
              content: `Test message ${l} in dialog ${dialog.id}`,
              isFromUser: l % 2 === 0,
            });
            messages.push(message);
          }
        }
      }
    }

    return {
      users,
      characters,
      dialogs,
      messages,
    };
  }

  /**
   * Создает пакет тестовых данных для комплексного тестирования
   */
  public async createBatchTestData(
    options: {
      usersCount?: number;
      charactersPerUser?: number;
      needsPerCharacter?: number;
      motivationsPerCharacter?: number;
      actionsPerCharacter?: number;
      dialogsPerCharacter?: number;
      messagesPerDialog?: number;
      memoriesPerCharacter?: number;
    } = {},
  ): Promise<{
    users: User[];
    characters: Character[];
    needs: Need[];
    motivations: CharacterMotivation[];
    actions: Action[];
    dialogs: Dialog[];
    messages: Message[];
    memories: CharacterMemory[];
  }> {
    const {
      usersCount = 2,
      charactersPerUser = 1,
      needsPerCharacter = 3,
      motivationsPerCharacter = 2,
      actionsPerCharacter = 2,
      dialogsPerCharacter = 1,
      messagesPerDialog = 5,
      memoriesPerCharacter = 3,
    } = options;

    const users: User[] = [];
    const characters: Character[] = [];
    const needs: Need[] = [];
    const motivations: CharacterMotivation[] = [];
    const actions: Action[] = [];
    const dialogs: Dialog[] = [];
    const messages: Message[] = [];
    const memories: CharacterMemory[] = [];

    // Создаем пользователей
    for (let i = 0; i < usersCount; i++) {
      const user = await this.createUser({
        username: `testuser_${i}`,
        firstName: `TestUser${i}`,
      });
      users.push(user);

      // Создаем персонажей для каждого пользователя
      for (let j = 0; j < charactersPerUser; j++) {
        const character = await this.createCharacter({
          name: `TestCharacter_${i}_${j}`,
          user: user, // Передаем user объект для установки userId
        });
        characters.push(character);

        // Создаем потребности для персонажа
        const needTypes = [
          CharacterNeedType.COMMUNICATION,
          CharacterNeedType.ATTENTION,
          CharacterNeedType.CONNECTION,
        ];
        for (let k = 0; k < needsPerCharacter && k < needTypes.length; k++) {
          const need = await this.createNeed({
            characterId: character.id,
            type: needTypes[k],
          });
          needs.push(need);
        }

        // Создаем мотивации
        for (let k = 0; k < motivationsPerCharacter; k++) {
          const motivation = await this.createMotivation(character.id, {
            description: `Test motivation ${k} for character ${character.id}`,
          });
          motivations.push(motivation);
        }

        // Создаем действия
        for (let k = 0; k < actionsPerCharacter; k++) {
          const action = await this.createAction({
            characterId: character.id,
            description: `Test action ${k} for character ${character.id}`,
          });
          actions.push(action);
        }

        // Создаем диалоги
        for (let k = 0; k < dialogsPerCharacter; k++) {
          const dialog = await this.createDialog({
            userId: user.id,
            characterId: character.id,
            telegramId: `test_dialog_${i}_${j}_${k}`,
          });
          dialogs.push(dialog);

          // Создаем сообщения для диалога
          for (let l = 0; l < messagesPerDialog; l++) {
            const message = await this.createMessage({
              dialogId: dialog.id,
              // Временно не используем userId из-за несоответствия типов (string vs number)
              // userId: l % 2 === 0 ? user.id : undefined,
              characterId: l % 2 === 1 ? character.id : undefined,
              content: `Test message ${l} in dialog ${dialog.id}`,
              isFromUser: l % 2 === 0,
            });
            messages.push(message);
          }
        }

        // Создаем воспоминания
        const characterMemories = await this.createManyMemories(character.id, memoriesPerCharacter);
        memories.push(...characterMemories);
      }
    }

    return {
      users,
      characters,
      needs,
      motivations,
      actions,
      dialogs,
      messages,
      memories,
    };
  }

  /**
   * Создает оптимизированную настройку персонажа со всеми связанными данными
   */
  public async createOptimizedCharacterSetup(
    options: {
      needsCount?: number;
      motivationsCount?: number;
      actionsCount?: number;
      memoriesCount?: number;
    } = {},
  ): Promise<{
    user: User;
    character: Character;
    needs: Need[];
    motivations: CharacterMotivation[];
    actions: Action[];
    memories: CharacterMemory[];
  }> {
    const { needsCount = 5, motivationsCount = 3, actionsCount = 2, memoriesCount = 10 } = options;

    // Создаем пользователя и персонажа
    const user = await this.createUser();
    const character = await this.createCharacter({
      user: user, // Передаем user объект для установки userId
    });

    // Создаем потребности
    const needs: Need[] = [];
    const needTypes = Object.values(CharacterNeedType);
    for (let i = 0; i < needsCount && i < needTypes.length; i++) {
      const need = await this.createNeed({
        characterId: character.id,
        type: needTypes[i],
        currentValue: Math.random() * 50,
      });
      needs.push(need);
    }

    // Создаем мотивации
    const motivations: CharacterMotivation[] = [];
    for (let i = 0; i < motivationsCount; i++) {
      const motivation = await this.createMotivation(character.id, {
        priority: Math.floor(Math.random() * 10) + 1,
        currentValue: Math.random() * 100,
      });
      motivations.push(motivation);
    }

    // Создаем действия
    const actions: Action[] = [];
    const actionTypes = Object.values(ActionType);
    for (let i = 0; i < actionsCount && i < actionTypes.length; i++) {
      const action = await this.createAction({
        characterId: character.id,
        type: actionTypes[i],
      });
      actions.push(action);
    }

    // Создаем воспоминания
    const memories = await this.createManyMemories(character.id, memoriesCount);

    return {
      user,
      character,
      needs,
      motivations,
      actions,
      memories,
    };
  }
}
