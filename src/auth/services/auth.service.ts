import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../user/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';

type UserResponse = Pick<User, 'id' | 'username' | 'email' | 'roles' | 'createdAt' | 'updatedAt'>;
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService extends BaseService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Authenticate user with username/email and password
   */
  async login(loginDto: LoginDto): Promise<{ access_token: string; user: UserResponse }> {
    const { username, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: [{ username }, { email: username }],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      this.logWarning(`Неудачная попытка входа для пользователя: ${username}`);
      throw new UnauthorizedException('Неверные учетные данные');
    }

    this.logInfo(`Успешный вход пользователя: ${user.username} (ID: ${user.id})`);

    return this.createAuthResponse(user);
  }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<{ access_token: string; user: UserResponse }> {
    const { username, email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (existingUser) {
      this.logWarning(`Попытка регистрации с уже существующими данными: ${username}, ${email}`);
      throw new BadRequestException('Пользователь с таким именем или email уже существует');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = this.userRepository.create({
      username,
      email,
      password: hashedPassword,
      roles: ['user'], // Default role
    });

    const savedUser = await this.userRepository.save(user);
    this.logInfo(
      `Успешная регистрация нового пользователя: ${savedUser.username} (ID: ${savedUser.id})`,
    );

    return this.createAuthResponse(savedUser);
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  /**
   * Create JWT token and return user without password
   */
  private createAuthResponse(user: User): { access_token: string; user: UserResponse } {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles || [],
    };

    const access_token = this.jwtService.sign(payload);

    // Return user without password
    const userResponse: UserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      access_token,
      user: userResponse,
    };
  }
}
