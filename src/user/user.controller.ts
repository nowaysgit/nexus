import { Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
import { UserService, PaginatedResult } from './services/user.service';
import { User } from './entities/user.entity';
import { PsychologicalTest } from './entities/psychological-test.entity';
import { RoleGuard, Roles } from '../common/guards/role.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(RoleGuard)
  @Roles('admin')
  async findAll(): Promise<PaginatedResult<User>> {
    return this.userService.findAllPaginated();
  }

  @Get('paginated')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async findAllPaginated(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<PaginatedResult<User>> {
    return this.userService.findAllPaginated({ page, limit });
  }

  @Get(':id')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findUserById(id, []);
  }

  @Post(':id/activity')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async updateActivity(@Param('id') id: string): Promise<User> {
    return this.userService.updateLastActivity(id);
  }

  @Post('keys/generate/:userId')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async generateKey(@Param('userId') userId: string): Promise<string> {
    return this.userService.generateAccessKey(userId);
  }

  @Get(':telegramId/test-result')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async getTestResult(@Param('telegramId') telegramId: string): Promise<PsychologicalTest | null> {
    return this.userService.getTestResult(telegramId);
  }

  @Get(':telegramId/has-completed-test')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async hasCompletedTest(@Param('telegramId') telegramId: string): Promise<boolean> {
    return this.userService.hasCompletedTest(telegramId);
  }

  @Get('telegram/:telegramId')
  @UseGuards(RoleGuard)
  @Roles('admin')
  async findByTelegramId(@Param('telegramId') telegramId: string): Promise<User> {
    return this.userService.findByTelegramId(telegramId);
  }
}
