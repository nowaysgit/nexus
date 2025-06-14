import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { Need } from './entities/need.entity';
import { CharacterMemory } from './entities/character-memory.entity';
import { CharacterAction } from './entities/character-action.entity';
import { CharacterService } from './services/character.service';
import { NeedsService } from './services/needs.service';
import { ActionService } from './services/action.service';
import { CharacterBehaviorService } from './services/character-behavior.service';
import { OpenaiModule } from '../openai/openai.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Character, Need, CharacterMemory, CharacterAction]),
    OpenaiModule,
    ConfigModule,
  ],
  providers: [CharacterService, NeedsService, ActionService, CharacterBehaviorService],
  exports: [CharacterService, NeedsService, ActionService, CharacterBehaviorService],
})
export class CharacterModule {}
