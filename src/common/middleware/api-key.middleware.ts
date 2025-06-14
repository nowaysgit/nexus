import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../infrastructure/api-key.service';

/**
 * Middleware для проверки API-ключа в запросах к защищенным маршрутам
 */
@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (!this.apiKeyService.validateClientApiKey(req)) {
      throw new UnauthorizedException('Недействительный API-ключ');
    }
    next();
  }
}
