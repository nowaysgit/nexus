import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { TrimAndSanitize } from '../../common/decorators/sanitize.decorator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'ID Telegram обязателен' })
  @IsString({ message: 'ID Telegram должен быть строкой' })
  telegramId: string;

  @IsOptional()
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  @MaxLength(100, { message: 'Имя пользователя не может быть длиннее 100 символов' })
  @TrimAndSanitize()
  username?: string;

  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой' })
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  @TrimAndSanitize()
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Фамилия должна быть строкой' })
  @MaxLength(100, { message: 'Фамилия не может быть длиннее 100 символов' })
  @TrimAndSanitize()
  lastName?: string;

  @IsOptional()
  @IsString({ message: 'Код языка должен быть строкой' })
  @MaxLength(10, { message: 'Код языка не может быть длиннее 10 символов' })
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'Недопустимый формат языка. Пример: ru, en-US' })
  @TrimAndSanitize()
  language?: string;
}
