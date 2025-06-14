import { LogService } from '../../logging/log.service';
import { Context } from '../interfaces/context.interface';

export abstract class BaseHandler {
  protected readonly logger: LogService;

  constructor(loggerName: string) {
    this.logger = new LogService(null, null, null).setContext(loggerName);
  }

  abstract handle(ctx: Context): Promise<void>;
}
