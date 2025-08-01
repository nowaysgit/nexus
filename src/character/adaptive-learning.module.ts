import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { LoggingModule } from '../logging/logging.module';
import { Dialog } from '../dialog/entities/dialog.entity';
import { Message } from '../dialog/entities/message.entity';
import { Character } from './entities/character.entity';
import { UserFeedbackService } from './services/analysis/user-feedback.service';
import { CharacterLearningService } from './services/core/character-learning.service';
import { AdaptiveLearningIntegrationService } from './services/analysis/adaptive-learning-integration.service';

/**
 * Модуль системы адаптивного обучения персонажей
 * Предоставляет сервисы для сбора обратной связи и адаптации поведения
 */
@Module({
  imports: [TypeOrmModule.forFeature([Dialog, Message, Character]), CacheModule, LoggingModule],
  providers: [UserFeedbackService, CharacterLearningService, AdaptiveLearningIntegrationService],
  exports: [UserFeedbackService, CharacterLearningService, AdaptiveLearningIntegrationService],
})
export class AdaptiveLearningModule {}
