import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeyboardFormatterService } from '../../../src/telegram/services/keyboard-formatter.service';
import { LogService } from '../../../src/logging/log.service';
import { CharacterMetadata } from '../../../src/telegram/interfaces/telegram.interfaces';

// Type helper to extract inline keyboard from result
type InlineKeyboardResult = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

describe('KeyboardFormatterService', () => {
  let service: KeyboardFormatterService;
  let mockConfigService: Partial<ConfigService>;
  let mockLogService: Partial<LogService>;

  const mockCharacter: CharacterMetadata = {
    id: '1',
    name: 'Test Character',
    description: 'Test description',
    avatar: null,
    isArchived: false,
  };

  const mockArchivedCharacter: CharacterMetadata = {
    id: '2',
    name: 'Archived Character',
    description: 'Archived character description',
    avatar: null,
    isArchived: true,
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockLogService = {
      setContext: jest.fn().mockReturnThis(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyboardFormatterService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<KeyboardFormatterService>(KeyboardFormatterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should set context and log initialization', () => {
      expect(mockLogService.setContext).toHaveBeenCalledWith('KeyboardFormatterService');
      expect(mockLogService.log).toHaveBeenCalledWith('KeyboardFormatterService инициализирован');
    });
  });

  describe('createMainMenuKeyboard', () => {
    it('should create main menu keyboard with correct buttons', () => {
      const result = service.createMainMenuKeyboard() as InlineKeyboardResult;

      expect(result).toEqual({
        inline_keyboard: [
          [{ text: '👤 Мои персонажи', callback_data: 'characters_list' }],
          [{ text: '➕ Создать персонажа', callback_data: 'character_create' }],
          [{ text: '❓ Помощь', callback_data: 'help' }],
        ],
      });
    });

    it('should return object with inline_keyboard property', () => {
      const result = service.createMainMenuKeyboard() as InlineKeyboardResult;

      expect(result).toHaveProperty('inline_keyboard');
      expect(Array.isArray(result.inline_keyboard)).toBe(true);
      expect(result.inline_keyboard).toHaveLength(3);
    });
  });

  describe('createCharacterProfileKeyboard', () => {
    it('should create character profile keyboard for active character', async () => {
      const result = (await service.createCharacterProfileKeyboard(
        mockCharacter,
      )) as InlineKeyboardResult;

      expect(result.inline_keyboard).toContainEqual([
        { text: '💬 Написать', callback_data: 'character_chat_1' },
        { text: '📊 Статус', callback_data: 'character_status_1' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '⚙️ Действия', callback_data: 'character_actions_1' },
        { text: '📝 Редактировать', callback_data: 'character_edit_1' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '📥 Архивировать', callback_data: 'character_archive_1' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '🔙 Назад', callback_data: 'characters_list' },
      ]);
    });

    it('should create character profile keyboard for archived character', async () => {
      const result = (await service.createCharacterProfileKeyboard(
        mockArchivedCharacter,
      )) as InlineKeyboardResult;

      expect(result.inline_keyboard).toContainEqual([
        { text: '💬 Написать', callback_data: 'character_chat_2' },
        { text: '📊 Статус', callback_data: 'character_status_2' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '📤 Разархивировать', callback_data: 'character_unarchive_2' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '🔙 Назад', callback_data: 'characters_list' },
      ]);
    });

    it('should handle character with different ID', async () => {
      const character = { ...mockCharacter, id: '999' };
      const result = (await service.createCharacterProfileKeyboard(
        character,
      )) as InlineKeyboardResult;

      expect(result.inline_keyboard).toContainEqual([
        { text: '💬 Написать', callback_data: 'character_chat_999' },
        { text: '📊 Статус', callback_data: 'character_status_999' },
      ]);
    });
  });

  describe('createConfirmationKeyboard', () => {
    it('should create confirmation keyboard with string action and string entityId', () => {
      const result = service.createConfirmationKeyboard(
        'delete_character',
        '1',
      ) as InlineKeyboardResult;

      expect(result).toEqual({
        inline_keyboard: [
          [
            { text: '✅ Да', callback_data: 'confirm_delete_character_1' },
            { text: '❌ Нет', callback_data: 'cancel_delete_character_1' },
          ],
        ],
      });
    });

    it('should create confirmation keyboard with numeric entityId', () => {
      const result = service.createConfirmationKeyboard('archive', 123) as InlineKeyboardResult;

      expect(result).toEqual({
        inline_keyboard: [
          [
            { text: '✅ Да', callback_data: 'confirm_archive_123' },
            { text: '❌ Нет', callback_data: 'cancel_archive_123' },
          ],
        ],
      });
    });

    it('should handle different action types', () => {
      const actions = ['delete', 'archive', 'unarchive', 'edit', 'pause'];
      const entityId = 'test-id';

      actions.forEach(action => {
        const result = service.createConfirmationKeyboard(action, entityId) as InlineKeyboardResult;
        expect(result.inline_keyboard[0][0].callback_data).toBe(`confirm_${action}_${entityId}`);
        expect(result.inline_keyboard[0][1].callback_data).toBe(`cancel_${action}_${entityId}`);
      });
    });

    it('should handle empty action string', () => {
      const result = service.createConfirmationKeyboard('', '1') as InlineKeyboardResult;

      expect(result.inline_keyboard[0][0].callback_data).toBe('confirm__1');
      expect(result.inline_keyboard[0][1].callback_data).toBe('cancel__1');
    });
  });

  describe('createCharacterActionsKeyboard', () => {
    it('should create character actions keyboard', () => {
      const result = service.createCharacterActionsKeyboard('1') as InlineKeyboardResult;

      expect(result).toEqual({
        inline_keyboard: [
          [
            { text: '🎯 Начать действие', callback_data: 'action_start_1' },
            { text: '⏸️ Приостановить', callback_data: 'action_pause_1' },
          ],
          [
            { text: '⏹️ Остановить', callback_data: 'action_stop_1' },
            { text: '📊 Прогресс', callback_data: 'action_progress_1' },
          ],
          [{ text: '🔙 Назад к персонажу', callback_data: 'character_profile_1' }],
        ],
      });
    });

    it('should handle different character IDs', () => {
      const characterIds = ['1', '999', 'test-char-id', 'uuid-123-456'];

      characterIds.forEach(id => {
        const result = service.createCharacterActionsKeyboard(id) as InlineKeyboardResult;
        expect(result.inline_keyboard[0][0].callback_data).toBe(`action_start_${id}`);
        expect(result.inline_keyboard[0][1].callback_data).toBe(`action_pause_${id}`);
        expect(result.inline_keyboard[1][0].callback_data).toBe(`action_stop_${id}`);
        expect(result.inline_keyboard[1][1].callback_data).toBe(`action_progress_${id}`);
        expect(result.inline_keyboard[2][0].callback_data).toBe(`character_profile_${id}`);
      });
    });

    it('should create keyboard with correct structure', () => {
      const result = service.createCharacterActionsKeyboard('test') as InlineKeyboardResult;

      expect(result).toHaveProperty('inline_keyboard');
      expect(result.inline_keyboard).toHaveLength(3);
      expect(result.inline_keyboard[0]).toHaveLength(2);
      expect(result.inline_keyboard[1]).toHaveLength(2);
      expect(result.inline_keyboard[2]).toHaveLength(1);
    });
  });

  describe('createActionKeyboard', () => {
    it('should create action keyboard with single action', () => {
      const actions = ['Исследовать область'];
      const result = service.createActionKeyboard('1', actions) as InlineKeyboardResult;

      expect(result.inline_keyboard).toContainEqual([
        { text: '1. Исследовать область', callback_data: 'action_1_0' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '🔙 Назад', callback_data: 'character_status_1' },
      ]);
    });

    it('should create action keyboard with multiple actions', () => {
      const actions = ['Атаковать', 'Защищаться', 'Использовать предмет', 'Убежать'];
      const result = service.createActionKeyboard('test-char', actions) as InlineKeyboardResult;

      expect(result.inline_keyboard).toHaveLength(5); // 4 actions + back button

      actions.forEach((action, index) => {
        expect(result.inline_keyboard[index]).toEqual([
          { text: `${index + 1}. ${action}`, callback_data: `action_test-char_${index}` },
        ]);
      });

      expect(result.inline_keyboard[4]).toEqual([
        { text: '🔙 Назад', callback_data: 'character_status_test-char' },
      ]);
    });

    it('should handle empty actions array', () => {
      const result = service.createActionKeyboard('1', []) as InlineKeyboardResult;

      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toEqual([
        { text: '🔙 Назад', callback_data: 'character_status_1' },
      ]);
    });

    it('should handle actions with special characters', () => {
      const actions = ['🗡️ Атака мечом', '🛡️ Защита щитом', '🏃‍♂️ Побег'];
      const result = service.createActionKeyboard('2', actions) as InlineKeyboardResult;

      expect(result.inline_keyboard[0]).toEqual([
        { text: '1. 🗡️ Атака мечом', callback_data: 'action_2_0' },
      ]);
      expect(result.inline_keyboard[1]).toEqual([
        { text: '2. 🛡️ Защита щитом', callback_data: 'action_2_1' },
      ]);
      expect(result.inline_keyboard[2]).toEqual([
        { text: '3. 🏃‍♂️ Побег', callback_data: 'action_2_2' },
      ]);
    });

    it('should number actions starting from 1', () => {
      const actions = ['Первое', 'Второе', 'Третье'];
      const result = service.createActionKeyboard('char', actions) as InlineKeyboardResult;

      expect(result.inline_keyboard[0][0].text).toBe('1. Первое');
      expect(result.inline_keyboard[1][0].text).toBe('2. Второе');
      expect(result.inline_keyboard[2][0].text).toBe('3. Третье');
    });
  });

  describe('createCharacterListKeyboard', () => {
    it('should create character list keyboard with single character', () => {
      const characters = [mockCharacter];
      const result = service.createCharacterListKeyboard(characters) as InlineKeyboardResult;

      expect(result.inline_keyboard).toContainEqual([
        { text: 'Test Character', callback_data: 'character_view_1' },
      ]);
      expect(result.inline_keyboard).toContainEqual([
        { text: '➕ Создать нового', callback_data: 'character_create' },
        { text: '🔙 Главное меню', callback_data: 'main_menu' },
      ]);
    });

    it('should create character list keyboard with multiple characters', () => {
      const characters = [
        mockCharacter,
        mockArchivedCharacter,
        { id: '3', name: 'Third Character', description: 'desc', avatar: null, isArchived: false },
      ];
      const result = service.createCharacterListKeyboard(characters) as InlineKeyboardResult;

      expect(result.inline_keyboard).toHaveLength(4); // 3 characters + navigation buttons
      expect(result.inline_keyboard[0]).toEqual([
        { text: 'Test Character', callback_data: 'character_view_1' },
      ]);
      expect(result.inline_keyboard[1]).toEqual([
        { text: 'Archived Character', callback_data: 'character_view_2' },
      ]);
      expect(result.inline_keyboard[2]).toEqual([
        { text: 'Third Character', callback_data: 'character_view_3' },
      ]);
      expect(result.inline_keyboard[3]).toEqual([
        { text: '➕ Создать нового', callback_data: 'character_create' },
        { text: '🔙 Главное меню', callback_data: 'main_menu' },
      ]);
    });

    it('should handle empty character list', () => {
      const result = service.createCharacterListKeyboard([]) as InlineKeyboardResult;

      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toEqual([
        { text: '➕ Создать нового', callback_data: 'character_create' },
        { text: '🔙 Главное меню', callback_data: 'main_menu' },
      ]);
    });

    it('should handle characters with special names', () => {
      const characters = [
        { id: '1', name: '🔥 Fire Mage 🔥', description: '', avatar: null, isArchived: false },
        { id: '2', name: 'Имя с пробелами', description: '', avatar: null, isArchived: false },
        {
          id: '3',
          name: 'Name_with_underscores',
          description: '',
          avatar: null,
          isArchived: false,
        },
      ];
      const result = service.createCharacterListKeyboard(characters) as InlineKeyboardResult;

      expect(result.inline_keyboard[0]).toEqual([
        { text: '🔥 Fire Mage 🔥', callback_data: 'character_view_1' },
      ]);
      expect(result.inline_keyboard[1]).toEqual([
        { text: 'Имя с пробелами', callback_data: 'character_view_2' },
      ]);
      expect(result.inline_keyboard[2]).toEqual([
        { text: 'Name_with_underscores', callback_data: 'character_view_3' },
      ]);
    });
  });

  describe('createArchetypeKeyboard', () => {
    it('should create archetype keyboard with even number of archetypes', () => {
      const archetypes = ['Warrior', 'Mage', 'Rogue', 'Cleric'];
      const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;

      expect(result.inline_keyboard).toEqual([
        [
          { text: 'Warrior', callback_data: 'archetype_warrior' },
          { text: 'Mage', callback_data: 'archetype_mage' },
        ],
        [
          { text: 'Rogue', callback_data: 'archetype_rogue' },
          { text: 'Cleric', callback_data: 'archetype_cleric' },
        ],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ]);
    });

    it('should create archetype keyboard with odd number of archetypes', () => {
      const archetypes = ['Воин', 'Маг', 'Лучник'];
      const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;

      expect(result.inline_keyboard).toEqual([
        [
          { text: 'Воин', callback_data: 'archetype_воин' },
          { text: 'Маг', callback_data: 'archetype_маг' },
        ],
        [{ text: 'Лучник', callback_data: 'archetype_лучник' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ]);
    });

    it('should create archetype keyboard with single archetype', () => {
      const archetypes = ['Solo'];
      const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;

      expect(result.inline_keyboard).toEqual([
        [{ text: 'Solo', callback_data: 'archetype_solo' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ]);
    });

    it('should handle empty archetypes array', () => {
      const result = service.createArchetypeKeyboard([]) as InlineKeyboardResult;

      expect(result.inline_keyboard).toEqual([[{ text: '🔙 Назад', callback_data: 'main_menu' }]]);
    });

    it('should convert archetype names to lowercase in callback_data', () => {
      const archetypes = ['WARRIOR', 'Mage', 'RoGuE'];
      const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;

      expect(result.inline_keyboard[0][0].callback_data).toBe('archetype_warrior');
      expect(result.inline_keyboard[0][1].callback_data).toBe('archetype_mage');
      expect(result.inline_keyboard[1][0].callback_data).toBe('archetype_rogue');
    });

    it('should handle archetypes with spaces and special characters', () => {
      const archetypes = ['Battle Mage', 'Shadow Warrior', 'Holy Priest'];
      const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;

      expect(result.inline_keyboard[0][0]).toEqual({
        text: 'Battle Mage',
        callback_data: 'archetype_battle mage',
      });
      expect(result.inline_keyboard[0][1]).toEqual({
        text: 'Shadow Warrior',
        callback_data: 'archetype_shadow warrior',
      });
      expect(result.inline_keyboard[1][0]).toEqual({
        text: 'Holy Priest',
        callback_data: 'archetype_holy priest',
      });
    });

    it('should create correct number of rows', () => {
      const testCases = [
        { archetypes: [], expectedRows: 1 }, // just back button
        { archetypes: ['A'], expectedRows: 2 }, // 1 archetype row + back button
        { archetypes: ['A', 'B'], expectedRows: 2 }, // 1 archetype row + back button
        { archetypes: ['A', 'B', 'C'], expectedRows: 3 }, // 2 archetype rows + back button
        { archetypes: ['A', 'B', 'C', 'D'], expectedRows: 3 }, // 2 archetype rows + back button
        { archetypes: ['A', 'B', 'C', 'D', 'E'], expectedRows: 4 }, // 3 archetype rows + back button
      ];

      testCases.forEach(({ archetypes, expectedRows }) => {
        const result = service.createArchetypeKeyboard(archetypes) as InlineKeyboardResult;
        expect(result.inline_keyboard).toHaveLength(expectedRows);
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null character in createCharacterProfileKeyboard', async () => {
      const nullCharacter = null;

      await expect(
        service.createCharacterProfileKeyboard(nullCharacter as never),
      ).rejects.toThrow();
    });

    it('should handle undefined character in createCharacterProfileKeyboard', async () => {
      const undefinedCharacter = undefined;

      await expect(
        service.createCharacterProfileKeyboard(undefinedCharacter as never),
      ).rejects.toThrow();
    });

    it('should handle character with undefined id', async () => {
      const characterWithUndefinedId = { ...mockCharacter, id: undefined as never };

      const result = (await service.createCharacterProfileKeyboard(
        characterWithUndefinedId,
      )) as InlineKeyboardResult;

      // Should handle gracefully, creating callback_data with "undefined"
      expect(result.inline_keyboard[0][0].callback_data).toContain('undefined');
    });

    it('should handle null/undefined values in action arrays', () => {
      const actionsWithNulls = ['Valid Action', null, undefined, 'Another Valid'] as (
        | string
        | null
        | undefined
      )[];
      const result = service.createActionKeyboard('test', actionsWithNulls) as InlineKeyboardResult;

      // Should handle gracefully
      expect(result.inline_keyboard).toHaveLength(5); // 4 items + back button
    });

    it('should handle special characters in entity IDs', () => {
      const specialIds = ['test/id', 'test?id', 'test#id', 'test@id'];

      specialIds.forEach(id => {
        const result = service.createConfirmationKeyboard('test', id) as InlineKeyboardResult;
        expect(result.inline_keyboard[0][0].callback_data).toBe(`confirm_test_${id}`);
      });
    });
  });
});
