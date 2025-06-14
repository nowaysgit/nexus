import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { AccessKey } from './entities/access-key.entity';
import { PsychologicalTest } from './entities/psychological-test.entity';
import { AccessKeyService } from './services/access-key.service';
import { PsychologicalTestService } from './services/psychological-test.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AccessKey, PsychologicalTest])],
  controllers: [UserController],
  providers: [UserService, AccessKeyService, PsychologicalTestService],
  exports: [UserService, AccessKeyService, PsychologicalTestService],
})
export class UserModule {}
