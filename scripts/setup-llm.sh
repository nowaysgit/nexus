#!/bin/bash

# Скрипт для настройки локального LLM окружения
# Автоматическое скачивание и настройка Llama 4 моделей

set -e

echo "🚀 Настройка локального LLM окружения..."

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и повторите попытку."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и повторите попытку."
    exit 1
fi

# Создаем директории для моделей
echo "📁 Создание директорий..."
mkdir -p models
mkdir -p logs/llm

# Копируем environment файлы
echo "⚙️ Настройка конфигурации..."
if [ ! -f .env.local ]; then
    cp .env.local.llm .env.local
    echo "✅ Создан .env.local файл"
fi

# Запускаем LLM сервисы
echo "🐳 Запуск LLM сервисов..."
docker compose -f docker-compose.llm.yml up -d ollama redis-llm

# Ждем готовности сервисов
echo "⏳ Ожидание готовности Ollama..."
timeout 120s bash -c 'until curl -f http://localhost:11434/api/tags 2>/dev/null; do sleep 5; done'

# Скачиваем основные модели
echo "📥 Скачивание Llama 4 моделей..."
echo "Скачивание llama3.2:3b (основная модель)..."
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.2:3b"}' \
  --progress-bar

echo "Скачивание llama3.2:1b (облегченная модель для тестов)..."
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.2:1b"}' \
  --progress-bar

# Проверяем установленные модели
echo "📋 Проверка установленных моделей..."
curl -s http://localhost:11434/api/tags | jq '.models[].name' || echo "Модели установлены (jq не найден для форматирования)"

# Тестируем работу LLM
echo "🧪 Тестирование LLM..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "prompt": "Hello, test",
    "stream": false,
    "options": {"num_predict": 10}
  }')

if echo "$TEST_RESPONSE" | grep -q "response"; then
    echo "✅ LLM тест прошел успешно!"
else
    echo "❌ LLM тест не удался. Проверьте логи."
    exit 1
fi

echo ""
echo "🎉 Настройка завершена успешно!"
echo ""
echo "📝 Доступные команды:"
echo "  yarn llm:start     - Запустить LLM сервисы"
echo "  yarn llm:stop      - Остановить LLM сервисы"
echo "  yarn llm:test      - Запустить LLM тесты"
echo "  yarn llm:models    - Показать установленные модели"
echo ""
echo "🌐 Веб-интерфейсы:"
echo "  http://localhost:8080 - Ollama Web UI (запустите: docker compose -f docker-compose.llm.yml --profile dev up ollama-webui)"
echo ""
echo "📊 Endpoints:"
echo "  http://localhost:11434 - Ollama API"
echo "  http://localhost:6380  - Redis для кеширования"
