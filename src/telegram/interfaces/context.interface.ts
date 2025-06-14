import { Context as TelegrafContext } from 'telegraf';

export interface SessionData {
  userId?: number;
  username?: string;
  state?: string;
  data?: Record<string, any>;
  lastActivity?: Date;
  characterId?: number;
  activeCharacterId?: number;
}

export interface ExtendedCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  message?: any;
  inline_message_id?: string;
  chat_instance: string;
  data: string;
  game_short_name?: string;
}

export interface Context extends TelegrafContext {
  session: SessionData;
}
