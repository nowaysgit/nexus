/**
 * Этот файл содержит коллекции сущностей для различных типов тестов
 */

// Импорты всех сущностей, используемых в тестах
import { AccessKey } from '../../src/user/entities/access-key.entity';
import { Action } from '../../src/character/entities/action.entity';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Need } from '../../src/character/entities/need.entity';
import { StoryPlan, StoryMilestone } from '../../src/character/entities/story-plan.entity';
import { TelegramCharacterSettings } from '../../src/telegram/entities/character-settings.entity';
import { User } from '../../src/user/entities/user.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../src/character/entities/manipulation-technique.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { PsychologicalTest } from '../../src/user/entities/psychological-test.entity';

/**
 * Все сущности для юнит и интеграционных тестов
 */
export const ALL_TEST_ENTITIES = [
  User,
  AccessKey,
  Character,
  Need,
  CharacterMotivation,
  Action,
  StoryPlan,
  StoryMilestone,
  Dialog,
  Message,
  TelegramCharacterSettings,
  TechniqueExecution,
  UserManipulationProfile,
  CharacterMemory,
  PsychologicalTest,
];

/**
 * Сущности для интеграционных тестов
 * (может быть подмножеством ALL_TEST_ENTITIES, если для интеграционных тестов нужны не все)
 */
export const INTEGRATION_TEST_ENTITIES = [
  Character,
  TechniqueExecution,
  UserManipulationProfile,
  User,
  Dialog,
  Message,
  Need,
  CharacterMotivation,
  Action,
  StoryPlan,
  StoryMilestone,
  CharacterMemory,
  PsychologicalTest,
  AccessKey,
  TelegramCharacterSettings,
];

/**
 * Сущности для тестирования персонажей
 */
export const CHARACTER_TEST_ENTITIES = [
  Character,
  Need,
  CharacterMotivation,
  Action,
  StoryPlan,
  StoryMilestone,
  TechniqueExecution,
  UserManipulationProfile,
  CharacterMemory,
];

/**
 * Сущности для тестирования диалогов
 */
export const DIALOG_TEST_ENTITIES = [Dialog, Message, User, Character];

/**
 * Сущности для тестирования пользователей
 */
export const USER_TEST_ENTITIES = [User, Character, Dialog, AccessKey, PsychologicalTest];

/**
 * Сущности для тестирования манипулятивных техник
 */
export const MANIPULATION_TEST_ENTITIES = [
  TechniqueExecution,
  UserManipulationProfile,
  Character,
  User,
];

/**
 * Проверка, что сущность существует в списке ALL_TEST_ENTITIES
 * @param entity Класс сущности для проверки
 */
export function isTestEntity(entity: any): boolean {
  return ALL_TEST_ENTITIES.includes(entity);
}

/**
 * Получение сущностей по имени класса
 * @param entityNames Имена классов сущностей
 */
export function getEntitiesByNames(entityNames: string[]): any[] {
  const result: any[] = [];

  for (const name of entityNames) {
    const entity = ALL_TEST_ENTITIES.find(e => e.name === name);
    if (entity) {
      result.push(entity);
    }
  }

  return result;
}
