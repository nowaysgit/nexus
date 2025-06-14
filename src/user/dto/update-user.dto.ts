import {
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class PreferencesDto {
  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;

  @IsOptional()
  @IsEnum(['light', 'dark', 'system'], { message: 'Недопустимая тема оформления' })
  theme?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

class CommunicationStyleDto {
  @IsOptional()
  @IsEnum([0, 1, 2, 3, 4, 5], { message: 'Значение должно быть от 0 до 5' })
  formality?: number;

  @IsOptional()
  @IsEnum([0, 1, 2, 3, 4, 5], { message: 'Значение должно быть от 0 до 5' })
  emotionality?: number;

  @IsOptional()
  @IsEnum([0, 1, 2, 3, 4, 5], { message: 'Значение должно быть от 0 до 5' })
  verbosity?: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Имя пользователя не может быть длиннее 100 символов' })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Фамилия не может быть длиннее 100 символов' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Код языка не может быть длиннее 10 символов' })
  language?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CommunicationStyleDto)
  communicationStyle?: CommunicationStyleDto;
}
