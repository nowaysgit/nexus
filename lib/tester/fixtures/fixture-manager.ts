import { Repository, DataSource, EntityTarget } from 'typeorm';
import { Character, CharacterGender } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { User } from '../../../src/user/entities/user.entity';
import { Need } from '../../../src/character/entities/need.entity';
import { CharacterMotivation } from '../../../src/character/entities/character-motivation.entity';
import { Dialog } from '../../../src/dialog/entities/dialog.entity';
import { Message } from '../../../src/dialog/entities/message.entity';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { Action, ActionStatus } from '../../../src/character/entities/action.entity';
import { EmotionalState, EmotionCategory } from '../../../src/character/entities/emotional-state';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../../src/character/entities/manipulation-technique.entity';
import {
  StoryPlan,
  StoryMilestone,
  MilestoneStatus,
  TransformationType,
} from '../../../src/character/entities/story-plan.entity';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../../src/character/enums/technique.enums';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import {
  CharacterMemory,
  MemoryImportance,
  MemoryImportanceLevel,
} from '../../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../../src/character/interfaces/memory.interfaces';

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
  /** Эмоциональные состояния */
  emotionalStates?: any[];
  /** Действия персонажей */
  actions?: Action[];
  /** Исполнения манипулятивных техник */
  techniqueExecutions?: TechniqueExecution[];
  /** Профили пользователей для манипуляций */
  userManipulationProfiles?: UserManipulationProfile[];
  /** Планы развития сюжета */
  storyPlans?: StoryPlan[];
  /** Этапы сюжетной линии */
  storyMilestones?: StoryMilestone[];
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
  /** Использовать числовые ID вместо UUID */
  useNumericIds?: boolean;
}

/**
 * Фабрика фикстур для тестов
 */
export class FixtureManager {
  private dataSource: DataSource;
  private testData: ITestData = {};
  private options: IFixtureOptions = {
    cleanBeforeCreate: true,
    cleanAfterTest: true,
    useNumericIds: true,
  };
  private characterRepository: Repository<Character>;
  private dialogRepository: Repository<Dialog>;
  private messageRepository: Repository<Message>;

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
    this.characterRepository = dataSource.getRepository(Character);
    this.dialogRepository = dataSource.getRepository(Dialog);
    this.messageRepository = dataSource.getRepository(Message);
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
   * Преобразует числовой ID в UUID строку
   * @param numericId Числовой ID
   * @returns UUID строка
   * @public для использования в тестах
   */
  public numericToUuid(numericId: number | string): string {
    // Преобразуем числовой ID в строку и дополняем нулями до 32 символов
    const idStr = String(numericId).padStart(32, '0');
    // Форматируем в UUID формат
    return `${idStr.substr(0, 8)}-${idStr.substr(8, 4)}-${idStr.substr(12, 4)}-${idStr.substr(16, 4)}-${idStr.substr(20, 12)}`;
  }

  /**
   * Преобразует UUID в числовой ID
   * @param uuid UUID строка
   * @returns Числовой ID или null, если UUID не может быть преобразован
   * @public для использования в тестах
   */
  public uuidToNumeric(uuid: string): number | null {
    // Проверяем формат UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return null;
    }

    // Удаляем дефисы и проверяем, содержит ли строка только нули
    const cleanUuid = uuid.replace(/-/g, '');
    if (cleanUuid.match(/^0+$/)) {
      return 0;
    }

    // Пытаемся получить числовой ID из UUID, игнорируя ведущие нули
    try {
      // Ищем первый ненулевой символ
      let startIndex = 0;
      while (startIndex < cleanUuid.length && cleanUuid[startIndex] === '0') {
        startIndex++;
      }

      // Если все символы - нули, возвращаем 0
      if (startIndex === cleanUuid.length) {
        return 0;
      }

      // Получаем часть строки, начиная с первого ненулевого символа
      const numericPart = cleanUuid.substring(startIndex);

      // Если строка слишком длинная для числа, возвращаем только первые 9 символов
      if (numericPart.length > 9) {
        return parseInt(numericPart.substring(0, 9));
      }

      return parseInt(numericPart);
    } catch (error) {
      console.warn('Не удалось преобразовать UUID в числовой ID:', error.message);
      return null;
    }
  }

  /**
   * Обеспечивает совместимость ID между строковым (UUID) и числовым форматом
   * @param id ID в любом формате
   * @param targetType Целевой тип ('string' для UUID, 'number' для числового ID)
   * @returns ID в требуемом формате
   * @public для использования в тестах
   */
  public ensureIdFormat(
    id: string | number,
    targetType: 'string' | 'number' = 'number',
  ): string | number {
    if (targetType === 'number') {
      if (typeof id === 'number') {
        return id;
      } else {
        // Проверяем, является ли строка UUID
        const uuidNumber = this.uuidToNumeric(id);
        return uuidNumber !== null ? uuidNumber : parseInt(id);
      }
    } else {
      // targetType === 'string'
      if (typeof id === 'string') {
        // Проверяем, является ли строка UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id) ? id : this.numericToUuid(id);
      } else {
        return this.numericToUuid(id);
      }
    }
  }

  /**
   * Создать тестового пользователя
   * @param userData Данные пользователя
   * @returns Созданный пользователь
   */
  public async createUser(userData: Partial<User> = {}): Promise<User> {
    const userRepository = this.getRepository(User);

    // Ensure unique fields to avoid duplication errors in parallel tests
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;

    const generatedCredentials = {
      telegramId: `tg_${uniqueSuffix}`,
      username: `test_user_${uniqueSuffix}`,
      email: `user_${uniqueSuffix}@example.com`,
    };

    // Если пользователь передал email/username/telegramId вручную, сохраняем их без изменений.
    // Для остальных полей используем автоматически сгенерированные уникальные значения.

    const defaultUser = {
      ...generatedCredentials,
      firstName: 'Тестовый',
      lastName: 'Пользователь',
      isActive: true,
      ...userData,
    } as Partial<User>;

    // Если указан числовой ID и требуются UUID, преобразуем
    if (defaultUser.id && typeof defaultUser.id === 'number' && !this.options.useNumericIds) {
      // Используем явное преобразование типа
      (defaultUser as any).id = this.numericToUuid(defaultUser.id);
    }

    const user = userRepository.create(defaultUser);
    await userRepository.save(user);

    if (!this.testData.users) this.testData.users = [];
    this.testData.users.push(user);

    return user;
  }

  /**
   * Создать тестового персонажа
   * @param characterData Данные персонажа
   * @returns Созданный персонаж
   */
  public async createCharacter(characterData: Partial<Character> = {}): Promise<Character> {
    // Если не указан пользователь, создаем его
    if (!characterData.user && !characterData.userId) {
      // Создаем пользователя и присоединяем его напрямую к character.user
      const user = await this.createUser();
      characterData.user = user;
    } else if (characterData.userId && !characterData.user) {
      // Если указан только userId, обрабатываем его соответствующим образом
      const userId = characterData.userId;

      if (typeof userId === 'number') {
        // Создаем пользователя с числовым ID
        const idValue = this.options.useNumericIds ? userId : this.numericToUuid(userId);
        const user = await this.createUser({
          id: idValue as any, // Используем any для обхода проверки типов
        });
        characterData.user = user;
        delete characterData.userId; // Удаляем, чтобы избежать конфликта
      } else if (typeof userId === 'string') {
        // Проверяем, является ли строка UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (uuidRegex.test(userId)) {
          // Если это UUID, используем как есть
          const user = await this.createUser({ id: userId });
          characterData.user = user;
        } else {
          // Если это не UUID, преобразуем в числовой ID или UUID в зависимости от настроек
          const numericId = parseInt(userId);
          const idValue = this.options.useNumericIds ? numericId : this.numericToUuid(numericId);
          const user = await this.createUser({
            id: idValue as any, // Используем any для обхода проверки типов
          });
          characterData.user = user;
        }

        delete characterData.userId; // Удаляем, чтобы избежать конфликта
      }
    }

    // Подготавливаем personality в зависимости от типа
    let personalityData: any = {
      traits: ['умный', 'добрый'],
      hobbies: ['чтение', 'программирование'],
      fears: ['высота', 'одиночество'],
      values: ['знания', 'честность'],
      musicTaste: ['классика', 'электроника'], // Важное поле, которое требуется в тестах
      strengths: ['логика', 'терпение'],
      weaknesses: ['нетерпеливость', 'перфекционизм'],
    };

    if (characterData.personality) {
      if (typeof characterData.personality === 'string') {
        try {
          // Если personality передан как строка, парсим его как JSON
          personalityData = JSON.parse(characterData.personality as string);
        } catch (error) {
          console.warn(
            'Не удалось распарсить personality как JSON, используем значение по умолчанию:',
            error.message,
          );
        }
      } else if (typeof characterData.personality === 'object') {
        // Если personality - объект, проверяем наличие всех необходимых полей
        const requiredFields = [
          'traits',
          'hobbies',
          'fears',
          'values',
          'musicTaste',
          'strengths',
          'weaknesses',
        ];
        const hasAllFields = requiredFields.every(field =>
          Array.isArray((characterData.personality as any)[field]),
        );

        if (hasAllFields) {
          personalityData = characterData.personality;
        } else {
          console.warn(
            'Объект personality не содержит все необходимые поля, дополняем значениями по умолчанию',
          );
          // Объединяем переданные данные с дефолтными, чтобы обеспечить наличие всех полей
          personalityData = {
            traits: ['умный', 'добрый'],
            hobbies: ['чтение', 'программирование'],
            fears: ['высота', 'одиночество'],
            values: ['знания', 'честность'],
            musicTaste: ['классика', 'электроника'],
            strengths: ['логика', 'терпение'],
            weaknesses: ['нетерпеливость', 'перфекционизм'],
            ...(characterData.personality as any),
          };
        }
      }
    }

    // Создаем копию входных данных без personality (чтобы избежать дублирования)
    const { personality, ...restCharacterData } = characterData;

    // Создаем базовые данные персонажа с обязательными полями
    const character = this.characterRepository.create({
      name: 'Test Character',
      age: 25,
      gender: CharacterGender.FEMALE,
      archetype: CharacterArchetype.INTELLECTUAL,
      biography: 'Тестовая биография персонажа',
      appearance: 'Тестовое описание внешности',
      fullName: 'Test Full Name',
      knowledgeAreas: ['общие знания', 'психология'],
      isActive: true,
      ...restCharacterData,
      personality: personalityData,
    });

    const savedCharacter = await this.characterRepository.save(character);

    if (!this.testData.characters) this.testData.characters = [];
    this.testData.characters.push(savedCharacter);

    return savedCharacter;
  }

  /**
   * Создать тестовую потребность
   * @param needData Данные потребности
   * @returns Созданная потребность
   */
  public async createNeed(needData: Partial<Need> = {}): Promise<Need> {
    const needRepository = this.getRepository(Need);

    if (!needData.character && this.testData.characters && this.testData.characters.length > 0) {
      needData.character = this.testData.characters[0];
    }

    if (!needData.character) {
      throw new Error('Необходимо указать персонажа для потребности или создать его заранее');
    }

    const defaultNeed = {
      type: CharacterNeedType.COMMUNICATION,
      priority: 5,
      currentValue: 50,
      maxValue: 100,
      growthRate: 1.0,
      decayRate: 0.5,
      threshold: 80,
      ...needData,
    };

    const need = needRepository.create(defaultNeed);
    await needRepository.save(need);

    if (!this.testData.needs) this.testData.needs = [];
    this.testData.needs.push(need);

    return need;
  }

  /**
   * Создать тестовый диалог
   * @param dialogData Данные диалога
   * @returns Созданный диалог
   */
  public async createDialog(dialogData: Partial<Dialog> = {}): Promise<Dialog> {
    // Создаем пользователя, если не указан
    if (!dialogData.user && !dialogData.userId) {
      const user = await this.createUser();
      dialogData.user = user;
      // Явно указываем userId как число
      dialogData.userId = parseInt(user.id.toString());
    } else if (dialogData.user && !dialogData.userId) {
      // Если указан только объект user, добавляем числовое значение userId
      dialogData.userId = parseInt(dialogData.user.id.toString());
    }

    // Создаем персонажа, если не указан
    if (!dialogData.character && !dialogData.characterId) {
      const user = dialogData.user || (await this.createUser());
      const character = await this.createCharacter({ user });
      dialogData.character = character;
    }

    // Явно задаем ключевые поля согласно типам
    const defaultData = {
      telegramId: `telegram_${Date.now()}_${Math.random().toString().slice(2, 8)}`,
      isActive: true,
      lastInteractionDate: new Date(),
    };

    // Создаем диалог, приоритет у переданных пользователем данных
    const dialog = this.dialogRepository.create({
      ...defaultData,
      ...dialogData,
    });

    const savedDialog = await this.dialogRepository.save(dialog);

    if (!this.testData.dialogs) this.testData.dialogs = [];
    this.testData.dialogs.push(savedDialog);

    return savedDialog;
  }

  /**
   * Создать тестовое сообщение
   * @param messageData Данные сообщения
   * @returns Созданное сообщение
   */
  public async createMessage(messageData: Partial<Message> = {}): Promise<Message> {
    // Создаем диалог, если не указан
    if (!messageData.dialogId && !messageData.dialog) {
      const dialog = await this.createDialog();
      messageData.dialogId = dialog.id;
    }

    // Если указан диалог, но не указаны пользователь и персонаж
    if (messageData.dialogId && !messageData.userId && !messageData.characterId) {
      const dialog = await this.dialogRepository.findOne({
        where: { id: messageData.dialogId },
        relations: ['user', 'character'],
      });

      if (dialog) {
        if (messageData.isFromUser !== false) {
          messageData.userId = dialog.userId;
        } else {
          messageData.characterId = dialog.characterId;
        }
      }
    }

    // Явно задаем ключевые поля согласно типам
    const defaultData = {
      content: 'Test Message Content',
      isFromUser: true,
      metadata: {},
    };

    // Создаем сообщение, приоритет у переданных пользователем данных
    const message = this.messageRepository.create({
      ...defaultData,
      ...messageData,
    });

    const savedMessage = await this.messageRepository.save(message);

    if (!this.testData.messages) this.testData.messages = [];
    this.testData.messages.push(savedMessage);

    return savedMessage;
  }

  /**
   * Сохранить произвольные данные
   * @param key Ключ для данных
   * @param data Данные для сохранения
   */
  public saveCustomData(key: string, data: any): void {
    this.testData[key] = data;
  }

  /**
   * Получить тестовые данные
   * @returns Все тестовые данные
   */
  public getTestData(): ITestData {
    return this.testData;
  }

  /**
   * Получить данные по ключу
   * @param key Ключ данных
   * @returns Данные по указанному ключу
   */
  public getData<T>(key: keyof ITestData): T {
    return this.testData[key] as T;
  }

  /**
   * Очистить тестовую БД
   */
  public async cleanDatabase(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('DataSource не инициализирован');
    }

    try {
      // Отключаем проверку внешних ключей перед очисткой
      await this.dataSource.query('SET session_replication_role = replica;');

      const entities = this.dataSource.entityMetadatas;

      // Сначала удаляем зависимые таблицы, потом основные
      for (const entity of entities.reverse()) {
        try {
          const tableName = entity.tableName;
          await this.dataSource.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
        } catch (error) {
          console.warn(`Не удалось очистить таблицу ${entity.tableName}:`, error.message);
        }
      }

      // Включаем проверку внешних ключей после очистки
      await this.dataSource.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Ошибка при очистке базы данных:', error);
    }

    // Очищаем сохраненные тестовые данные
    this.testData = {};
  }

  /**
   * Подготовить тестовое окружение
   */
  public async setup(): Promise<void> {
    if (this.options.cleanBeforeCreate) {
      await this.cleanDatabase();
    }
  }

  /**
   * Очистить тестовое окружение
   */
  public async cleanup(): Promise<void> {
    if (this.options.cleanAfterTest) {
      await this.cleanDatabase();
    }
  }

  /**
   * Создать тестовое эмоциональное состояние
   * @param emotionalStateData Данные эмоционального состояния
   * @returns Созданное эмоциональное состояние
   */
  public async createEmotionalState(emotionalStateData: any = {}): Promise<any> {
    const emotionalStateRepository = this.dataSource.getTreeRepository('emotional_state');

    // Создаем персонажа, если он не указан
    let character;
    if (!emotionalStateData.character && !emotionalStateData.characterId) {
      character = await this.createCharacter();
      emotionalStateData.characterId = character.id;
    } else if (emotionalStateData.characterId && !emotionalStateData.character) {
      const characterId = this.ensureIdFormat(
        emotionalStateData.characterId,
        this.options.useNumericIds ? 'number' : 'string',
      );
      character = await this.createCharacter({ id: characterId as any });
      emotionalStateData.characterId = character.id;
    }

    const defaultEmotionalState = {
      primary: 'happy',
      secondary: 'calm',
      intensity: 0.7,
      category: EmotionCategory.POSITIVE,
      triggers: ['успешное взаимодействие', 'достижение цели'],
      duration: 3600, // 1 час в секундах
      current: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...emotionalStateData,
    };

    const emotionalState = emotionalStateRepository.create(defaultEmotionalState);
    await emotionalStateRepository.save(emotionalState);

    if (!this.testData.emotionalStates) this.testData.emotionalStates = [];
    this.testData.emotionalStates.push(emotionalState);

    return emotionalState;
  }

  /**
   * Создать тестовое действие персонажа
   * @param actionData Данные действия
   * @returns Созданное действие
   */
  public async createAction(actionData: Partial<Action> = {}): Promise<Action> {
    const actionRepository = this.getRepository(Action);
    // Если не указан персонаж, создаем его
    if (!actionData.character && !actionData.characterId) {
      const character = await this.createCharacter();
      actionData.character = character;
      actionData.characterId = Number(character.id);
    } else if (actionData.characterId && !actionData.character) {
      const characterId = this.ensureIdFormat(
        actionData.characterId,
        this.options.useNumericIds ? 'number' : 'string',
      );
      const character = await this.createCharacter({ id: characterId as any });
      actionData.character = character;
      actionData.characterId = Number(character.id);
    }
    const defaultAction = {
      type: ActionType.INITIATE_CONVERSATION,
      description: 'Инициировать разговор',
      status: ActionStatus.IN_PROGRESS,
      startTime: new Date(),
      expectedDuration: 300,
      successProbability: 80,
      resourceCost: 10,
      relatedNeed: CharacterNeedType.COMMUNICATION,
      metadata: JSON.stringify({}),
      ...actionData,
    };
    const action = actionRepository.create(defaultAction);
    await actionRepository.save(action);
    if (!this.testData.actions) this.testData.actions = [];
    this.testData.actions.push(action);
    return action;
  }

  /**
   * Создать тестовое исполнение манипулятивной техники
   * @param executionData Данные исполнения техники
   * @returns Созданное исполнение техники
   */
  public async createTechniqueExecution(
    executionData: Partial<TechniqueExecution> = {},
  ): Promise<TechniqueExecution> {
    const executionRepository = this.getRepository(TechniqueExecution);
    // Если не указан персонаж, создаем его
    if (!executionData.character && !executionData.characterId) {
      const character = await this.createCharacter();
      executionData.characterId = Number(character.id);
      if (!character.user) {
        const user = await this.createUser();
        executionData.userId = Number(user.id);
      } else {
        executionData.userId = Number(character.user.id);
      }
    } else if (executionData.characterId && !executionData.character) {
      const characterId = this.ensureIdFormat(
        executionData.characterId,
        this.options.useNumericIds ? 'number' : 'string',
      );
      const character = await this.createCharacter({ id: characterId as any });
      executionData.characterId = Number(character.id);
      if (!character.user) {
        const user = await this.createUser();
        executionData.userId = Number(user.id);
      } else {
        executionData.userId = Number(character.user.id);
      }
    }
    if (!executionData.userId) {
      const user = await this.createUser();
      executionData.userId = Number(user.id);
    }
    // Финальная защита от NaN/undefined/null
    if (!executionData.characterId || isNaN(Number(executionData.characterId))) {
      const character = await this.createCharacter();
      executionData.characterId = Number(character.id);
    }
    if (!executionData.userId || isNaN(Number(executionData.userId))) {
      const user = await this.createUser();
      executionData.userId = Number(user.id);
    }
    const defaultExecution = {
      techniqueType: ManipulativeTechniqueType.PUSH_PULL,
      phase: TechniquePhase.PREPARATION,
      intensity: TechniqueIntensity.MEDIUM,
      startTime: new Date(),
      generatedResponse: 'Тестовый ответ с использованием техники',
      effectiveness: 75,
      ethicalScore: 60,
      ...executionData,
    };
    if (defaultExecution.characterId)
      defaultExecution.characterId = Number(defaultExecution.characterId);
    if (defaultExecution.userId) defaultExecution.userId = Number(defaultExecution.userId);
    const execution = executionRepository.create(defaultExecution);
    await executionRepository.save(execution);
    if (!this.testData.techniqueExecutions) this.testData.techniqueExecutions = [];
    this.testData.techniqueExecutions.push(execution);
    return execution;
  }

  /**
   * Создать тестовый профиль пользователя для манипуляций
   * @param profileData Данные профиля
   * @returns Созданный профиль
   */
  public async createUserManipulationProfile(
    profileData: Partial<UserManipulationProfile> = {},
  ): Promise<UserManipulationProfile> {
    const profileRepository = this.getRepository(UserManipulationProfile);
    if (!profileData.userId) {
      const user = await this.createUser();
      profileData.userId = Number(user.id);
    }
    if (!profileData.characterId) {
      const character = await this.createCharacter();
      profileData.characterId = Number(character.id);
    }
    // Финальная защита от NaN/undefined/null
    if (!profileData.userId || isNaN(Number(profileData.userId))) {
      const user = await this.createUser();
      profileData.userId = Number(user.id);
    }
    if (!profileData.characterId || isNaN(Number(profileData.characterId))) {
      const character = await this.createCharacter();
      profileData.characterId = Number(character.id);
    }
    if (profileData.userId) profileData.userId = Number(profileData.userId);
    if (profileData.characterId) profileData.characterId = Number(profileData.characterId);
    const defaultProfile = {
      susceptibilityScore: 65,
      vulnerabilities: ['одиночество', 'признание'],
      successfulTechniques: [ManipulativeTechniqueType.PUSH_PULL],
      resistedTechniques: [ManipulativeTechniqueType.GASLIGHTING],
      emotionalTriggers: ['упоминание семьи', 'финансовые трудности'],
      susceptibilityRatings: {
        [ManipulativeTechniqueType.PUSH_PULL]: 75,
        [ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION]: 80,
        [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL]: 45,
      },
      lastUpdate: new Date(),
      ...profileData,
    };
    if (defaultProfile.userId) defaultProfile.userId = Number(defaultProfile.userId);
    if (defaultProfile.characterId) defaultProfile.characterId = Number(defaultProfile.characterId);
    const profile = profileRepository.create(defaultProfile);
    await profileRepository.save(profile);
    if (!this.testData.userManipulationProfiles) this.testData.userManipulationProfiles = [];
    this.testData.userManipulationProfiles.push(profile);
    return profile;
  }

  /**
   * Создать тестовый план развития сюжета
   * @param planData Данные плана
   * @returns Созданный план
   */
  public async createStoryPlan(planData: Partial<StoryPlan> = {}): Promise<StoryPlan> {
    const planRepository = this.getRepository(StoryPlan);

    // Если не указан персонаж, создаем его
    if (!planData.character && !planData.characterId) {
      const character = await this.createCharacter();
      planData.characterId = character.id;
    } else if (planData.characterId && !planData.character) {
      const characterId = this.ensureIdFormat(
        planData.characterId,
        this.options.useNumericIds ? 'number' : 'string',
      );
      const character = await this.createCharacter({ id: characterId as any });
      planData.characterId = character.id;
    }

    const defaultPlan = {
      title: 'Тестовый сюжетный план',
      description: 'План для эволюции персонажа в тестовом окружении',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
      overallArc: {
        startingState: { confidence: 'low', openness: 'medium' },
        endingState: { confidence: 'high', openness: 'high' },
        majorThemes: ['самореализация', 'преодоление страхов'],
        evolutionDirection: 'growth',
      },
      retrospectivePlanning: {
        preExistingTraits: { introversion: 'high', sensitivity: 'medium' },
        formativeEvents: [
          {
            description: 'Первый успешный проект',
            timeframe: '2 года назад',
            impact: { confidence: '+10%', skills: '+15%' },
          },
        ],
        characterHistory: 'Базовая история персонажа для тестирования',
        pastInfluences: ['наставник', 'книги'],
      },
      adaptabilitySettings: {
        coreEventsRigidity: 8, // 1-10
        detailsFlexibility: 7, // 1-10
        userInfluenceWeight: 6, // 1-10
        emergentEventTolerance: 5, // 1-10
      },
      ...planData,
    };

    const plan = planRepository.create(defaultPlan);
    await planRepository.save(plan);

    if (!this.testData.storyPlans) this.testData.storyPlans = [];
    this.testData.storyPlans.push(plan);

    return plan;
  }

  /**
   * Создать тестовый этап сюжетной линии
   * @param milestoneData Данные этапа
   * @returns Созданный этап
   */
  public async createStoryMilestone(
    milestoneData: Partial<StoryMilestone> = {},
  ): Promise<StoryMilestone> {
    const milestoneRepository = this.getRepository(StoryMilestone);

    // Если не указан план, создаем его
    if (!milestoneData.storyPlan && !milestoneData.storyPlanId) {
      const storyPlan = await this.createStoryPlan();
      milestoneData.storyPlanId = storyPlan.id;
    } else if (milestoneData.storyPlanId && !milestoneData.storyPlan) {
      const storyPlanId = this.ensureIdFormat(
        milestoneData.storyPlanId,
        this.options.useNumericIds ? 'number' : 'string',
      );
      const storyPlan = await this.createStoryPlan({ id: storyPlanId as any });
      milestoneData.storyPlanId = storyPlan.id;
    }

    // Если не указан персонаж, берем из плана или создаем новый
    if (!milestoneData.characterId) {
      if (milestoneData.storyPlanId) {
        const storyPlan = await this.getRepository(StoryPlan).findOne({
          where: { id: milestoneData.storyPlanId as any },
        });
        if (storyPlan) {
          milestoneData.characterId = storyPlan.characterId;
        }
      }

      if (!milestoneData.characterId) {
        const character = await this.createCharacter();
        milestoneData.characterId = character.id;
      }
    }

    const defaultMilestone = {
      title: 'Тестовый этап сюжета',
      description: 'Описание тестового этапа сюжетной линии',
      transformationType: TransformationType.PERSONALITY_CHANGE,
      status: MilestoneStatus.PLANNED,
      plannedMonth: 1,
      plannedDay: 7,
      transformationDetails: {
        currentState: { trait: 'замкнутость', level: 'высокий' },
        targetState: { trait: 'общительность', level: 'средний' },
        progressIndicators: ['инициирует диалоги', 'делится личной информацией'],
        prerequisiteEvents: [],
        transitionMethod: 'gradual' as const,
      },
      causalConnections: {
        triggeringConditions: ['достижение определенного уровня доверия'],
        consequenceEvents: [],
        timelineConstraints: {
          minimumDaysBefore: 3,
          maximumDaysBefore: 14,
        },
      },
      rigidityLevel: 5,
      isKeyMilestone: false,
      ...milestoneData,
    };

    const milestone = milestoneRepository.create(defaultMilestone);
    await milestoneRepository.save(milestone);

    if (!this.testData.storyMilestones) this.testData.storyMilestones = [];
    this.testData.storyMilestones.push(milestone);

    return milestone;
  }

  /**
   * Создать тестовую память персонажа
   * @param memoryData Данные памяти персонажа
   * @returns Созданная память персонажа
   */
  public async createCharacterMemory(
    memoryData: Partial<CharacterMemory> = {},
  ): Promise<CharacterMemory> {
    const memoryRepository = this.getRepository(CharacterMemory);

    // Если не указан персонаж, создаем нового
    if (!memoryData.character && !memoryData.characterId) {
      const character = await this.createCharacter();
      memoryData.characterId = character.id;
    } else if (memoryData.character && !memoryData.characterId) {
      memoryData.characterId = memoryData.character.id;
    }

    // Преобразуем characterId в числовой формат, если используются числовые ID
    if (this.options.useNumericIds && memoryData.characterId) {
      memoryData.characterId = this.ensureIdFormat(memoryData.characterId, 'number') as number;
    }

    const defaultMemory = {
      content: `Тестовое воспоминание ${Date.now()}`,
      type: MemoryType.CONVERSATION,
      importance: MemoryImportanceLevel.AVERAGE,
      memoryDate: new Date(),
      recallCount: 0,
      lastRecalled: null,
      isActive: true,
      summary: 'Краткое описание тестового воспоминания',
      metadata: { testKey: 'testValue', source: 'fixture-manager' },
    };

    const memory = memoryRepository.create({
      ...defaultMemory,
      ...memoryData,
    });

    const savedMemory = await memoryRepository.save(memory);

    // Сохраняем в тестовые данные
    if (!this.testData.characterMemories) {
      this.testData.characterMemories = [];
    }
    this.testData.characterMemories.push(savedMemory);

    return savedMemory;
  }
}
