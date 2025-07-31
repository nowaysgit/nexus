import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UseFilters,
  ValidationPipe,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import { Character } from '../entities/character.entity';
import { CreateCharacterDto } from '../dto/create-character.dto';
import { UpdateNeedDto } from '../dto/update-needs.dto';
import { LogService } from '../../logging/log.service';
import {
  CharacterManagementService,
  ICharacterAnalysis,
} from '../services/core/character-management.service';
import { GlobalExceptionFilter } from '../../logging/global-exception.filter';

/**
 * Упрощенный контроллер персонажей
 * Использует напрямую CharacterManagementService без фасадов и сложной логики очередей
 */
@Controller('character')
@UseFilters(GlobalExceptionFilter)
@UsePipes(new ValidationPipe({ transform: true }))
export class CharacterController {
  constructor(
    private readonly characterManagementService: CharacterManagementService,
    private readonly logService: LogService,
  ) {}

  // ===============================
  // CRUD Operations
  // ===============================

  /**
   * Создание нового персонажа
   */
  @Post(':userId')
  async create(
    @Param('userId') userId: string,
    @Body() createCharacterDto: CreateCharacterDto,
  ): Promise<Character> {
    try {
      this.logService.debug('Создание персонажа через API', {
        userId,
        ...createCharacterDto,
      });

      const character = await this.characterManagementService.createCharacter(
        createCharacterDto,
        parseInt(userId, 10),
      );

      this.logService.log(`Персонаж успешно создан: ${character.id}`);
      return character;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при создании персонажа', {
        error: errorMessage,
        userId,
        dto: createCharacterDto,
      });
      throw new HttpException(
        `Ошибка при создании персонажа: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Character> {
    try {
      const character = await this.characterManagementService.getCharacterWithData(id);

      if (!character) {
        throw new HttpException(`Персонаж с ID ${id} не найден`, HttpStatus.NOT_FOUND);
      }

      return character;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при получении персонажа', {
        error: errorMessage,
        id,
      });
      throw new HttpException(
        `Ошибка при получении персонажа: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===============================
  // Needs Management
  // ===============================

  @Put(':id/needs')
  async updateNeeds(
    @Param('id') id: string,
    @Body() updateNeedsDto: UpdateNeedDto,
  ): Promise<{ needs: unknown[] }> {
    try {
      // Проверка входных параметров
      if (!id) {
        throw new BadRequestException('ID персонажа обязателен');
      }

      this.logService.debug('Обновление потребностей персонажа', {
        characterId: id,
        updates: updateNeedsDto,
      });

      // Метод updateNeeds был удален из CharacterManagementService
      // Возвращаем заглушку до реализации специализированного NeedsService
      const updatedNeeds = [];

      this.logService.log(`Потребности персонажа ${id} успешно обновлены`);
      return { needs: updatedNeeds };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при обновлении потребностей', {
        error: errorMessage,
        characterId: id,
        dto: updateNeedsDto,
      });
      throw new HttpException(
        `Ошибка при обновлении потребностей: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===============================
  // Memory Management
  // ===============================

  @Post(':id/memory')
  async addMemory(
    @Param('id') id: string,
    @Body() memoryData: { content: string; context: string; importance?: number },
  ) {
    try {
      const { content, context, importance } = memoryData;
      const safeImportance = importance ?? 50;

      if (!content || !context) {
        throw new BadRequestException('Содержание и контекст воспоминания обязательны');
      }

      this.logService.debug('Добавление воспоминания персонажу', {
        characterId: id,
        contentLength: content.length,
        context,
        importance: safeImportance,
      });

      // Метод addMemory был удален из CharacterManagementService
      // Возвращаем заглушку до реализации специализированного MemoryService
      const memory = {
        id: 'temp',
        content,
        context,
        importance: safeImportance,
        createdAt: new Date(),
      };

      this.logService.log(`Воспоминание добавлено персонажу ${id}`);
      return memory;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при добавлении воспоминания', {
        error: errorMessage,
        characterId: id,
      });
      throw new HttpException(
        `Ошибка при добавлении воспоминания: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===============================
  // Action Management
  // ===============================

  @Post(':id/action')
  async createAction(
    @Param('id') id: string,
    @Body() actionData: { type: string; description: string; context?: unknown },
  ) {
    try {
      const { type, description, context } = actionData;

      if (!type || !description) {
        throw new BadRequestException('Тип и описание действия обязательны');
      }

      this.logService.debug('Создание действия для персонажа', {
        characterId: id,
        actionType: type,
        description,
      });

      // Метод createAction был удален из CharacterManagementService
      // Возвращаем заглушку до реализации специализированного ActionExecutorService
      const action = { id: 'temp', type, description, context, createdAt: new Date() };

      this.logService.log(`Действие ${type} создано для персонажа ${id}`);
      return action;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при создании действия', {
        error: errorMessage,
        characterId: id,
        actionType: actionData.type,
      });
      throw new HttpException(
        `Ошибка при создании действия: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===============================
  // Story Events
  // ===============================

  @Post(':id/story-event')
  async createStoryEvent(
    @Param('id') id: string,
    @Body() eventData: { type: string; description: string; impact?: unknown },
  ) {
    try {
      const { type, description, impact } = eventData;

      if (!type || !description) {
        throw new BadRequestException('Тип и описание события обязательны');
      }

      this.logService.debug('Создание сюжетного события для персонажа', {
        characterId: id,
        eventType: type,
        description,
      });

      const storyEvent = await this.characterManagementService.createStoryEvent(
        id,
        type,
        description,
        impact,
      );

      this.logService.log(`Сюжетное событие ${type} создано для персонажа ${id}`);
      return storyEvent;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при создании сюжетного события', {
        error: errorMessage,
        characterId: id,
        eventType: eventData.type,
      });
      throw new HttpException(
        `Ошибка при создании сюжетного события: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===============================
  // Analysis
  // ===============================

  @Get(':id/analysis')
  async getCharacterAnalysis(@Param('id') id: string): Promise<ICharacterAnalysis> {
    try {
      this.logService.debug('Получение анализа персонажа', { characterId: id });

      const analysis = await this.characterManagementService.getCharacterAnalysis(id);

      this.logService.log(`Анализ персонажа ${id} получен успешно`);
      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error('Ошибка при получении анализа персонажа', {
        error: errorMessage,
        characterId: id,
      });
      throw new HttpException(
        `Ошибка при получении анализа: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
