import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { LogService } from '../logging/log.service';
import { withErrorHandling } from '../common/utils/error-handling/error-handling.utils';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly logService: LogService;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    logService: LogService,
  ) {
    this.logService = logService.setContext(EncryptionService.name);

    // Получаем ключ шифрования из конфигурации или генерируем временный
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    if (keyString) {
      this.encryptionKey = Buffer.from(keyString, 'hex');
    } else {
      this.logService.warn('ENCRYPTION_KEY не найден в конфигурации, используется временный ключ');
      this.encryptionKey = crypto.randomBytes(this.keyLength);
    }
  }

  async encrypt(text: string): Promise<string> {
    return withErrorHandling(
      async () => {
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
        cipher.setAAD(Buffer.from('additional-data'));

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        // Объединяем IV, tag и зашифрованные данные
        const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;

        this.logService.debug('Данные успешно зашифрованы');
        return result;
      },
      'шифровании данных',
      this.logService,
      { textLength: text.length },
      '',
    );
  }

  async decrypt(encryptedData: string): Promise<string> {
    return withErrorHandling(
      async () => {
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

        this.logService.debug('Данные успешно расшифрованы');
        return decrypted;
      },
      'расшифровке данных',
      this.logService,
      { dataLength: encryptedData.length },
    );
  }

  async isEncrypted(data: string): Promise<boolean> {
    return withErrorHandling(
      async () => {
        // Проверяем формат зашифрованных данных
        const parts = data.split(':');
        return (
          parts.length === 3 &&
          parts[0].length === this.ivLength * 2 &&
          parts[1].length === this.tagLength * 2
        );
      },
      'проверке шифрования данных',
      this.logService,
      {},
      false,
    );
  }

  async hash(data: string): Promise<string> {
    return withErrorHandling(
      async () => {
        const hash = crypto.createHash('sha256');
        hash.update(data);
        return hash.digest('hex');
      },
      'хешировании данных',
      this.logService,
      { dataLength: data.length },
      '',
    );
  }

  async generateKey(): Promise<string> {
    return withErrorHandling(
      async () => {
        const key = crypto.randomBytes(this.keyLength);
        return key.toString('hex');
      },
      'генерации ключа шифрования',
      this.logService,
      {},
      '',
    );
  }
}
