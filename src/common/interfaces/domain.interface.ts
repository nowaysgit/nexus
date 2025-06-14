/**
 * Базовый интерфейс сущности с аудитом
 */
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Интерфейс пользователя (минимальный набор для избежания циклических зависимостей)
 */
export interface IUser extends BaseEntity {
  telegramId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  isActive: boolean;
  lastActivity?: Date;
}

/**
 * Интерфейс персонажа (минимальный набор для избежания циклических зависимостей)
 */
export interface ICharacter extends BaseEntity {
  name: string;
  archetype: string;
  userId: number;
  isActive: boolean;
  personality?: Record<string, any>;
  background?: string;
}

/**
 * Интерфейс диалога (минимальный набор для избежания циклических зависимостей)
 */
export interface IDialog extends BaseEntity {
  userId: number;
  characterId?: number;
  isActive: boolean;
  title?: string;
  context?: Record<string, any>;
}

/**
 * Интерфейс сообщения (минимальный набор для избежания циклических зависимостей)
 */
export interface IMessage extends BaseEntity {
  dialogId: number;
  characterId?: number;
  content: string;
  messageType: 'user' | 'character' | 'system';
  metadata?: Record<string, any>;
}

/**
 * Интерфейс для работы с персонажами (для dependency injection)
 */
export interface ICharacterService {
  findById(id: number): Promise<ICharacter | null>;
  findByUserId(userId: string): Promise<ICharacter[]>;
  create(data: Partial<ICharacter>): Promise<ICharacter>;
  update(id: number, data: Partial<ICharacter>): Promise<ICharacter>;
  delete(id: number): Promise<boolean>;
}

/**
 * Интерфейс для работы с диалогами (для dependency injection)
 */
export interface IDialogService {
  findById(id: number): Promise<IDialog | null>;
  findByUserId(userId: number): Promise<IDialog[]>;
  findByCharacterId(characterId: number): Promise<IDialog[]>;
  create(data: Partial<IDialog>): Promise<IDialog>;
  update(id: number, data: Partial<IDialog>): Promise<IDialog>;
  delete(id: number): Promise<boolean>;
  getDialogHistory(telegramId: string, characterId: number, limit: number): Promise<IMessage[]>;
}

/**
 * Интерфейс для работы с сообщениями (для dependency injection)
 */
export interface IMessageService {
  findByDialogId(dialogId: number): Promise<IMessage[]>;
  create(data: Partial<IMessage>): Promise<IMessage>;
  update(id: number, data: Partial<IMessage>): Promise<IMessage>;
  delete(id: number): Promise<boolean>;
}

/**
 * Интерфейс для работы с пользователями (для dependency injection)
 */
export interface IUserService {
  findById(id: number): Promise<IUser | null>;
  findByTelegramId(telegramId: string): Promise<IUser | null>;
  create(data: Partial<IUser>): Promise<IUser>;
  update(id: number, data: Partial<IUser>): Promise<IUser>;
  delete(id: number): Promise<boolean>;
}

/**
 * Токены для dependency injection
 */
export const DOMAIN_TOKENS = {
  CHARACTER_SERVICE: 'CHARACTER_SERVICE',
  DIALOG_SERVICE: 'DIALOG_SERVICE',
  MESSAGE_SERVICE: 'MESSAGE_SERVICE',
  USER_SERVICE: 'USER_SERVICE',
} as const;
