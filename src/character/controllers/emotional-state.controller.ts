import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmotionalStateService } from '../services/core/emotional-state.service';
import {
  EmotionalState,
  EmotionalUpdate,
  EmotionalMemory,
  EmotionalTransition,
  EmotionalProfile,
  EmotionalEvent,
  EmotionalPattern,
  EmotionalRegulationStrategy,
  EmotionalContext,
} from '../entities/emotional-state';
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';

/**
 * Интерфейс для фильтрации эмоциональных воспоминаний
 */
interface EmotionalMemoryFilters {
  emotions?: string[];
  timeRange?: {
    from: Date;
    to: Date;
  };
  significance?: {
    min: number;
    max: number;
  };
  tags?: string[];
}

/**
 * Интерфейс для фильтрации эмоциональных событий
 */
interface EmotionalEventFilters {
  types?: ('state_change' | 'transition' | 'regulation' | 'cascade' | 'interaction')[];
  timeRange?: {
    from: Date;
    to: Date;
  };
  significance?: {
    min: number;
    max: number;
  };
}

/**
 * DTO для создания эмоционального обновления
 */
export class CreateEmotionalUpdateDto {
  emotions: Record<string, number>;
  source: string;
  description?: string;
}

/**
 * DTO для создания эмоциональной памяти
 */
export class CreateEmotionalMemoryDto {
  emotionalState: EmotionalState;
  trigger: string;
  significance: number;
  context?: EmotionalContext;
}

/**
 * DTO для применения эмоциональной регуляции
 */
export class ApplyEmotionalRegulationDto {
  strategy: EmotionalRegulationStrategy;
  intensity: number;
  context?: EmotionalContext;
}

/**
 * DTO для предсказания эмоциональной реакции
 */
export class PredictEmotionalReactionDto {
  trigger: string;
  context?: EmotionalContext;
}

/**
 * DTO для симуляции эмоционального каскада
 */
export class SimulateEmotionalCascadeDto {
  initialEmotion: string;
  context?: EmotionalContext;
  maxDepth?: number;
}

/**
 * DTO для анализа эмоциональной совместимости
 */
export class AnalyzeEmotionalCompatibilityDto {
  characterId2: number;
  context?: EmotionalContext;
}

/**
 * DTO для оптимизации эмоционального состояния
 */
export class OptimizeEmotionalStateDto {
  goal: string;
  constraints: string[];
  context?: EmotionalContext;
}

/**
 * Контроллер для управления эмоциональным состоянием персонажей
 */
@ApiTags('Emotional State')
@Controller('characters/:characterId/emotional-state')
@UseGuards(JwtAuthGuard)
export class EmotionalStateController extends BaseService {
  constructor(
    private readonly emotionalStateService: EmotionalStateService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Получить текущее эмоциональное состояние персонажа
   */
  @Get()
  @ApiOperation({ summary: 'Получить текущее эмоциональное состояние персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Текущее эмоциональное состояние' })
  async getEmotionalState(
    @Param('characterId', ParseIntPipe) characterId: number,
  ): Promise<EmotionalState> {
    return this.withErrorHandling('получении эмоционального состояния', async () => {
      return await this.emotionalStateService.getEmotionalState(characterId);
    });
  }

  /**
   * Обновить эмоциональное состояние персонажа
   */
  @Put()
  @ApiOperation({ summary: 'Обновить эмоциональное состояние персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Обновленное эмоциональное состояние' })
  async updateEmotionalState(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() updateDto: CreateEmotionalUpdateDto,
  ): Promise<EmotionalState> {
    return this.withErrorHandling('обновлении эмоционального состояния', async () => {
      const emotionalUpdate: EmotionalUpdate = {
        emotions: updateDto.emotions,
        source: updateDto.source,
        description: updateDto.description,
      };

      return await this.emotionalStateService.updateEmotionalState(characterId, emotionalUpdate);
    });
  }

  /**
   * Получить эмоциональный профиль персонажа
   */
  @Get('profile')
  @ApiOperation({ summary: 'Получить эмоциональный профиль персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Эмоциональный профиль персонажа' })
  async getEmotionalProfile(
    @Param('characterId', ParseIntPipe) characterId: number,
  ): Promise<EmotionalProfile> {
    return this.withErrorHandling('получении эмоционального профиля', async () => {
      return await this.emotionalStateService.getEmotionalProfile(characterId);
    });
  }

  /**
   * Обновить эмоциональный профиль персонажа
   */
  @Put('profile')
  @ApiOperation({ summary: 'Обновить эмоциональный профиль персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Обновленный эмоциональный профиль' })
  async updateEmotionalProfile(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() profileUpdate: Partial<EmotionalProfile>,
  ): Promise<EmotionalProfile> {
    return this.withErrorHandling('обновлении эмоционального профиля', async () => {
      return await this.emotionalStateService.updateEmotionalProfile(characterId, profileUpdate);
    });
  }

  /**
   * Получить эмоциональные воспоминания персонажа
   */
  @Get('memories')
  @ApiOperation({ summary: 'Получить эмоциональные воспоминания персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiQuery({ name: 'emotions', required: false, description: 'Фильтр по эмоциям' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Дата начала периода' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'minSignificance', required: false, description: 'Минимальная значимость' })
  @ApiQuery({ name: 'maxSignificance', required: false, description: 'Максимальная значимость' })
  @ApiQuery({ name: 'tags', required: false, description: 'Фильтр по тегам' })
  @ApiQuery({ name: 'limit', required: false, description: 'Лимит результатов' })
  @ApiResponse({ status: 200, description: 'Список эмоциональных воспоминаний' })
  async getEmotionalMemories(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('emotions') emotions?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('minSignificance') minSignificance?: number,
    @Query('maxSignificance') maxSignificance?: number,
    @Query('tags') tags?: string,
    @Query('limit') limit?: number,
  ): Promise<EmotionalMemory[]> {
    return this.withErrorHandling('получении эмоциональных воспоминаний', async () => {
      const filters: EmotionalMemoryFilters = {};

      if (emotions) {
        filters.emotions = emotions.split(',').map(e => e.trim());
      }

      if (fromDate && toDate) {
        filters.timeRange = {
          from: new Date(fromDate),
          to: new Date(toDate),
        };
      }

      if (minSignificance !== undefined || maxSignificance !== undefined) {
        filters.significance = {
          min: minSignificance || 0,
          max: maxSignificance || 100,
        };
      }

      if (tags) {
        filters.tags = tags.split(',').map(t => t.trim());
      }

      return await this.emotionalStateService.getEmotionalMemories(
        characterId,
        filters,
        limit || 50,
      );
    });
  }

  /**
   * Создать эмоциональную память
   */
  @Post('memories')
  @ApiOperation({ summary: 'Создать эмоциональную память' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 201, description: 'Созданная эмоциональная память' })
  async createEmotionalMemory(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() memoryDto: CreateEmotionalMemoryDto,
  ): Promise<EmotionalMemory> {
    return this.withErrorHandling('создании эмоциональной памяти', async () => {
      const context = await this.emotionalStateService.createEmotionalContext(characterId);

      return await this.emotionalStateService.createEmotionalMemory(
        characterId,
        memoryDto.emotionalState,
        memoryDto.trigger,
        memoryDto.context ?? context,
        memoryDto.significance,
      );
    });
  }

  /**
   * Получить эмоциональные переходы персонажа
   */
  @Get('transitions')
  @ApiOperation({ summary: 'Получить эмоциональные переходы персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Дата начала периода' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'limit', required: false, description: 'Лимит результатов' })
  @ApiResponse({ status: 200, description: 'Список эмоциональных переходов' })
  async getEmotionalTransitions(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: number,
  ): Promise<EmotionalTransition[]> {
    return this.withErrorHandling('получении эмоциональных переходов', async () => {
      const timeRange =
        fromDate && toDate
          ? {
              from: new Date(fromDate),
              to: new Date(toDate),
            }
          : undefined;

      return await this.emotionalStateService.getEmotionalTransitions(
        characterId,
        timeRange,
        limit || 100,
      );
    });
  }

  /**
   * Получить эмоциональные события персонажа
   */
  @Get('events')
  @ApiOperation({ summary: 'Получить эмоциональные события персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiQuery({ name: 'types', required: false, description: 'Фильтр по типам событий' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Дата начала периода' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'minSignificance', required: false, description: 'Минимальная значимость' })
  @ApiQuery({ name: 'maxSignificance', required: false, description: 'Максимальная значимость' })
  @ApiQuery({ name: 'limit', required: false, description: 'Лимит результатов' })
  @ApiResponse({ status: 200, description: 'Список эмоциональных событий' })
  async getEmotionalEvents(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('types') types?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('minSignificance') minSignificance?: number,
    @Query('maxSignificance') maxSignificance?: number,
    @Query('limit') limit?: number,
  ): Promise<EmotionalEvent[]> {
    return this.withErrorHandling('получении эмоциональных событий', async () => {
      const filters: EmotionalEventFilters = {};

      if (types) {
        filters.types = types.split(',').map(t => t.trim()) as (
          | 'state_change'
          | 'transition'
          | 'regulation'
          | 'cascade'
          | 'interaction'
        )[];
      }

      if (fromDate && toDate) {
        filters.timeRange = {
          from: new Date(fromDate),
          to: new Date(toDate),
        };
      }

      if (minSignificance !== undefined || maxSignificance !== undefined) {
        filters.significance = {
          min: minSignificance || 0,
          max: maxSignificance || 100,
        };
      }

      return await this.emotionalStateService.getEmotionalEvents(
        characterId,
        filters,
        limit || 100,
      );
    });
  }

  /**
   * Применить эмоциональную регуляцию
   */
  @Post('regulation')
  @ApiOperation({ summary: 'Применить эмоциональную регуляцию' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Результат применения эмоциональной регуляции' })
  async applyEmotionalRegulation(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() regulationDto: ApplyEmotionalRegulationDto,
  ): Promise<{
    success: boolean;
    newState: EmotionalState;
    effectiveness: number;
    sideEffects: string[];
  }> {
    return this.withErrorHandling('применении эмоциональной регуляции', async () => {
      const context: EmotionalContext =
        regulationDto.context ??
        (await this.emotionalStateService.createEmotionalContext(characterId));

      return await this.emotionalStateService.applyEmotionalRegulation(
        characterId,
        regulationDto.strategy,
        regulationDto.intensity,
        context,
      );
    });
  }

  /**
   * Анализировать эмоциональные паттерны
   */
  @Get('patterns')
  @ApiOperation({ summary: 'Анализировать эмоциональные паттерны персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiQuery({ name: 'fromDate', required: true, description: 'Дата начала периода' })
  @ApiQuery({ name: 'toDate', required: true, description: 'Дата окончания периода' })
  @ApiResponse({ status: 200, description: 'Список эмоциональных паттернов' })
  async analyzeEmotionalPatterns(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ): Promise<EmotionalPattern[]> {
    return this.withErrorHandling('анализе эмоциональных паттернов', async () => {
      if (!fromDate || !toDate) {
        throw new HttpException('Параметры fromDate и toDate обязательны', HttpStatus.BAD_REQUEST);
      }

      const timeRange = {
        from: new Date(fromDate),
        to: new Date(toDate),
      };

      return await this.emotionalStateService.analyzeEmotionalPatterns(characterId, timeRange);
    });
  }

  /**
   * Предсказать эмоциональную реакцию
   */
  @Post('predict')
  @ApiOperation({ summary: 'Предсказать эмоциональную реакцию персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Предсказанная эмоциональная реакция' })
  async predictEmotionalReaction(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() predictionDto: PredictEmotionalReactionDto,
  ): Promise<{
    predictedState: EmotionalState;
    confidence: number;
    alternativeStates: EmotionalState[];
    factors: string[];
  }> {
    return this.withErrorHandling('предсказании эмоциональной реакции', async () => {
      const context: EmotionalContext =
        predictionDto.context ??
        (await this.emotionalStateService.createEmotionalContext(characterId));

      return await this.emotionalStateService.predictEmotionalReaction(
        characterId,
        predictionDto.trigger,
        context,
      );
    });
  }

  /**
   * Симулировать эмоциональный каскад
   */
  @Post('cascade')
  @ApiOperation({ summary: 'Симулировать эмоциональный каскад' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Результат симуляции эмоционального каскада' })
  async simulateEmotionalCascade(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() cascadeDto: SimulateEmotionalCascadeDto,
  ): Promise<{
    cascadeSteps: EmotionalState[];
    finalState: EmotionalState;
    duration: number;
    probability: number;
  }> {
    return this.withErrorHandling('симуляции эмоционального каскада', async () => {
      const context: EmotionalContext =
        cascadeDto.context ??
        (await this.emotionalStateService.createEmotionalContext(characterId));

      return await this.emotionalStateService.simulateEmotionalCascade(
        characterId,
        cascadeDto.initialEmotion,
        context,
        cascadeDto.maxDepth || 3,
      );
    });
  }

  /**
   * Анализировать эмоциональную совместимость
   */
  @Post('compatibility')
  @ApiOperation({ summary: 'Анализировать эмоциональную совместимость между персонажами' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID первого персонажа' })
  @ApiResponse({ status: 200, description: 'Результат анализа эмоциональной совместимости' })
  async analyzeEmotionalCompatibility(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() compatibilityDto: AnalyzeEmotionalCompatibilityDto,
  ): Promise<{
    overallCompatibility: number;
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    synergies: string[];
    conflicts: string[];
  }> {
    return this.withErrorHandling('анализе эмоциональной совместимости', async () => {
      const context: EmotionalContext =
        compatibilityDto.context ??
        (await this.emotionalStateService.createEmotionalContext(characterId));

      return await this.emotionalStateService.analyzeEmotionalCompatibility(
        characterId,
        compatibilityDto.characterId2,
        context,
      );
    });
  }

  /**
   * Оптимизировать эмоциональное состояние
   */
  @Post('optimize')
  @ApiOperation({ summary: 'Оптимизировать эмоциональное состояние для достижения цели' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Результат оптимизации эмоционального состояния' })
  async optimizeEmotionalState(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() optimizationDto: OptimizeEmotionalStateDto,
  ): Promise<{
    targetState: EmotionalState;
    strategy: EmotionalRegulationStrategy;
    steps: string[];
    expectedDuration: number;
    successProbability: number;
  }> {
    return this.withErrorHandling('оптимизации эмоционального состояния', async () => {
      const context: EmotionalContext =
        optimizationDto.context ??
        (await this.emotionalStateService.createEmotionalContext(characterId));

      return await this.emotionalStateService.optimizeEmotionalState(
        characterId,
        optimizationDto.goal,
        optimizationDto.constraints,
        context,
      );
    });
  }

  /**
   * Создать снимок эмоционального состояния
   */
  @Post('snapshot')
  @ApiOperation({ summary: 'Создать снимок эмоционального состояния персонажа' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 201, description: 'Снимок эмоционального состояния' })
  async createEmotionalSnapshot(@Param('characterId', ParseIntPipe) characterId: number): Promise<{
    timestamp: Date;
    state: EmotionalState;
    profile: EmotionalProfile;
    recentMemories: EmotionalMemory[];
    activePatterns: EmotionalPattern[];
    context: EmotionalContext;
    metadata: Record<string, any>;
  }> {
    return this.withErrorHandling('создании снимка эмоционального состояния', async () => {
      return await this.emotionalStateService.createEmotionalSnapshot(characterId);
    });
  }

  /**
   * Восстановить состояние из снимка
   */
  @Post('restore')
  @ApiOperation({ summary: 'Восстановить эмоциональное состояние из снимка' })
  @ApiParam({ name: 'characterId', type: 'number', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Результат восстановления состояния' })
  async restoreFromSnapshot(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body()
    snapshot: {
      state: EmotionalState;
      profile: EmotionalProfile;
      context: EmotionalContext;
    },
  ): Promise<{
    success: boolean;
    restoredState: EmotionalState;
    differences: string[];
  }> {
    return this.withErrorHandling('восстановлении состояния из снимка', async () => {
      return await this.emotionalStateService.restoreFromSnapshot(characterId, snapshot);
    });
  }
}
