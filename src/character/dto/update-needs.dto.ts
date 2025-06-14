import { CharacterNeedType } from '../enums/character-need-type.enum';
import { IsNotEmpty, IsEnum, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO для валидации обновления конкретной потребности
 */
export class UpdateNeedDto {
  @IsEnum(CharacterNeedType, { message: 'Недопустимый тип потребности' })
  @IsNotEmpty({ message: 'Тип потребности обязателен' })
  type: CharacterNeedType;

  @IsNumber({}, { message: 'Значение должно быть числом' })
  @Min(-100, { message: 'Минимальное изменение -100' })
  @Max(100, { message: 'Максимальное изменение 100' })
  @IsNotEmpty({ message: 'Значение изменения потребности обязательно' })
  amount: number;
}
