import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterModule } from './character/character.module';
import { OpenaiModule } from './openai/openai.module';
import { StoryModule } from './story/story.module';
import { DialogModule } from './dialog/dialog.module';
import { configuration, validationSchema } from './config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT) || 5432,
        username: process.env.DATABASE_USERNAME || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'postgres',
        database: process.env.DATABASE_NAME || 'nexus',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
        logging: process.env.DATABASE_LOGGING === 'true',
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    UserModule,
    TelegramModule,
    CharacterModule,
    OpenaiModule,
    StoryModule,
    DialogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
