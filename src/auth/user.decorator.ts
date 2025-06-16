import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Декоратор для извлечения пользователя из запроса
 * Может извлекать все свойства или конкретное свойство пользователя
 *
 * Примеры использования:
 * @User() user: UserEntity - получить весь объект пользователя
 * @User('id') userId: string - получить только id пользователя
 */
export const User = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  // Если пользователь не существует, возвращаем undefined
  if (!user) {
    return undefined;
  }

  // Если указано имя свойства, возвращаем только это свойство
  return data ? user[data] : user;
});
