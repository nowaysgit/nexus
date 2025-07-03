import { Global, Module } from '@nestjs/common';

/**
 * Создает мок репозитория с основными методами TypeORM
 */
function createRepositoryMock(): any {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(data => ({ id: 1, ...data })),
    save: jest.fn().mockImplementation(entity => Promise.resolve({ id: 1, ...entity })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
    }),
    manager: {
      connection: {
        createQueryRunner: jest.fn().mockReturnValue({
          query: jest.fn().mockResolvedValue([]),
          release: jest.fn().mockResolvedValue(undefined),
        }),
      },
    },
  };
}

/**
 * Глобальный модуль-заглушка для всех репозиториев, устраняет ошибки Nest DI
 * в TelegramModule, DialogModule и связанных обработчиках.
 */
@Global()
@Module({
  providers: [
    { provide: 'DialogRepository', useValue: createRepositoryMock() },
    { provide: 'MessageRepository', useValue: createRepositoryMock() },
    { provide: 'CharacterRepository', useValue: createRepositoryMock() },
    { provide: 'AccessKeyRepository', useValue: createRepositoryMock() },
    { provide: 'TelegramCharacterSettingsRepository', useValue: createRepositoryMock() },
    { provide: 'NeedRepository', useValue: createRepositoryMock() },
    { provide: 'PsychologicalTestRepository', useValue: createRepositoryMock() },
    { provide: 'UserRepository', useValue: createRepositoryMock() },
    { provide: 'CharacterMemoryRepository', useValue: createRepositoryMock() },
  ],
  exports: [
    'DialogRepository',
    'MessageRepository',
    'CharacterRepository',
    'AccessKeyRepository',
    'TelegramCharacterSettingsRepository',
    'NeedRepository',
    'PsychologicalTestRepository',
    'UserRepository',
    'CharacterMemoryRepository',
  ],
})
export class MockDialogRepositoryModule {}
