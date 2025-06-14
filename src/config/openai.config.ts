import { registerAs } from '@nestjs/config';

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  defaultTemperature: parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE) || 0.7,
  maxResponseTokens: parseInt(process.env.OPENAI_MAX_RESPONSE_TOKENS, 10) || 500,
  systemTemperature: parseFloat(process.env.OPENAI_SYSTEM_TEMPERATURE) || 0.3,
  analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o',
}));
