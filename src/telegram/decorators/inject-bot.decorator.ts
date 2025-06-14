import { Inject } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../constants';

/**
 * Декоратор для инъекции экземпляра бота Telegraf в сервисы
 * @returns Декоратор Inject с токеном TELEGRAF_TOKEN
 */
export const InjectBot = (): ParameterDecorator => Inject(TELEGRAF_TOKEN);
