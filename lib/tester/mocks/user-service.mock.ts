import { User } from '../../../src/user/entities/user.entity';

/**
 * Базовый интерфейс для мока пользователя
 */
interface MockUser {
  id: string;
  telegramId: string;
  username: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles?: string[];
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  isAdmin?: boolean;
}

/**
 * Интерфейс для мока UserService
 */
export interface MockUserService {
  getUserIdByTelegramId: (telegramId: string) => Promise<number>;
  getUserById: (id: string | number) => Promise<User>;
  getUserByTelegramId: (telegramId: string) => Promise<User>;
  createUser: (userData: Partial<User>) => Promise<User>;
  updateUser: (id: string | number, userData: Partial<User>) => Promise<User>;
  deleteUser: (id: string | number) => Promise<boolean>;
}

/**
 * Создает базовый объект пользователя для тестов
 */
function createMockUser(id: string | number, telegramId?: string): MockUser {
  const userId = typeof id === 'string' ? id : id.toString();
  const tgId = telegramId || `telegram_${userId}`;
  
  return {
    id: userId,
    telegramId: tgId,
    username: `test_user_${userId}`,
    isActive: true,
    roles: ['user'],
    email: `user${userId}@example.com`,
    language: 'ru',
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Мок для UserService используемый в тестах
 */
export const mockUserService: MockUserService = {
  getUserIdByTelegramId: jest.fn().mockImplementation((telegramId: string) => {
    // В тестовом окружении всегда возвращаем фиксированный числовой ID, 
    // чтобы избежать проблем с преобразованием UUID в число
    return Promise.resolve(999); // Фиксированный числовой userId для тестов
  }),
  
  getUserById: jest.fn().mockImplementation((id: string | number) => {
    return Promise.resolve(createMockUser(id) as User);
  }),
  
  getUserByTelegramId: jest.fn().mockImplementation((telegramId: string) => {
    const match = /telegram_(\d+)/.exec(telegramId);
    const id = match && match[1] ? match[1] : '123';
    
    return Promise.resolve(createMockUser(id, telegramId) as User);
  }),
  
  createUser: jest.fn().mockImplementation((userData: Partial<User>) => {
    const id = userData.id || Math.floor(Math.random() * 1000) + 1;
    
    return Promise.resolve({
      ...createMockUser(id),
      ...userData
    } as User);
  }),
  
  updateUser: jest.fn().mockImplementation((id: string | number, userData: Partial<User>) => {
    return Promise.resolve({
      ...createMockUser(id),
      ...userData,
      updatedAt: new Date()
    } as User);
  }),
  
  deleteUser: jest.fn().mockImplementation((id: string | number) => {
    return Promise.resolve(true);
  })
}; 