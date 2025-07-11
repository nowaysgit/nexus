import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LogService } from '../logging/log.service';
import { BaseService } from '../common/base/base.service';
import {
  PromptTemplate,
  PromptCategory,
  TemplateVersion,
} from '../common/interfaces/prompt-template.interface';
import { Character } from '../character/entities/character.entity';
import { EmotionalState } from '../character/entities/emotional-state';

interface TemplateMetadata {
  name: string;
  description: string;
  author: string;
  tags: string[];
  maxTokens: number;
  recommendedTemperature: number;
}

interface TemplateMetadataMap {
  [key: string]: TemplateMetadata;
}

/**
 * Централизованный сервис для работы с шаблонами промптов
 * Обеспечивает единый подход к созданию и управлению промптами в приложении
 * Поддерживает версионирование, статистику использования и оптимизацию токенов
 */
@Injectable()
export class PromptTemplateService extends BaseService {
  private readonly templates = new Map<string, Map<string, PromptTemplate>>();
  private readonly activeVersions = new Map<string, string>();
  private readonly categories = new Map<string, PromptCategory>();
  private readonly usageStats = new Map<
    string,
    { totalUses: number; successRate: number; averageTokens: number }
  >();

  constructor(logService: LogService) {
    super(logService);
    this.initializeDefaultTemplates();
  }

  /**
   * Создание промпта на основе шаблона
   * @param templateType - тип шаблона
   * @param params - параметры для подстановки
   * @param version - версия шаблона (опционально)
   * @returns сформированный промпт
   */
  createPrompt(templateType: string, params: Record<string, unknown>, version?: string): string {
    return this.withErrorHandlingSync(`создания промпта '${templateType}'`, () => {
      const template = this.getTemplate(templateType, version);
      if (!template) {
        this.logWarning(
          `Шаблон промпта '${templateType}' версии '${version || 'latest'}' не найден`,
          {
            templateType,
            version,
            availableTemplates: Array.from(this.templates.keys()),
          },
        );
        throw new Error(
          `Шаблон промпта '${templateType}' версии '${version || 'latest'}' не найден`,
        );
      }

      const renderedPrompt = this.renderTemplate(template.template, params);

      // Обновляем статистику использования
      this.updateUsageStats(
        templateType,
        version || this.activeVersions.get(templateType) || 'latest',
        renderedPrompt,
      );

      return renderedPrompt;
    });
  }

  /**
   * Получение шаблона по типу и версии
   * @param templateType - тип шаблона
   * @param version - версия шаблона
   * @returns шаблон или null
   */
  getTemplate(templateType: string, version?: string): PromptTemplate | null {
    const templateVersions = this.templates.get(templateType);
    if (!templateVersions) {
      return null;
    }

    const useVersion = version || this.activeVersions.get(templateType);
    if (!useVersion) {
      // Возвращаем последнюю версию если активная не установлена
      const versions = Array.from(templateVersions.keys()).sort();
      const latestVersion = versions[versions.length - 1];
      return templateVersions.get(latestVersion) || null;
    }

    return templateVersions.get(useVersion) || null;
  }

  /**
   * Создание системного промпта для персонажа
   * @param character - персонаж
   * @param emotionalState - эмоциональное состояние
   * @param context - дополнительный контекст
   * @returns системный промпт
   */
  createCharacterSystemPrompt(
    character: Character,
    emotionalState?: EmotionalState,
    context?: string,
  ): string {
    const contextPrompt = context ? `<context>\n${context}\n</context>` : '';

    return this.createPrompt(
      'character-system',
      {
        characterName: character.name,
        characterDescription: character.biography,
        personalityTraits: character.personality?.traits?.join(', ') || 'не указаны',
        hobbies: character.personality?.hobbies?.join(', ') || 'не указаны',
        fears: character.personality?.fears?.join(', ') || 'не указаны',
        values: character.personality?.values?.join(', ') || 'не указаны',
        currentEmotion: emotionalState?.primary || 'нейтральное',
        emotionalIntensity: emotionalState?.intensity || 50,
        additionalContext: contextPrompt,
      },
      '1.1.0',
    );
  }

  /**
   * Создание промпта для анализа сообщений
   * @param context - контекст анализа
   * @returns промпт для анализа
   */
  createAnalysisPrompt(context?: string): string {
    return this.createPrompt('message-analysis', {
      context: context || 'Проанализируй сообщение пользователя',
    });
  }

  /**
   * Регистрация нового шаблона с версионированием
   * @param template - шаблон для регистрации
   */
  registerTemplate(template: PromptTemplate): void {
    if (!template.version) {
      template.version = '1.0.0';
    }

    if (!template.createdAt) {
      template.createdAt = new Date();
    }

    template.updatedAt = new Date();

    if (!this.templates.has(template.type)) {
      this.templates.set(template.type, new Map());
    }

    const templateVersions = this.templates.get(template.type);
    templateVersions.set(template.version, template);

    // Устанавливаем активную версию если это первая или если не указана
    if (!this.activeVersions.has(template.type) || templateVersions.size === 1) {
      this.activeVersions.set(template.type, template.version);
    }

    this.logDebug(`Зарегистрирован шаблон промпта: ${template.type} v${template.version}`, {
      template,
    });
  }

  /**
   * Обновление активной версии шаблона
   * @param templateType - тип шаблона
   * @param version - версия для активации
   */
  setActiveVersion(templateType: string, version: string): void {
    const templateVersions = this.templates.get(templateType);
    if (!templateVersions || !templateVersions.has(version)) {
      throw new Error(`Шаблон '${templateType}' версии '${version}' не найден`);
    }

    this.activeVersions.set(templateType, version);
    this.logDebug(`Активная версия шаблона '${templateType}' изменена на '${version}'`);
  }

  /**
   * Получение всех версий шаблона
   * @param templateType - тип шаблона
   * @returns массив версий
   */
  getTemplateVersions(templateType: string): TemplateVersion[] {
    const templateVersions = this.templates.get(templateType);
    if (!templateVersions) {
      return [];
    }

    const activeVersion = this.activeVersions.get(templateType);
    return Array.from(templateVersions.entries()).map(([version, template]) => ({
      version,
      template,
      isActive: version === activeVersion,
      createdAt: template.createdAt || new Date(),
    }));
  }

  /**
   * Получение статистики использования шаблона
   * @param templateType - тип шаблона
   * @param version - версия шаблона
   * @returns статистика использования
   */
  getUsageStats(
    templateType: string,
    version?: string,
  ): { totalUses: number; successRate: number; averageTokens: number } | null {
    const key = `${templateType}:${version || this.activeVersions.get(templateType) || 'latest'}`;
    return this.usageStats.get(key) || null;
  }

  /**
   * Получение всех доступных шаблонов
   * @returns список всех шаблонов
   */
  getAllTemplates(): PromptTemplate[] {
    const allTemplates: PromptTemplate[] = [];
    this.templates.forEach(templateVersions => {
      templateVersions.forEach(template => {
        allTemplates.push(template);
      });
    });
    return allTemplates;
  }

  /**
   * Получение шаблонов по категории
   * @param categoryName - название категории
   * @returns шаблоны категории
   */
  getTemplatesByCategory(categoryName: string): PromptTemplate[] {
    const allTemplates = this.getAllTemplates();
    return allTemplates.filter(template => template.category === categoryName);
  }

  /**
   * Оптимизация промпта для уменьшения токенов
   * @param prompt - исходный промпт
   * @param maxTokens - максимальное количество токенов
   * @returns оптимизированный промпт
   */
  optimizePromptTokens(prompt: string, maxTokens?: number): string {
    if (!maxTokens) {
      return prompt;
    }

    const estimatedTokens = this.estimateTokenCount(prompt);
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }

    // Простая оптимизация: обрезаем лишние пробелы и переносы
    let optimized = prompt
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы одним
      .replace(/\n\s*\n/g, '\n') // Убираем пустые строки
      .trim();

    // Если все еще превышаем лимит, обрезаем
    const optimizedTokens = this.estimateTokenCount(optimized);
    if (optimizedTokens > maxTokens) {
      const charLimit = Math.floor((optimized.length * maxTokens) / optimizedTokens);
      optimized = optimized.substring(0, charLimit) + '...';
    }

    this.logDebug('Оптимизирован промпт для токенов', {
      originalTokens: estimatedTokens,
      optimizedTokens: this.estimateTokenCount(optimized),
      maxTokens,
    });

    return optimized;
  }

  /**
   * Оценка количества токенов в тексте
   * @param text - текст для анализа
   * @returns примерное количество токенов
   */
  private estimateTokenCount(text: string): number {
    // Простая оценка: примерно 4 символа на токен для английского, 6 для русского
    const russianChars = (text.match(/[а-яё]/gi) || []).length;
    const otherChars = text.length - russianChars;
    return Math.ceil(russianChars / 6 + otherChars / 4);
  }

  /**
   * Обновление статистики использования
   * @param templateType - тип шаблона
   * @param version - версия шаблона
   * @param renderedPrompt - отрендеренный промпт
   */
  private updateUsageStats(templateType: string, version: string, renderedPrompt: string): void {
    const key = `${templateType}:${version}`;
    const current = this.usageStats.get(key) || {
      totalUses: 0,
      successRate: 100,
      averageTokens: 0,
    };

    const tokens = this.estimateTokenCount(renderedPrompt);
    current.totalUses += 1;
    current.averageTokens = Math.round(
      (current.averageTokens * (current.totalUses - 1) + tokens) / current.totalUses,
    );

    this.usageStats.set(key, current);
  }

  /**
   * Рендеринг шаблона с подстановкой параметров
   * @param template - шаблон
   * @param params - параметры
   * @returns отрендеренный текст
   */
  private renderTemplate(template: string, params: Record<string, unknown>): string {
    let result = template;

    // Заменяем плейсхолдеры в формате {{variable}}
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      let stringValue: string;
      if (value === null || value === undefined) {
        stringValue = '';
      } else if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value as string | number | boolean);
      }
      result = result.replace(new RegExp(placeholder, 'g'), stringValue);
    }

    // Проверяем что не остались незамещенные плейсхолдеры
    const unreplacedPlaceholders = result.match(/\{\{[^}]+\}\}/g);
    if (unreplacedPlaceholders) {
      this.logWarning('Обнаружены незамещенные плейсхолдеры в промпте', {
        unreplacedPlaceholders,
        template,
        params,
      });
    }

    return result;
  }

  /**
   * Инициализация стандартных шаблонов
   */
  private initializeDefaultTemplates(): void {
    const templatesDir = path.join(__dirname, 'templates');

    // Метаданные для шаблонов. В будущем можно вынести в отдельный manifest.json
    const templateMetadata: TemplateMetadataMap = {
      'character-system': {
        name: 'Системный промпт персонажа',
        description: 'Системный промпт для создания характера персонажа',
        author: 'System',
        tags: ['character', 'system', 'personality'],
        maxTokens: 2048,
        recommendedTemperature: 0.8,
      },
      'message-analysis': {
        name: 'Детальный анализ сообщения',
        description: 'Централизованный промпт для детального анализа пользовательских сообщений',
        author: 'System',
        tags: ['analysis', 'message', 'json', 'detailed'],
        maxTokens: 2000,
        recommendedTemperature: 0.1,
      },
      'character-name-generation': {
        name: 'Генерация имени персонажа',
        description: 'Промпт для генерации имен персонажей',
        author: 'System',
        tags: ['character', 'name', 'generation'],
        maxTokens: 50,
        recommendedTemperature: 0.9,
      },
      'context-importance-analysis': {
        name: 'Анализ важности контекста',
        description: 'Промпт для определения важности контекста в системе компрессии',
        author: 'System',
        tags: ['context', 'analysis', 'importance'],
        maxTokens: 10,
        recommendedTemperature: 0.1,
      },
    };

    try {
      const templateFiles = fs.readdirSync(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const filePath = path.join(templatesDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf-8');

          // Парсим имя файла: character-system-v1.0.0.hbs
          const nameParts = file.replace('.hbs', '').split('-v');
          if (nameParts.length !== 2) {
            this.logWarning(`Неверный формат имени файла шаблона: ${file}`);
            continue;
          }

          const type = nameParts[0];
          const version = nameParts[1];
          const metadata = templateMetadata[type];

          if (!metadata) {
            this.logWarning(`Не найдены метаданные для шаблона типа: ${type}`);
            continue;
          }

          this.registerTemplate({
            type,
            version,
            template: fileContent,
            ...metadata,
          });
        }
      }
    } catch (error) {
      this.logError('Ошибка при инициализации шаблонов промптов из файлов', {
        error: (error as Error).message,
      });
      // Можно добавить fallback на старый метод, если файлы не найдены
    }

    // Устанавливаем новые версии как активные
    this.setActiveVersion('character-system', '1.1.0');
    this.setActiveVersion('message-analysis', '2.1.0');

    this.logService.debug('Инициализированы шаблоны промптов из файлов.', {
      templatesCount: this.templates.size,
      totalVersions: this.getAllTemplates().length,
    });
  }
}
