import { SetMetadata } from '@nestjs/common';

/**
 * Ключ для определения публичных маршрутов (не требующих авторизации)
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Декоратор, который помечает эндпоинт как публичный (не требующий авторизации)
 * Используется в сочетании с гвардами для пропуска проверки авторизации
 */
export const PublicEndpoint = () => SetMetadata(IS_PUBLIC_KEY, true);
