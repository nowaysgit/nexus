import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AccessKeyService } from './services/access-key.service';
import { PsychologicalTestService } from './services/psychological-test.service';
import { User } from './entities/user.entity';
import { AccessKey } from './entities/access-key.entity';
import { PsychologicalTest } from './entities/psychological-test.entity';

// Простая проверка на админа
class AdminGuard {
  canActivate(context: any): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return user && user.isAdmin;
  }
}

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly accessKeyService: AccessKeyService,
    private readonly psychologicalTestService: PsychologicalTestService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  async findOne(@Param('id') id: number): Promise<User> {
    return this.userService.findOne(id);
  }

  @Post('keys/generate')
  @UseGuards(AdminGuard)
  async generateKeys(@Body('count') count: number = 10): Promise<AccessKey[]> {
    return this.accessKeyService.generateBatchKeys(count);
  }

  @Get('keys/all')
  @UseGuards(AdminGuard)
  async getAllKeys(): Promise<AccessKey[]> {
    return this.accessKeyService.findAllKeys();
  }

  @Get(':userId/tests')
  @UseGuards(AdminGuard)
  async getUserTests(@Param('userId') userId: number): Promise<PsychologicalTest[]> {
    const user = await this.userService.findOne(userId);
    return user.psychologicalTests;
  }

  @Get(':userId/latest-test')
  @UseGuards(AdminGuard)
  async getLatestTest(@Param('userId') userId: number): Promise<PsychologicalTest | null> {
    return this.psychologicalTestService.getUserLatestTest(userId);
  }
}
