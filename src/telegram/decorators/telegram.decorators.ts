import { SetMetadata } from '@nestjs/common';

export const TELEGRAM_UPDATE_METADATA = 'TELEGRAM_UPDATE_METADATA';
export const TELEGRAM_COMMAND_METADATA = 'TELEGRAM_COMMAND_METADATA';
export const TELEGRAM_ACTION_METADATA = 'TELEGRAM_ACTION_METADATA';
export const TELEGRAM_HEARS_METADATA = 'TELEGRAM_HEARS_METADATA';
export const TELEGRAM_ON_METADATA = 'TELEGRAM_ON_METADATA';
export const TELEGRAM_HANDLER_METADATA = 'telegram:handler';

export const Update = () => SetMetadata(TELEGRAM_UPDATE_METADATA, true);

export const Command = (command: string | string[] = '') =>
  SetMetadata(TELEGRAM_COMMAND_METADATA, command);

export const Start = () => Command('start');
export const Help = () => Command('help');

export const Action = (action: string | RegExp | (string | RegExp)[] = /.*/) =>
  SetMetadata(TELEGRAM_ACTION_METADATA, action);

export const Hears = (pattern: string | RegExp | (string | RegExp)[] = /.*/) =>
  SetMetadata(TELEGRAM_HEARS_METADATA, pattern);

export const On = (event: string | symbol) => SetMetadata(TELEGRAM_ON_METADATA, event);

export const TelegramHandler = (command?: string) =>
  SetMetadata(TELEGRAM_HANDLER_METADATA, command);
export const TelegramCommand = (command: string) => SetMetadata(TELEGRAM_COMMAND_METADATA, command);
