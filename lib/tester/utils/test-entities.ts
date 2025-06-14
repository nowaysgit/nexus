/**
 * Тестовые сущности для использования в тестах
 */

/**
 * Базовый тестовый пользователь
 */
export const testUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Базовый тестовый персонаж
 */
export const testCharacter = {
  id: 1,
  name: 'Test Character',
  fullName: 'Test Full Character Name',
  age: 25,
  gender: 'FEMALE',
  archetype: 'CAREGIVER',
  description: 'Test character description',
  backstory: 'Test character backstory',
  personality: 'Friendly and outgoing',
  appearance: 'Average height with brown hair',
  interests: ['reading', 'music', 'art'],
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Базовый тестовый диалог
 */
export const testDialog = {
  id: 1,
  title: 'Test Dialog',
  characterId: 1,
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Базовое тестовое сообщение
 */
export const testMessage = {
  id: 1,
  content: 'Test message content',
  type: 'user',
  dialogId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};
