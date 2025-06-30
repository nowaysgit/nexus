import { LogService } from '../../logging/log.service';
import { Context } from '../interfaces/context.interface';
import { BaseService } from '../../common/base/base.service';

export abstract class BaseHandler extends BaseService {
  constructor(logService: LogService) {
    super(logService);
  }

  abstract handle(ctx: Context): Promise<void>;
}
