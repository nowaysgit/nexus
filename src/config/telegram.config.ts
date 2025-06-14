import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => {
  // Получение списка ID администраторов из строки
  const adminIdsStr = process.env.TELEGRAM_ADMIN_IDS || '';
  const adminIds = adminIdsStr ? adminIdsStr.split(',').map(id => parseInt(id.trim(), 10)) : [];

  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    adminIds,
    maxMessageLength: parseInt(process.env.TELEGRAM_MAX_MESSAGE_LENGTH, 10) || 4096,
    responseTimeout: parseInt(process.env.TELEGRAM_RESPONSE_TIMEOUT, 10) || 10000, // 10 секунд
  };
});
