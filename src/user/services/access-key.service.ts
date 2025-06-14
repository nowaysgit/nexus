import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessKey } from '../entities/access-key.entity';
import { User } from '../entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AccessKeyService {
  constructor(
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
  ) {}

  async generateKey(): Promise<AccessKey> {
    const key = crypto.randomBytes(6).toString('hex').toUpperCase();
    const accessKey = this.accessKeyRepository.create({ key });
    return this.accessKeyRepository.save(accessKey);
  }

  async generateBatchKeys(count: number): Promise<AccessKey[]> {
    const keys: AccessKey[] = [];

    for (let i = 0; i < count; i++) {
      const key = await this.generateKey();
      keys.push(key);
    }

    return keys;
  }

  async validateKey(key: string): Promise<AccessKey> {
    const accessKey = await this.accessKeyRepository.findOne({
      where: { key, isActivated: false },
    });

    if (!accessKey) {
      throw new NotFoundException('Ключ доступа недействителен или уже использован');
    }

    return accessKey;
  }

  async activateKey(key: string, user: User): Promise<AccessKey> {
    const accessKey = await this.validateKey(key);

    accessKey.isActivated = true;
    accessKey.activatedByUserId = user.id;
    accessKey.activatedByUser = user;
    accessKey.activatedAt = new Date();

    return this.accessKeyRepository.save(accessKey);
  }

  async findAllKeys(): Promise<AccessKey[]> {
    return this.accessKeyRepository.find({
      relations: ['activatedByUser'],
    });
  }

  async findUserKey(userId: number): Promise<AccessKey | null> {
    return this.accessKeyRepository.findOne({
      where: { activatedByUserId: userId },
      relations: ['activatedByUser'],
    });
  }
}
