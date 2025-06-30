import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { LogService } from '../logging/log.service';
import { BaseService } from '../common/base/base.service';

@Injectable()
export class EncryptionService extends BaseService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    logService: LogService,
  ) {
    super(logService);

    // Получаем ключ шифрования из конфигурации или генерируем временный
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    if (keyString) {
      this.encryptionKey = Buffer.from(keyString, 'hex');
    } else {
      this.logWarning('ENCRYPTION_KEY не найден в конфигурации, используется временный ключ');
      this.encryptionKey = crypto.randomBytes(this.keyLength);
    }
  }

  async encrypt(text: string): Promise<string> {
    return this.withErrorHandling('шифровании данных', async () => {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('additional-data'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Объединяем IV, tag и зашифрованные данные
      const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;

      this.logDebug('Данные успешно зашифрованы');
      return result;
    });
  }

  async decrypt(encryptedData: string): Promise<string> {
    return this.withErrorHandling('расшифровке данных', async () => {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Неверный формат зашифрованных данных');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAAD(Buffer.from('additional-data'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logDebug('Данные успешно расшифрованы');
      return decrypted;
    });
  }

  async isEncrypted(data: string): Promise<boolean> {
    return this.withErrorHandling('проверке шифрования данных', async () => {
      // Проверяем формат зашифрованных данных
      const parts = data.split(':');
      return (
        parts.length === 3 &&
        parts[0].length === this.ivLength * 2 &&
        parts[1].length === this.tagLength * 2
      );
    });
  }

  async hash(data: string): Promise<string> {
    return this.withErrorHandling('хешировании данных', async () => {
      const hash = crypto.createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    });
  }

  async generateKey(): Promise<string> {
    return this.withErrorHandling('генерации ключа шифрования', async () => {
      const key = crypto.randomBytes(this.keyLength);
      return key.toString('hex');
    });
  }
}
