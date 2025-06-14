import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entity для хранения настроек персонажей в Telegram
 */
@Entity('telegram_character_settings')
@Index(['characterId'], { unique: true })
export class TelegramCharacterSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', comment: 'ID персонажа' })
  characterId!: number;

  @Column({ type: 'boolean', default: true, comment: 'Включены ли автоматические действия' })
  autoActions!: boolean;

  @Column({ type: 'boolean', default: true, comment: 'Включены ли уведомления о действиях' })
  actionNotifications!: boolean;

  @Column({
    type: 'enum',
    enum: ['all', 'start_end', 'completion', 'none'],
    default: 'all',
    comment: 'Тип уведомлений',
  })
  notificationType!: 'all' | 'start_end' | 'completion' | 'none';

  @Column({
    type: 'enum',
    enum: ['simple', 'detailed', 'emoji'],
    default: 'detailed',
    comment: 'Формат уведомлений',
  })
  notificationFormat!: 'simple' | 'detailed' | 'emoji';

  @Column({
    type: 'int',
    default: 25,
    comment: 'Частота уведомлений о прогрессе (в процентах)',
  })
  progressNotificationFrequency!: number;

  @Column({
    type: 'int',
    default: 10,
    comment: 'Максимальное количество действий в день',
  })
  maxDailyActions!: number;

  @CreateDateColumn({ comment: 'Дата создания настроек' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: 'Дата последнего обновления настроек' })
  updatedAt!: Date;
}
