import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Проверяем, существует ли пользователь с таким telegramId
    const existingUser = await this.userRepository.findOne({
      where: { telegramId: createUserDto.telegramId },
    });

    if (existingUser) {
      // Если пользователь уже существует, обновляем его данные
      Object.assign(existingUser, createUserDto);
      return this.userRepository.save(existingUser);
    }

    // Если пользователь не существует, создаем нового
    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['psychologicalTests', 'accessKeys', 'characters', 'dialogs'],
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return user;
  }

  async findByTelegramId(telegramId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { telegramId },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с Telegram ID ${telegramId} не найден`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async updateLastActivity(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.lastActivity = new Date();
    return this.userRepository.save(user);
  }

  async updateCommunicationStyle(id: number, style: Record<string, number>): Promise<User> {
    const user = await this.findOne(id);
    user.communicationStyle = style;
    return this.userRepository.save(user);
  }

  async markTestCompleted(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.hasCompletedTest = true;
    return this.userRepository.save(user);
  }

  async hasActivatedKey(telegramId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { telegramId },
        relations: ['accessKeys'],
      });

      if (!user) return false;

      return user.accessKeys && user.accessKeys.length > 0;
    } catch (error) {
      return false;
    }
  }

  async hasCompletedTest(telegramId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { telegramId },
      });

      if (!user) return false;

      return user.hasCompletedTest;
    } catch (error) {
      return false;
    }
  }
}
