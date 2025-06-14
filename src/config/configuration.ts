import appConfig from './app.config';
import characterConfig from './character.config';
import databaseConfig from './database.config';
import openaiConfig from './openai.config';
import telegramConfig from './telegram.config';

/**
 * Основная конфигурация приложения
 * Объединяет все вложенные конфигурации в один объект
 */
export default () => ({
  app: appConfig(),
  character: characterConfig(),
  database: databaseConfig(),
  openai: openaiConfig(),
  telegram: telegramConfig(),
});
