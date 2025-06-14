import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('access_keys')
export class AccessKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  key: string;

  @Column({ default: false })
  isActivated: boolean;

  @Column({ nullable: true })
  activatedByUserId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'activatedByUserId' })
  activatedByUser: User;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
