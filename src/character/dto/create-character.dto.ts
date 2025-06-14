import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CharacterGender, PersonalityData } from '../entities/character.entity';
import { CharacterArchetype } from '../enums/character-archetype.enum';
import { TrimAndSanitize, Sanitize } from '../../common/decorators/sanitize.decorator';

/**
 * DTO для данных о личности персонажа
 */
export class PersonalityDataDto implements PersonalityData {
  @IsOptional()
  @IsArray({ message: 'Черты характера должны быть массивом' })
  @IsString({ each: true, message: 'Каждая черта характера должна быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 черт характера' })
  @Sanitize()
  traits: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Хобби должны быть массивом' })
  @IsString({ each: true, message: 'Каждое хобби должно быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 хобби' })
  @Sanitize()
  hobbies: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Страхи должны быть массивом' })
  @IsString({ each: true, message: 'Каждый страх должен быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 страхов' })
  @Sanitize()
  fears: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Ценности должны быть массивом' })
  @IsString({ each: true, message: 'Каждая ценность должна быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 ценностей' })
  @Sanitize()
  values: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Музыкальные вкусы должны быть массивом' })
  @IsString({ each: true, message: 'Каждый музыкальный вкус должен быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 музыкальных вкусов' })
  @Sanitize()
  musicTaste: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Сильные стороны должны быть массивом' })
  @IsString({ each: true, message: 'Каждая сильная сторона должна быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 сильных сторон' })
  @Sanitize()
  strengths: string[] = [];

  @IsOptional()
  @IsArray({ message: 'Слабые стороны должны быть массивом' })
  @IsString({ each: true, message: 'Каждая слабая сторона должна быть строкой' })
  @ArrayMaxSize(10, { message: 'Не более 10 слабых сторон' })
  @Sanitize()
  weaknesses: string[] = [];
}

/**
 * DTO для валидации создания персонажа
 */
export class CreateCharacterDto {
  @IsEnum(CharacterArchetype, { message: 'Недопустимый архетип персонажа' })
  @IsNotEmpty({ message: 'Архетип персонажа обязателен' })
  archetype: CharacterArchetype;

  @IsOptional()
  @IsString({ message: 'Имя персонажа должно быть строкой' })
  @MaxLength(100, { message: 'Имя персонажа не может быть длиннее 100 символов' })
  @TrimAndSanitize()
  name?: string;

  @IsOptional()
  @IsString({ message: 'Полное имя персонажа должно быть строкой' })
  @MaxLength(255, { message: 'Полное имя персонажа не может быть длиннее 255 символов' })
  @TrimAndSanitize()
  fullName?: string;

  @IsOptional()
  @IsInt({ message: 'Возраст должен быть целым числом' })
  @Min(18, { message: 'Возраст должен быть не менее 18 лет' })
  @Max(100, { message: 'Возраст должен быть не более 100 лет' })
  age?: number;

  @IsOptional()
  @IsEnum(CharacterGender, { message: 'Недопустимый пол персонажа' })
  gender?: CharacterGender;

  @IsOptional()
  @IsString({ message: 'Биография должна быть строкой' })
  @TrimAndSanitize()
  biography?: string;

  @IsOptional()
  @IsString({ message: 'Внешность должна быть строкой' })
  @TrimAndSanitize()
  appearance?: string;

  @IsOptional()
  @IsObject({ message: 'Личность персонажа должна быть объектом' })
  @ValidateNested()
  @Type(() => PersonalityDataDto)
  personality?: PersonalityDataDto;

  @IsOptional()
  @IsArray({ message: 'Области знаний должны быть массивом' })
  @IsString({ each: true, message: 'Каждая область знаний должна быть строкой' })
  @ArrayMaxSize(20, { message: 'Не более 20 областей знаний' })
  @Sanitize()
  knowledgeAreas?: string[];
}
