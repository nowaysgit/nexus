import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { AccessKey } from './entities/access-key.entity';
import { PsychologicalTest } from './entities/psychological-test.entity';

// Объединенный сервис вместо 4 разрозненных
import { UserService } from './services/user.service';

import { CacheModule } from '../cache/cache.module';
import { LogService } from '../logging/log.service';
import { IUserModule } from '../common/interfaces';

@Module({
  imports: [TypeOrmModule.forFeature([User, AccessKey, PsychologicalTest]), CacheModule],
  controllers: [UserController],
  providers: [
    // Единый объединенный сервис пользователей
    UserService,
    LogService,
  ],
  exports: [UserService],
})
export class UserModule implements OnModuleInit, IUserModule {
  constructor(
    private readonly userService: UserService,
    private readonly logService: LogService,
  ) {}

  /**
   * Инициализация модуля пользователей
   */
  onModuleInit() {
    this.logService.log('UserModule инициализирован');
  }

  readonly id = 'user-module';
  readonly name = 'User Module';
  readonly settings = {
    authEnabled: true,
    cachingEnabled: true,
    cacheTTL: 3600,
  };
}
