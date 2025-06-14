import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character, CharacterArchetype, RelationshipStage } from './entities/character.entity';
import { Need, NeedPriority, NeedType } from './entities/need.entity';
import { CharacterMemory, MemoryImportance, MemoryType } from './entities/character-memory.entity';
import { OpenaiService } from '../openai/openai.service';
import { UserService } from '../user/user.service';

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);

  constructor(
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,

    @InjectRepository(Need)
    private needRepository: Repository<Need>,

    @InjectRepository(CharacterMemory)
    private memoryRepository: Repository<CharacterMemory>,

    private readonly openaiService: OpenaiService,
    private readonly userService: UserService,
  ) {}

  async createCharacter(userId: number, archetype: CharacterArchetype): Promise<Character> {
    try {
      // Получаем пользователя
      const user = await this.userService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      // Генерируем персонажа через OpenAI
      const characterData = await this.openaiService.generateCharacter(archetype, user);

      // Создаем сущность персонажа
      const character = this.characterRepository.create({
        name: characterData.name,
        age: characterData.age,
        archetype,
        biography: characterData.biography,
        appearance: characterData.appearance,
        personality: characterData.personality,
        knowledgeAreas: characterData.knowledgeAreas,
        relationshipStage: RelationshipStage.ACQUAINTANCE,
        affection: 50,
        trust: 50,
        energy: 100,
        userId: user.id,
      });

      // Сохраняем персонажа
      const savedCharacter = await this.characterRepository.save(character);

      // Создаем базовые потребности персонажа
      await this.createInitialNeeds(savedCharacter.id);

      // Получаем полные данные персонажа с потребностями
      return this.findOne(savedCharacter.id);
    } catch (error) {
      this.logger.error(`Ошибка при создании персонажа: ${error.message}`);
      throw error;
    }
  }

  private async createInitialNeeds(characterId: number): Promise<void> {
    const needs = [
      { type: NeedType.COMMUNICATION, value: 80 },
      { type: NeedType.ENTERTAINMENT, value: 70 },
      { type: NeedType.SELF_REALIZATION, value: 60 },
      { type: NeedType.ATTENTION, value: 75 },
      { type: NeedType.AFFECTION, value: 50 },
      { type: NeedType.RESPECT, value: 65 },
    ];

    for (const needData of needs) {
      const need = this.needRepository.create({
        characterId,
        type: needData.type,
        value: needData.value,
        priority: this.calculateNeedPriority(needData.value),
        lastSatisfied: new Date(),
      });

      await this.needRepository.save(need);
    }
  }

  private calculateNeedPriority(value: number): NeedPriority {
    if (value <= 20) return NeedPriority.CRITICAL;
    if (value <= 40) return NeedPriority.HIGH;
    if (value <= 70) return NeedPriority.MEDIUM;
    return NeedPriority.LOW;
  }

  async findAll(userId: number): Promise<Character[]> {
    return this.characterRepository.find({
      where: { userId },
      relations: ['needs'],
    });
  }

  async findOne(id: number): Promise<Character> {
    const character = await this.characterRepository.findOne({
      where: { id },
      relations: ['needs'],
    });

    if (!character) {
      throw new NotFoundException(`Персонаж с ID ${id} не найден`);
    }

    return character;
  }

  async updateNeeds(characterId: number): Promise<Need[]> {
    const character = await this.findOne(characterId);
    const currentTime = new Date();
    const updatedNeeds: Need[] = [];

    for (const need of character.needs) {
      const lastSatisfied = need.lastSatisfied || new Date(Date.now() - 86400000); // Default to 24h ago if null
      const hoursPassed = Math.floor(
        (currentTime.getTime() - lastSatisfied.getTime()) / (60 * 60 * 1000),
      );

      // Уменьшаем значение потребности со временем
      // Разные потребности снижаются с разной скоростью
      let reductionRate = 0;

      switch (need.type) {
        case NeedType.COMMUNICATION:
          reductionRate = 2; // -2 points per hour
          break;
        case NeedType.ENTERTAINMENT:
          reductionRate = 1.5; // -1.5 points per hour
          break;
        case NeedType.SELF_REALIZATION:
          reductionRate = 0.8; // -0.8 points per hour
          break;
        case NeedType.ATTENTION:
          reductionRate = 3; // -3 points per hour
          break;
        case NeedType.AFFECTION:
          reductionRate = 1; // -1 point per hour
          break;
        case NeedType.RESPECT:
          reductionRate = 0.5; // -0.5 points per hour
          break;
      }

      const reduction = Math.min(hoursPassed * reductionRate, need.value);
      need.value = Math.max(0, need.value - reduction);
      need.priority = this.calculateNeedPriority(need.value);

      const updatedNeed = await this.needRepository.save(need);
      updatedNeeds.push(updatedNeed);
    }

    return updatedNeeds;
  }

  async satisfyNeed(characterId: number, needType: NeedType, amount: number): Promise<Need> {
    const character = await this.findOne(characterId);
    const need = character.needs.find(n => n.type === needType);

    if (!need) {
      throw new NotFoundException(`Потребность ${needType} не найдена у персонажа ${characterId}`);
    }

    need.value = Math.min(100, need.value + amount);
    need.priority = this.calculateNeedPriority(need.value);
    need.lastSatisfied = new Date();

    return this.needRepository.save(need);
  }

  async updateEnergy(characterId: number, amount: number): Promise<Character> {
    const character = await this.findOne(characterId);

    character.energy = Math.max(0, Math.min(100, character.energy + amount));
    character.lastInteraction = new Date();

    return this.characterRepository.save(character);
  }

  async restoreEnergy(characterId: number): Promise<Character> {
    const character = await this.findOne(characterId);
    const currentTime = new Date();
    const lastInteraction = character.lastInteraction || new Date(Date.now() - 86400000);

    // Восстанавливаем энергию со скоростью 5 единиц в час
    const hoursPassed = Math.floor(
      (currentTime.getTime() - lastInteraction.getTime()) / (60 * 60 * 1000),
    );
    const energyRestored = Math.min(hoursPassed * 5, 100 - character.energy);

    character.energy = Math.min(100, character.energy + energyRestored);

    return this.characterRepository.save(character);
  }

  async createMemory(
    characterId: number,
    content: string,
    type: MemoryType,
    importance: MemoryImportance,
  ): Promise<CharacterMemory> {
    const memory = this.memoryRepository.create({
      characterId,
      content,
      type,
      importance,
      memoryDate: new Date(),
      recallCount: 0,
      isActive: true,
    });

    return this.memoryRepository.save(memory);
  }

  async findRelevantMemories(
    characterId: number,
    query: string,
    limit: number = 3,
  ): Promise<CharacterMemory[]> {
    // В реальной системе здесь должен быть поиск по релевантности,
    // например, с использованием векторных эмбеддингов

    // Упрощенная реализация - возвращаем самые важные воспоминания
    const memories = await this.memoryRepository.find({
      where: {
        characterId,
        isActive: true,
      },
      order: {
        importance: 'DESC',
        lastRecalled: 'DESC',
      },
      take: limit,
    });

    // Увеличиваем счетчик обращений к воспоминаниям
    for (const memory of memories) {
      memory.recallCount += 1;
      memory.lastRecalled = new Date();
      await this.memoryRepository.save(memory);
    }

    return memories;
  }

  async updateRelationshipStage(characterId: number, stage: RelationshipStage): Promise<Character> {
    const character = await this.findOne(characterId);

    character.relationshipStage = stage;

    return this.characterRepository.save(character);
  }

  async updateAffection(characterId: number, amount: number): Promise<Character> {
    const character = await this.findOne(characterId);

    character.affection = Math.max(0, Math.min(100, character.affection + amount));

    // Если привязанность становится очень высокой, возможно изменение этапа отношений
    if (
      character.affection >= 80 &&
      character.relationshipStage === RelationshipStage.ACQUAINTANCE
    ) {
      character.relationshipStage = RelationshipStage.FRIENDSHIP;
    } else if (
      character.affection >= 90 &&
      character.relationshipStage === RelationshipStage.FRIENDSHIP
    ) {
      character.relationshipStage = RelationshipStage.ROMANCE;
    }

    return this.characterRepository.save(character);
  }

  async updateTrust(characterId: number, amount: number): Promise<Character> {
    const character = await this.findOne(characterId);

    character.trust = Math.max(0, Math.min(100, character.trust + amount));

    return this.characterRepository.save(character);
  }

  async triggerCrisis(characterId: number, reason: string): Promise<Character> {
    const character = await this.findOne(characterId);

    // Создаем кризисное событие (в реальной системе должна быть логика стейджа)
    character.relationshipStage = RelationshipStage.CRISIS;
    character.trust = Math.max(0, character.trust - 20);
    character.affection = Math.max(0, character.affection - 15);

    // Сохраняем воспоминание о кризисе
    await this.createMemory(
      characterId,
      `Произошел кризис в отношениях: ${reason}`,
      MemoryType.CONFLICT,
      MemoryImportance.CRITICAL,
    );

    return this.characterRepository.save(character);
  }
}
