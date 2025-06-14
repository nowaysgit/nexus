import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { RollbarService } from './rollbar.service';
import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpLoggerMiddleware } from './http-logger.middleware';
import { ILoggingModule } from '../common/interfaces';
import { LogService } from './log.service';

// Интерфейс для конфигурации логирования
interface LoggerConfig {
  level: string;
  dir: string;
  maxSize: string;
  maxDays: number;
  zippedArchive: boolean;
  datePattern: string;
  files: {
    application: string;
    error: string;
  };
}

// Дефолтные значения для конфигурации логирования
const defaultLoggerConfig: LoggerConfig = {
  level: 'info',
  dir: 'logs',
  maxSize: '20m',
  maxDays: 14,
  zippedArchive: true,
  datePattern: 'YYYY-MM-DD',
  files: {
    application: 'application.log',
    error: 'error.log',
  },
};

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Получаем конфигурацию с дефолтными значениями
        const logConfig = configService.get<LoggerConfig>('logging.logger') || defaultLoggerConfig;
        const logDir = path.resolve(process.cwd(), logConfig.dir);
        const logLevel = logConfig.level;
        const maxSize = logConfig.maxSize;
        const maxDays = logConfig.maxDays;

        // Создаем директорию для логов, если она не существует
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        // Форматирование для консольного вывода
        const consoleFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.colorize(),
          winston.format.printf((info: winston.Logform.TransformableInfo) => {
            const timestamp = info.timestamp as string;
            const level = info.level;
            const message = info.message as string;
            const context = (info.context as string) || 'Global';
            const requestId = info.requestId
              ? `[${typeof info.requestId === 'string' ? info.requestId : JSON.stringify(info.requestId)}]`
              : '';
            return `${timestamp} [${level}] [${context}]${requestId} ${message}`;
          }),
        );

        // Форматирование для файлового вывода
        const fileFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        );

        // Преобразование строки размера в число байт
        const maxSizeInBytes = parseInt(maxSize.replace(/\D/g, '')) * 1024 * 1024;

        // Файловые транспорты
        const allLevelsTransport = new winston.transports.File({
          filename: path.join(logDir, logConfig.files.application),
          format: fileFormat,
          maxsize: maxSizeInBytes,
          maxFiles: maxDays,
        });

        const errorTransport = new winston.transports.File({
          filename: path.join(logDir, logConfig.files.error),
          level: 'error',
          format: fileFormat,
          maxsize: maxSizeInBytes,
          maxFiles: maxDays,
        });

        return {
          transports: [
            // Консольный логгер
            new winston.transports.Console({
              format: consoleFormat,
            }),
            // Файловые логгеры
            allLevelsTransport,
            errorTransport,
          ],
          level: logLevel,
        };
      },
    }),
  ],
  providers: [
    // Упрощенный сервис логирования (основная функциональность)
    LogService,
    RollbarService,
    GlobalExceptionFilter,
    HttpLoggerMiddleware,

    {
      provide: 'LOG_SERVICE',
      useExisting: LogService,
    },
  ],
  exports: [
    // Основной сервис логирования
    LogService,
    RollbarService,
    GlobalExceptionFilter,
    HttpLoggerMiddleware,
  ],
})
export class LoggingModule implements ILoggingModule {
  readonly id = 'logging-module';
  readonly name = 'Logging Module';
  readonly logLevel = 'info';
  readonly settings = {
    fileLoggingEnabled: true,
    consoleLoggingEnabled: true,
    logRotationEnabled: true,
    maxLogSize: 10485760, // 10MB
    maxLogFiles: 10,
  };
}
