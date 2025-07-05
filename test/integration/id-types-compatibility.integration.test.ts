import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { User } from '../../src/user/entities/user.entity';
import { Dialog } from '../../src/dialog/entities/dialog.entity';

// Services
import { CharacterService } from '../../src/character/services/core/character.service';
import { NeedsService } from '../../src/character/services/core/needs.service';
import { MemoryService } from '../../src/character/services/core/memory.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { CacheService } from '../../src/cache/cache.service';

// Tester utilities
import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

createTestSuite('ID Types Compatibility Tests', () => {
  let moduleRef: TestingModule | null = null;
  let characterService: CharacterService;
  let dialogService: DialogService;
  let userService: UserService;
  let _characterRepository: Repository<Character>;
  let _userRepository: Repository<User>;
  let _dialogRepository: Repository<Dialog>;
  let fixtureManager: FixtureManager;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    // Создаем мок для CacheService
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null), // Всегда возвращаем null из кэша
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    moduleRef = await TestModuleBuilder.create()
      .withImports([TypeOrmModule.forFeature([Character, Need, User, Dialog])] as any[])
      .withProviders([
        CharacterService,
        DialogService,
        UserService,
        { provide: CacheService, useValue: mockCacheService },
      ])
      .withRequiredMocks()
      .compile();

    characterService = moduleRef.get<CharacterService>(CharacterService);
    dialogService = moduleRef.get<DialogService>(DialogService);
    userService = moduleRef.get<UserService>(UserService);
    _characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
    _userRepository = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    _dialogRepository = moduleRef.get<Repository<Dialog>>(getRepositoryToken(Dialog));

    const dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);

    await fixtureManager.cleanDatabase();
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should handle numeric and string IDs correctly',
      requiresDatabase: false,
      imports: [TypeOrmModule.forFeature([Character, Need, User, Dialog])] as any[],
      providers: [
        CharacterService,
        DialogService,
        UserService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    },
    async context => {
      // Получаем DataSource из контекста createTest (не из beforeEach)
      const dataSource = context.get<DataSource>(DataSource);
      const testFixtureManager = new FixtureManager(dataSource);

      // Создаем пользователя (в моках ID будет UUID строкой)
      const user = await testFixtureManager.createUser();
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();

      // User.id всегда должен быть строкой (UUID) согласно сущности
      // @PrimaryGeneratedColumn('uuid') в User entity
      expect(typeof user.id).toBe('string');

      // Создаем персонажа (с числовым ID)
      const character = await testFixtureManager.createCharacter({
        user,
        userId: user.id,
        name: 'Test Character',
      });
      expect(character).toBeDefined();
      expect(character.id).toBeDefined();
      expect(typeof character.id).toBe('number');

      // Создаем диалог (связывает пользователя с персонажем)
      const dialog = await testFixtureManager.createDialog({
        telegramId: '123456789',
        characterId: character.id,
        userId: user.id,
        user: user,
        character: character,
      });
      expect(dialog).toBeDefined();
      expect(dialog.id).toBeDefined();
      expect(dialog.userId).toBeDefined();
      expect(dialog.characterId).toBeDefined();

      // Проверяем, что диалог правильно связывается с пользователем и персонажем
      // Используем строговое преобразование для универсальности
      expect(dialog.userId.toString()).toBe(user.id.toString());
      expect(dialog.characterId.toString()).toBe(character.id.toString());
    },
  );

  it.skip('should handle ID conversion between services', async () => {
    // Создаем пользователя и персонажа
    const user = await fixtureManager.createUser();
    const character = await fixtureManager.createCharacter({
      user,
      userId: user.id,
      name: 'Test Character',
    });

    // Проверяем, что сервис персонажей может найти персонажа по ID
    const foundCharacters = await characterService.findBy({ id: character.id });
    expect(foundCharacters).toBeDefined();
    expect(foundCharacters.length).toBeGreaterThan(0);
    expect(foundCharacters[0].id).toBe(character.id);

    // Проверяем, что сервис пользователей может найти пользователя по ID
    const foundUser = await userService.findUserById(user.id);
    expect(foundUser).toBeDefined();
    expect(foundUser.id).toBe(user.id);

    // Создаем диалог
    const dialog = await fixtureManager.createDialog({
      telegramId: '123456789',
      characterId: character.id,
      userId: user.id,
      user: user,
      character: character,
    });

    // Мокаем DialogRepository для корректного поиска диалога
    jest.spyOn(_dialogRepository, 'findOne').mockResolvedValue(dialog);

    // Проверяем, что сервис диалогов может найти диалог по ID
    const foundDialog = await dialogService.getDialogById(dialog.id);
    expect(foundDialog).toBeDefined();
    expect(foundDialog?.id).toBeDefined();
    expect(_dialogRepository.findOne).toHaveBeenCalledWith({
      where: { id: dialog.id },
    });
  });
});
