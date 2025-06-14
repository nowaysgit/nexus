import { Context as TelegrafContext } from 'telegraf';

export interface SessionData {
  userId?: number;
  username?: string;
  state?: string;
  data?: any;
  lastActivity?: Date;
}

export interface Context extends TelegrafContext {
  session: SessionData;
}
