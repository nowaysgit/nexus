import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/services/auth.service';
import { User } from '../../src/user/entities/user.entity';
import { LoginDto } from '../../src/auth/dto/login.dto';
import { RegisterDto } from '../../src/auth/dto/register.dto';
import { LogService } from '../../src/logging/log.service';

describe('AuthService Integration Tests', () => {
  let authService: AuthService;
  let mockUserRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let mockLogService: Partial<LogService>;

  beforeEach(async () => {
    // Создаем моки для репозитория пользователей
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(user => Promise.resolve(user)),
      create: jest.fn(userData => userData),
    };

    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'test-jwt-token'),
          },
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  // Очистка моков после каждого теста
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен успешно зарегистрировать нового пользователя', async () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    };

    // Настраиваем моки для проверки отсутствия пользователя
    mockUserRepository.findOne.mockResolvedValue(null);

    // Мокаем bcrypt.hash
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_password'));

    // Настраиваем мок для создания пользователя
    mockUserRepository.create.mockReturnValue({
      id: 'user-1',
      username: registerDto.username,
      email: registerDto.email,
      password: 'hashed_password',
      roles: ['user'],
    });

    // Настраиваем мок для сохранения пользователя
    mockUserRepository.save.mockResolvedValue({
      id: 'user-1',
      username: registerDto.username,
      email: registerDto.email,
      password: 'hashed_password',
      roles: ['user'],
    });

    const result = await authService.register(registerDto);

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.username).toBe(registerDto.username);
    expect(result.user.email).toBe(registerDto.email);
    expect(result.access_token).toBeDefined();
    expect(mockUserRepository.save).toHaveBeenCalled();
  });

  it('должен выбросить ошибку при регистрации с существующим username', async () => {
    // Настраиваем мок для проверки существующего пользователя
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'duplicateuser',
      email: 'first@example.com',
    });

    // Пытаемся зарегистрировать пользователя с существующим username
    const duplicateUser: RegisterDto = {
      username: 'duplicateuser',
      email: 'second@example.com',
      password: 'password456',
    };

    await expect(authService.register(duplicateUser)).rejects.toThrow(BadRequestException);
    await expect(authService.register(duplicateUser)).rejects.toThrow(
      'Пользователь с таким именем или email уже существует',
    );
  });

  it('должен выбросить ошибку при регистрации с существующим email', async () => {
    // Настраиваем мок для проверки существующего пользователя
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'firstuser',
      email: 'duplicate@example.com',
    });

    // Пытаемся зарегистрировать пользователя с существующим email
    const duplicateUser: RegisterDto = {
      username: 'seconduser',
      email: 'duplicate@example.com',
      password: 'password456',
    };

    await expect(authService.register(duplicateUser)).rejects.toThrow(BadRequestException);
  });

  it('должен успешно авторизовать пользователя по username', async () => {
    // Настраиваем мок для проверки пользователя
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'loginuser',
      email: 'login@example.com',
      password: 'hashed_password',
      roles: ['user'],
    });

    // Мокаем bcrypt.compare для успешного сравнения
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    // Пытаемся войти
    const loginDto: LoginDto = {
      username: 'loginuser',
      password: 'password123',
    };

    const result = await authService.login(loginDto);

    expect(result).toBeDefined();
    expect(result.access_token).toBeDefined();
    expect(typeof result.access_token).toBe('string');
    expect(result.user).toBeDefined();
    expect(result.user.username).toBe('loginuser');
    expect(result.user.email).toBe('login@example.com');
  });

  it('должен успешно авторизовать пользователя по email', async () => {
    // Настраиваем мок для проверки пользователя по email
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'emailuser',
      email: 'email@example.com',
      password: 'hashed_password',
      roles: ['user'],
    });

    // Мокаем bcrypt.compare для успешного сравнения
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    // Пытаемся войти по email
    const loginDto: LoginDto = {
      username: 'email@example.com',
      password: 'password123',
    };

    const result = await authService.login(loginDto);

    expect(result).toBeDefined();
    expect(result.access_token).toBeDefined();
    expect(result.user.username).toBe('emailuser');
    expect(result.user.email).toBe('email@example.com');
  });

  it('должен выбросить ошибку при неверном пароле', async () => {
    // Настраиваем мок для проверки пользователя
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'wrongpassuser',
      email: 'wrongpass@example.com',
      password: 'hashed_password',
    });

    // Мокаем bcrypt.compare для неверного пароля
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

    // Пытаемся войти с неверным паролем
    const loginDto: LoginDto = {
      username: 'wrongpassuser',
      password: 'wrongpassword',
    };

    await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    await expect(authService.login(loginDto)).rejects.toThrow('Неверные учетные данные');
  });

  it('должен выбросить ошибку при попытке входа несуществующего пользователя', async () => {
    // Настраиваем мок для отсутствующего пользователя
    mockUserRepository.findOne.mockResolvedValue(null);

    const loginDto: LoginDto = {
      username: 'nonexistentuser',
      password: 'anypassword',
    };

    await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    await expect(authService.login(loginDto)).rejects.toThrow('Неверные учетные данные');
  });

  it('должен валидировать пользователя по ID', async () => {
    // Настраиваем мок для поиска пользователя по ID
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'validateuser',
      email: 'validate@example.com',
    });

    const validatedUser = await authService.validateUserById('user-1');

    expect(validatedUser).toBeDefined();
    expect(validatedUser.id).toBe('user-1');
    expect(validatedUser.username).toBe('validateuser');
    expect(validatedUser.email).toBe('validate@example.com');
  });

  it('должен вернуть null при валидации несуществующего пользователя', async () => {
    // Настраиваем мок для отсутствующего пользователя
    mockUserRepository.findOne.mockResolvedValue(null);

    const result = await authService.validateUserById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});
