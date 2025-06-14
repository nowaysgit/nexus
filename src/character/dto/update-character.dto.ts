import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { CharacterGender, RelationshipStage } from '../entities/character.entity';
import { CharacterArchetype } from '../enums/character-archetype.enum';

/**
 * DTO для обновления данных персонажа
 */
export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsEnum(CharacterGender)
  gender?: CharacterGender;

  @IsOptional()
  @IsEnum(CharacterArchetype)
  archetype?: CharacterArchetype;

  @IsOptional()
  @IsString()
  biography?: string;

  @IsOptional()
  @IsString()
  appearance?: string;

  @IsOptional()
  @IsObject()
  personality?: Record<string, any>;

  @IsOptional()
  @IsObject()
  psychologicalProfile?: Record<string, any>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsObject()
  idealPartner?: Record<string, any>;

  @IsOptional()
  @IsObject()
  knowledgeAreas?: string[];

  @IsOptional()
  @IsEnum(RelationshipStage)
  relationshipStage?: RelationshipStage;

  @IsOptional()
  @IsString()
  developmentStage?: string;

  @IsOptional()
  @IsNumber()
  affection?: number;

  @IsOptional()
  @IsNumber()
  trust?: number;

  @IsOptional()
  @IsNumber()
  energy?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
} 