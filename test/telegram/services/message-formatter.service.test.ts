import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  MessageFormatterService,
  TelegramMessageType,
} from '../../../src/telegram/services/message-formatter.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';

describe('MessageFormatterService', () => {
  let service: MessageFormatterService;
  let mockLogService: MockLogService;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockCharacter = {
    id: '1',
    name: 'Test Character',
    description: 'Test description for character',
    avatar: null,
    isArchived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const mockCharacterEntity: Partial<Character> = {
    id: 1,
    name: 'Test Character',
    biography: 'Test character biography',
    archetype: CharacterArchetype.HERO,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageFormatterService,
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MessageFormatterService>(MessageFormatterService);
  });

  describe('format', () => {
    it('should format message with title and content', () => {
      const result = service.format(TelegramMessageType.INFO, {
        title: 'Test Title',
        content: 'Test content',
        parseMode: 'Markdown',
      });

      expect(result).toContain('*ℹ️ Test Title*');
      expect(result).toContain('Test content');
    });

    it('should format message without title', () => {
      const result = service.format(TelegramMessageType.SUCCESS, {
        content: 'Success content',
        parseMode: 'Markdown',
      });

      expect(result).toBe('Success content');
    });

    it('should format message with footer', () => {
      const result = service.format(TelegramMessageType.WARNING, {
        content: 'Warning content',
        footer: 'Footer text',
        parseMode: 'Markdown',
      });

      expect(result).toContain('Warning content');
      expect(result).toContain('_Footer text_');
    });

    it('should format message with HTML parse mode', () => {
      const result = service.format(TelegramMessageType.ERROR, {
        title: 'Error Title',
        content: 'Error content',
        footer: 'Error footer',
        parseMode: 'HTML',
      });

      expect(result).toContain('<b>❌ Error Title</b>');
      expect(result).toContain('<i>Error footer</i>');
    });

    it('should format message without emoji', () => {
      const result = service.format(TelegramMessageType.INFO, {
        title: 'Title',
        content: 'Content',
        emoji: false,
        parseMode: 'Markdown',
      });

      expect(result).toContain('*Title*');
      expect(result).not.toContain('ℹ️');
    });
  });

  describe('formatInfo', () => {
    it('should format info message with title', () => {
      const result = service.formatInfo('Info content', 'Info Title');

      expect(result).toContain('*ℹ️ Info Title*');
      expect(result).toContain('Info content');
    });

    it('should format info message without title', () => {
      const result = service.formatInfo('Info content');

      expect(result).toBe('Info content');
    });

    it('should format info message with footer', () => {
      const result = service.formatInfo('Info content', 'Title', 'Footer');

      expect(result).toContain('_Footer_');
    });
  });

  describe('formatSuccess', () => {
    it('should format success message with default title', () => {
      const result = service.formatSuccess('Operation completed');

      expect(result).toContain('*✅ Успешно*');
      expect(result).toContain('Operation completed');
    });

    it('should format success message with custom title', () => {
      const result = service.formatSuccess('Task done', 'Custom Success Title');

      expect(result).toContain('*✅ Custom Success Title*');
      expect(result).toContain('Task done');
    });
  });

  describe('formatWarning', () => {
    it('should format warning message with default title', () => {
      const result = service.formatWarning('Warning content');

      expect(result).toContain('*⚠️ Внимание*');
      expect(result).toContain('Warning content');
    });

    it('should format warning message with custom title', () => {
      const result = service.formatWarning('Warning text', 'Custom Warning');

      expect(result).toContain('*⚠️ Custom Warning*');
      expect(result).toContain('Warning text');
    });
  });

  describe('formatError', () => {
    it('should format error message with default title', () => {
      const result = service.formatError('Error occurred');

      expect(result).toContain('*❌ Ошибка*');
      expect(result).toContain('Error occurred');
    });

    it('should format error message with custom title', () => {
      const result = service.formatError('Critical error', 'System Error');

      expect(result).toContain('*❌ System Error*');
      expect(result).toContain('Critical error');
    });
  });

  describe('formatCharacterMessage', () => {
    it('should format character message without emotional state', () => {
      const result = service.formatCharacterMessage(
        mockCharacterEntity as Character,
        'Hello there!',
      );

      expect(result).toContain('*💬 Test Character*');
      expect(result).toContain('Hello there!');
    });

    it('should format character message with emotional state', () => {
      const result = service.formatCharacterMessage(
        mockCharacterEntity as Character,
        'I am happy!',
        'cheerful',
      );

      expect(result).toContain('*💬 Test Character*');
      expect(result).toContain('_cheerful_');
      expect(result).toContain('I am happy!');
    });
  });

  describe('formatSystemMessage', () => {
    it('should format system message', () => {
      const result = service.formatSystemMessage('System notification');

      expect(result).toContain('*🔧 Система*');
      expect(result).toContain('System notification');
    });
  });

  describe('formatHelpMessage', () => {
    it('should format help message', async () => {
      const result = await service.formatHelpMessage();

      expect(result).toContain('*Справка по использованию бота*');
      expect(result).toContain('🎭 *Персонажи*');
      expect(result).toContain('💬 *Общение*');
      expect(result).toContain('⚙️ *Настройки*');
      expect(result).toContain('/characters');
      expect(result).toContain('/create');
      expect(result).toContain('/help');
    });
  });

  describe('formatCharacterInfo', () => {
    it('should format character info with all fields', async () => {
      const result = await service.formatCharacterInfo(mockCharacter);

      expect(result).toContain('🎭 *Test Character*');
      expect(result).toContain('📝 *Описание:*');
      expect(result).toContain('Test description for character');
      expect(result).toContain('📅 *Создан:*');
      expect(result).toContain('🔄 *Обновлен:*');
    });

    it('should format character info without description', async () => {
      const characterWithoutDesc = { ...mockCharacter, description: null };
      const result = await service.formatCharacterInfo(characterWithoutDesc);

      expect(result).toContain('🎭 *Test Character*');
      expect(result).not.toContain('📝 *Описание:*');
      expect(result).toContain('📅 *Создан:*');
    });

    it('should format archived character info', async () => {
      const archivedCharacter = { ...mockCharacter, isArchived: true };
      const result = await service.formatCharacterInfo(archivedCharacter);

      expect(result).toContain('🎭 *Test Character*');
      expect(result).toContain('📦 *Статус:* Архивирован');
    });
  });

  describe('formatNewCharacterInfo', () => {
    it('should format new character info', async () => {
      const result = await service.formatNewCharacterInfo(mockCharacter);

      expect(result).toContain('🎉 *Новый персонаж создан!*');
      expect(result).toContain('🎭 *Имя:* Test Character');
      expect(result).toContain('📝 *Описание:* Test description for character');
      expect(result).toContain('✨ Персонаж готов к общению!');
    });

    it('should format new character info without description', async () => {
      const characterWithoutDesc = { ...mockCharacter, description: null };
      const result = await service.formatNewCharacterInfo(characterWithoutDesc);

      expect(result).toContain('🎉 *Новый персонаж создан!*');
      expect(result).toContain('🎭 *Имя:* Test Character');
      expect(result).not.toContain('📝 *Описание:*');
    });
  });

  describe('formatCharacterList', () => {
    it('should format empty character list', async () => {
      const result = await service.formatCharacterList([]);

      expect(result).toContain('🎭 *Ваши персонажи*');
      expect(result).toContain('У вас пока нет персонажей');
      expect(result).toContain('/create');
    });

    it('should format character list with characters', async () => {
      const characters = [
        mockCharacter,
        { ...mockCharacter, id: '2', name: 'Character 2', isArchived: true },
      ];
      const result = await service.formatCharacterList(characters);

      expect(result).toContain('🎭 *Ваши персонажи* (2)');
      expect(result).toContain('✨ *Test Character*');
      expect(result).toContain('📦 *Character 2*');
    });

    it('should truncate long character descriptions', async () => {
      const longDesc = 'A'.repeat(60);
      const characterWithLongDesc = { ...mockCharacter, description: longDesc };
      const result = await service.formatCharacterList([characterWithLongDesc]);

      expect(result).toContain('A'.repeat(47) + '...');
    });
  });

  describe('formatCharacterStatus', () => {
    it('should format character status', async () => {
      const result = await service.formatCharacterStatus(mockCharacter, 'active');

      expect(result).toContain('🎭 *Test Character*');
      expect(result).toContain('📊 *Текущий статус:* Активен');
      expect(result).toContain('🟢');
    });

    it('should format character status with different states', async () => {
      const statuses = ['inactive', 'busy', 'sleeping', 'thinking'];

      for (const status of statuses) {
        const result = await service.formatCharacterStatus(mockCharacter, status);
        expect(result).toContain('📊 *Текущий статус:*');
      }
    });
  });

  describe('formatActionProgress', () => {
    it('should format action progress', async () => {
      const action = {
        id: '1',
        name: 'Test Action',
        description: 'Test action description',
      };

      const progress = {
        percentage: 75,
        status: 'working',
        timeRemaining: 300,
        message: 'Almost done!',
      };

      const result = await service.formatActionProgress('Test Character', action, progress);

      expect(result).toContain('🎭 *Test Character*');
      expect(result).toContain('⚡ *Действие:* Test Action');
      expect(result).toContain('📝 *Описание:* Test action description');
      expect(result).toContain('📊 *Прогресс:* 75%');
      expect(result).toContain('📈 *Статус:* Работает');
      expect(result).toContain('⏱️ *Осталось:* ~5 мин.');
      expect(result).toContain('💬 Almost done!');
    });

    it('should format action progress without optional fields', async () => {
      const action = {
        id: '1',
        name: 'Simple Action',
        description: 'Simple action description',
      };

      const progress = {
        percentage: 50,
        status: 'active',
      };

      const result = await service.formatActionProgress('Test Character', action, progress);

      expect(result).toContain('🎭 *Test Character*');
      expect(result).toContain('⚡ *Действие:* Simple Action');
      expect(result).toContain('📊 *Прогресс:* 50%');
      expect(result).toContain('📝 *Описание:* Simple action description');
      expect(result).not.toContain('⏱️ *Осталось:*');
      expect(result).not.toContain('💬');
    });
  });

  describe('error handling', () => {
    it('should handle format errors gracefully', () => {
      // Simulate error by passing undefined as content
      const result = service.format(TelegramMessageType.INFO, {
        content: null as unknown as string,
      });

      // Should return original content or handle gracefully
      expect(result).toBeDefined();
    });
  });
});
