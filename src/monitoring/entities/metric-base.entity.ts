import { Column, CreateDateColumn, PrimaryColumn, BeforeInsert } from 'typeorm';

/**
 * Базовый класс для всех метрик в системе мониторинга
 */
export abstract class MetricBase {
  @PrimaryColumn()
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  source: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'jsonb', default: {} })
  tags: Record<string, string>;

  /**
   * Метод для добавления тегов к метрике
   * Теги используются для фильтрации и группировки метрик
   */
  addTag(key: string, value: string): void {
    this.tags = { ...this.tags, [key]: value };
  }

  /**
   * Метод для удаления тега из метрики
   */
  removeTag(key: string): void {
    if (this.tags && this.tags[key]) {
      const { [key]: removed, ...rest } = this.tags;
      this.tags = rest;
    }
  }

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}
