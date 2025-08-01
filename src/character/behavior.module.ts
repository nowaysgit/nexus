import { Module } from '@nestjs/common';
import { EmotionalAdaptationService } from './services/behavior/emotional-adaptation.service';

/**
 * Модуль для поведенческих сервисов персонажей
 */
@Module({
  providers: [EmotionalAdaptationService],
  exports: [EmotionalAdaptationService],
})
export class BehaviorModule {}
