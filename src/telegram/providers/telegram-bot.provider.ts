import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, session } from 'telegraf';
import { TELEGRAF_TOKEN } from '../constants';

export const TelegramBotProvider: Provider = {
  provide: TELEGRAF_TOKEN,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    const bot = new Telegraf(token);

    // Добавляем middleware для сессий
    bot.use(session());

    return bot;
  },
};
