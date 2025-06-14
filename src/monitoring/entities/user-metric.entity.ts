import { Entity, Column } from 'typeorm';
import { MetricBase } from './metric-base.entity';

/**
 * Типы метрик пользователя
 */
export enum UserMetricType {
  SESSION = 'session',
  MESSAGE = 'message',
  COMMAND = 'command',
  CHARACTER_CREATION = 'character_creation',
  CHARACTER_INTERACTION = 'character_interaction',
  API_USAGE = 'api_usage',
}

/**
 * Сущность для хранения метрик пользователей
 */
@Entity('user_metrics')
export class UserMetric extends MetricBase {
  @Column()
  userId: number;

  @Column({ nullable: true })
  telegramId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  event: string;

  @Column({ type: 'enum', enum: UserMetricType })
  metricType: UserMetricType;

  @Column({ type: 'float', default: 1 })
  value: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /**
   * Создает метрику для пользовательской сессии
   */
  static createSessionMetric(
    userId: number,
    telegramId: string,
    event: string,
    metadata?: Record<string, any>,
  ): UserMetric {
    const metric = new UserMetric();
    metric.userId = userId;
    metric.telegramId = telegramId;
    metric.event = event;
    metric.metricType = UserMetricType.SESSION;
    metric.type = 'user_session';
    metric.metadata = metadata || {};
    return metric;
  }

  /**
   * Создает метрику для сообщения пользователя
   */
  static createMessageMetric(
    userId: number,
    telegramId: string,
    messageType: string,
    metadata?: Record<string, any>,
  ): UserMetric {
    const metric = new UserMetric();
    metric.userId = userId;
    metric.telegramId = telegramId;
    metric.event = messageType;
    metric.metricType = UserMetricType.MESSAGE;
    metric.type = 'user_message';
    metric.metadata = metadata || {};
    return metric;
  }

  /**
   * Создает метрику для выполнения команды
   */
  static createCommandMetric(
    userId: number,
    telegramId: string,
    command: string,
    metadata?: Record<string, any>,
  ): UserMetric {
    const metric = new UserMetric();
    metric.userId = userId;
    metric.telegramId = telegramId;
    metric.event = command;
    metric.metricType = UserMetricType.COMMAND;
    metric.type = 'user_command';
    metric.metadata = metadata || {};
    return metric;
  }

  /**
   * Создает метрику для создания персонажа
   */
  static createCharacterCreationMetric(
    userId: number,
    telegramId: string,
    characterId: number,
    metadata?: Record<string, any>,
  ): UserMetric {
    const metric = new UserMetric();
    metric.userId = userId;
    metric.telegramId = telegramId;
    metric.event = 'create';
    metric.metricType = UserMetricType.CHARACTER_CREATION;
    metric.type = 'character_creation';
    metric.metadata = {
      characterId,
      ...metadata,
    };
    return metric;
  }

  /**
   * Создает метрику для взаимодействия с персонажем
   */
  static createCharacterInteractionMetric(
    userId: number,
    telegramId: string,
    characterId: number,
    interactionType: string,
    metadata?: Record<string, any>,
  ): UserMetric {
    const metric = new UserMetric();
    metric.userId = userId;
    metric.telegramId = telegramId;
    metric.event = interactionType;
    metric.metricType = UserMetricType.CHARACTER_INTERACTION;
    metric.type = 'character_interaction';
    metric.metadata = {
      characterId,
      ...metadata,
    };
    return metric;
  }
}
