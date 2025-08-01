/**
 * Анализ производительности SQL-запросов в проекте Nexus
 * Создан: 2025-08-01
 * Цель: Выявление узких мест и оптимизация критических запросов
 */

## Анализ критических SQL-запросов

### 1. DialogService - Проблемы производительности

#### 1.1 getOrCreateDialog() - Неоптимальные запросы
```typescript
// ПРОБЛЕМА: Два отдельных запроса вместо одного JOIN
let dialog = await this.dialogRepository.findOne({
  where: { telegramId: stringTelegramId, characterId, isActive: true },
  relations: ['character'], // LEFT JOIN с character
});

if (!dialog) {
  const character = await this.characterRepository.findOne({
    where: { id: characterId }, // Дублированный запрос
  });
}
```

**Решение:** Объединить в один оптимизированный запрос с LEFT JOIN

#### 1.2 getDialogHistory() - N+1 проблема
```typescript
// ПРОБЛЕМА: Не использует индекс для сортировки
return await this.messageRepository.find({
  where: { dialogId: dialog.id },
  order: { createdAt: 'DESC' }, // Нужен индекс на (dialogId, createdAt)
  take: limit,
});
```

**Решение:** Добавить составной индекс, использовать createQueryBuilder для сложных запросов

#### 1.3 getLastActivityTime() - Тяжелый JOIN
```typescript
// ПРОБЛЕМА: JOIN по всем сообщениям диалога
const lastDialog = await this.dialogRepository
  .createQueryBuilder('dialog')
  .leftJoin('dialog.messages', 'message') // Потенциально миллионы записей
  .where('dialog.characterId = :characterId', { characterId })
  .orderBy('message.createdAt', 'DESC')
  .limit(1)
  .getOne();
```

**Решение:** Использовать денормализацию или индексы

### 2. MemoryService - Производительность поиска

#### 2.1 searchMemoriesByKeywords() - ILIKE операции
```typescript
// ПРОБЛЕМА: Множественные ILIKE без индексов
keywords.forEach((keyword, index) => {
  queryBuilder.andWhere(`memory.content ILIKE :keyword${index}`, {
    [`keyword${index}`]: `%${keyword}%`,
  });
});
```

**Решение:** Full-text search индексы PostgreSQL или Elasticsearch

### 3. NeedsService - Частые обновления

#### 3.1 Множественные findOne вызовы
```typescript
// ПРОБЛЕМА: 10+ отдельных findOne запросов в разных методах
const need = await this.needRepository.findOne({
  where: { characterId, type: needType },
});
```

**Решение:** Batch loading и кеширование

## Предлагаемые оптимизации

### Уровень 1: Индексы БД (Критично)
1. **Составные индексы:**
   - `CREATE INDEX idx_dialog_telegram_character ON dialog(telegram_id, character_id, is_active)`
   - `CREATE INDEX idx_message_dialog_created ON message(dialog_id, created_at DESC)`
   - `CREATE INDEX idx_need_character_type ON need(character_id, type)`

2. **Full-text search:**
   - `CREATE INDEX idx_memory_content_fts ON character_memory USING gin(to_tsvector('russian', content))`

### Уровень 2: Оптимизация запросов
1. **Batch loading для потребностей**
2. **Денормализация last_message_at в dialog**
3. **Query optimization с EXPLAIN ANALYZE**

### Уровень 3: Кеширование
1. **Redis кеш для характеров**
2. **In-memory кеш для часто используемых данных**
3. **Кеш запросов с TTL**

### Уровень 4: Мониторинг
1. **Логирование медленных запросов**
2. **Метрики производительности**
3. **APM интеграция**

## Приоритеты реализации
1. **HIGH:** Индексы БД (мгновенный эффект)
2. **HIGH:** Оптимизация DialogService.getOrCreateDialog()
3. **MEDIUM:** Кеширование характеров и потребностей
4. **MEDIUM:** Batch loading в NeedsService
5. **LOW:** Full-text search для памяти

## Ожидаемый результат
- **Время ответа диалогов:** с 200-500ms до 50-100ms
- **Throughput:** увеличение в 3-5 раз
- **CPU utilization:** снижение на 40-60%
- **Memory usage:** стабилизация с кешированием
