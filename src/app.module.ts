import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration
import { configuration, validationSchema } from './common/config';

// Modules
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './user/user.module';
import { CharacterModule } from './character/character.module';

import { CommonModule } from './common/common.module';
import { DialogModule } from './dialog/dialog.module';
import { LoggingModule } from './logging';
import { ErrorHandlingModule } from './common/utils/error-handling/error-handling.module';
import { DatabaseModule } from './common/utils/database.module';
import { GuardsModule } from './common/guards/guards.module';
import { ValidationModule } from './validation/validation.module';
import { CacheModule } from './cache/cache.module';
import { MessageQueueModule } from './message-queue/message-queue.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LLMModule } from './llm/llm.module';
import { PromptTemplateModule } from './prompt-template/prompt-template.module';

import { AuthModule } from './auth/auth.module';
import { MonitoringModule } from './monitoring/monitoring.module';

// Guards and Middleware
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { ApiKeyMiddleware } from './common/middleware';
import { HttpLoggerMiddleware } from './logging';
import { RequestTrackerMiddleware } from './common/middleware/request-tracker.middleware';

// Controllers
import { ApiController } from './common/controllers/api.controller';

// Интерфейсы для типизации конфигурации
interface DatabaseConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  synchronize?: boolean;
  logging?: boolean;
  ssl?: boolean | object;
  connectionTimeout?: number;
  queryTimeout?: number;
  statementTimeout?: number;
  poolSize?: number;
  maxQueryExecutionTime?: number;
  allowDropSchema?: boolean;
  dropSchema?: boolean;
}

interface EnvironmentConfig {
  isProduction?: boolean;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        configuration,
        // Configuration for current environment will be loaded from main configuration
      ],
      validationSchema: validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database') || {};
        const envConfig = configService.get<EnvironmentConfig>('environment') || {};

        // Предотвращаем опасные операции в продакшене
        if (envConfig.isProduction && (dbConfig.dropSchema || dbConfig.synchronize)) {
          throw new Error(
            'Критическая ошибка конфигурации: dropSchema и synchronize не должны быть включены в продакшн окружении',
          );
        }

        return {
          type: 'postgres',
          host: dbConfig.host || 'localhost',
          port: dbConfig.port || 5432,
          username: dbConfig.username || 'postgres',
          password: dbConfig.password || '',
          database: dbConfig.database || 'nexus',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: dbConfig.synchronize || false,
          logging: dbConfig.logging || false,
          retryAttempts: 10,
          retryDelay: 3000,
          ssl: envConfig.isProduction ? dbConfig.ssl : false,
          extra: {
            connectionTimeout: dbConfig.connectionTimeout || 30000,
            queryTimeout: dbConfig.queryTimeout || 30000,
            statementTimeout: dbConfig.statementTimeout || 30000,
          },
          poolSize: dbConfig.poolSize || 10,
          maxQueryExecutionTime: dbConfig.maxQueryExecutionTime || 30000,
          autoLoadEntities: true,
          dropSchema: dbConfig.allowDropSchema && !envConfig.isProduction,
        };
      },
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    GuardsModule,
    UserModule,
    TelegramModule,
    CharacterModule,

    CommonModule,
    ValidationModule,
    CacheModule,
    MessageQueueModule,
    InfrastructureModule,
    LLMModule,
    PromptTemplateModule,
    DialogModule,
    LoggingModule,
    ErrorHandlingModule,
    DatabaseModule,

    AuthModule,
    MonitoringModule,
  ],
  controllers: [ApiController],
  providers: [
    // Регистрируем ApiKeyGuard как глобальный гвард
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    // Логирование HTTP-запросов и трекинг запросов для всех маршрутов
    consumer
      .apply(HttpLoggerMiddleware, RequestTrackerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Добавляем проверку API-ключа только для административных маршрутов
    consumer
      .apply(ApiKeyMiddleware)
      .forRoutes(
        { path: 'admin/*', method: RequestMethod.ALL },
        { path: 'character/*/admin/*', method: RequestMethod.ALL },
        { path: 'analytics/*', method: RequestMethod.ALL },
        { path: 'monitoring/*', method: RequestMethod.ALL },
      );
  }
}
