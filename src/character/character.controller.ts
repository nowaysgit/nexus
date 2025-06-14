import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { CharacterService } from './character.service';
import { Character, CharacterArchetype } from './entities/character.entity';
import { NeedType } from './entities/need.entity';

@Controller('character')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Post(':userId')
  async create(
    @Param('userId') userId: number,
    @Body('archetype') archetype: CharacterArchetype,
  ): Promise<Character> {
    return this.characterService.createCharacter(userId, archetype);
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: number): Promise<Character[]> {
    return this.characterService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Character> {
    return this.characterService.findOne(id);
  }

  @Put(':id/needs/update')
  async updateNeeds(@Param('id') id: number) {
    return this.characterService.updateNeeds(id);
  }

  @Put(':id/need/:type')
  async satisfyNeed(
    @Param('id') id: number,
    @Param('type') needType: NeedType,
    @Body('amount') amount: number,
  ) {
    return this.characterService.satisfyNeed(id, needType, amount);
  }

  @Put(':id/energy')
  async updateEnergy(@Param('id') id: number, @Body('amount') amount: number) {
    return this.characterService.updateEnergy(id, amount);
  }

  @Put(':id/energy/restore')
  async restoreEnergy(@Param('id') id: number) {
    return this.characterService.restoreEnergy(id);
  }

  @Get(':id/memories')
  async getMemories(
    @Param('id') id: number,
    @Query('query') query: string,
    @Query('limit') limit: number,
  ) {
    return this.characterService.findRelevantMemories(id, query, limit);
  }

  @Post(':id/crisis')
  async triggerCrisis(@Param('id') id: number, @Body('reason') reason: string) {
    return this.characterService.triggerCrisis(id, reason);
  }
}
