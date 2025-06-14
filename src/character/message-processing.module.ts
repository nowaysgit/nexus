import { Module } from '@nestjs/common';
import { MessageProcessingCoordinator } from './services/message-processing-coordinator.service';
import { MessageAnalysisService } from './services/message-analysis.service';
import { NeedsService } from './services/needs.service';
import { CharacterBehaviorService } from './services/character-behavior.service';
import { CharacterResponseService } from './services/character-response.service';
import { EmotionalStateService } from './services/emotional-state.service';
import { ManipulationService } from './services/manipulation.service';
import { TechniqueExecutorService } from './services/technique-executor.service';
import { ActionService } from './services/action.service';
import { MemoryService } from './services/memory.service';
import { CharacterService } from './services/character.service';
import { DialogModule } from '../dialog/dialog.module';
import { LLMModule } from '../llm/llm.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { UserModule } from '../user/user.module';
import { LoggingModule } from '../logging/logging.module';
import { CommonModule } from '../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Need } from './entities/need.entity';
import { Character } from './entities/character.entity';
import { CharacterMemory } from './entities/character-memory.entity';
import { TechniqueExecution, UserManipulationProfile } from './entities/manipulation-technique.entity';
import { Action } from './entities/action.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Need, Character, CharacterMemory, TechniqueExecution, UserManipulationProfile, Action]),
    DialogModule,
    LLMModule,
    PromptTemplateModule,
    UserModule,
    LoggingModule,
    CommonModule,
  ],
  providers: [
    MessageProcessingCoordinator,
    MessageAnalysisService,
    NeedsService,
    CharacterBehaviorService,
    CharacterResponseService,
    EmotionalStateService,
    ManipulationService,
    TechniqueExecutorService,
    ActionService,
    MemoryService,
    CharacterService,
  ],
  exports: [MessageProcessingCoordinator],
})
export class MessageProcessingModule {} 