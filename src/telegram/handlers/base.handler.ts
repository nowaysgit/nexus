import { Logger } from '@nestjs/common';
import { Context } from '../interfaces/context.interface';

export abstract class BaseHandler {
  protected readonly logger: Logger;

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  abstract handle(ctx: Context): Promise<void>;
}
