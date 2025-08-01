#!/bin/bash

# Скрипт для автоматического скачивания и управления LLM моделями
# Поддерживает различные профили моделей (development, testing, production)

set -e

# Конфигурация
OLLAMA_ENDPOINT="${OLLAMA_ENDPOINT:-http://localhost:11434}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/../models"
LOG_FILE="$SCRIPT_DIR/../logs/model-download.log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}ℹ️ $1${NC}" | tee -a "$LOG_FILE"
}

# Создаем директории
mkdir -p "$MODELS_DIR" "$(dirname "$LOG_FILE")"

# Профили моделей
declare -A DEVELOPMENT_MODELS=(
    ["llama3.2:3b"]="Основная модель для разработки"
    ["llama3.2:1b"]="Облегченная модель для быстрых тестов"
)

declare -A TESTING_MODELS=(
    ["llama3.2:1b"]="Быстрая модель для CI/CD тестов"
)

declare -A PRODUCTION_MODELS=(
    ["llama3.2:8b"]="Высококачественная модель для production"
    ["llama3.2:3b"]="Резервная модель"
)

declare -A EMBEDDING_MODELS=(
    ["nomic-embed-text"]="Модель для векторных представлений"
)

# Функция проверки доступности Ollama
check_ollama() {
    info "Проверка доступности Ollama API..."
    if curl -f "$OLLAMA_ENDPOINT/api/tags" >/dev/null 2>&1; then
        success "Ollama API доступен"
        return 0
    else
        error "Ollama API недоступен по адресу $OLLAMA_ENDPOINT"
        return 1
    fi
}

# Функция скачивания модели
download_model() {
    local model="$1"
    local description="$2"
    
    info "Скачивание модели: $model ($description)"
    
    # Проверяем, существует ли модель уже
    if curl -s "$OLLAMA_ENDPOINT/api/tags" | jq -e ".models[] | select(.name == \"$model\")" >/dev/null 2>&1; then
        warning "Модель $model уже установлена, пропускаем"
        return 0
    fi
    
    # Скачиваем модель
    if curl -X POST "$OLLAMA_ENDPOINT/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$model\"}" \
        --progress-bar 2>>"$LOG_FILE"; then
        success "Модель $model успешно скачана"
        return 0
    else
        error "Ошибка скачивания модели $model"
        return 1
    fi
}

# Функция скачивания профиля моделей
download_profile() {
    local profile="$1"
    local -n models_ref=$2
    
    info "Скачивание профиля: $profile"
    
    for model in "${!models_ref[@]}"; do
        download_model "$model" "${models_ref[$model]}"
    done
}

# Функция показа установленных моделей
list_models() {
    info "Список установленных моделей:"
    if command -v jq >/dev/null 2>&1; then
        curl -s "$OLLAMA_ENDPOINT/api/tags" | jq -r '.models[] | "\(.name) - \(.size/1024/1024/1024 | floor)GB - \(.modified_at)"'
    else
        curl -s "$OLLAMA_ENDPOINT/api/tags"
    fi
}

# Функция удаления модели
remove_model() {
    local model="$1"
    
    info "Удаление модели: $model"
    if curl -X DELETE "$OLLAMA_ENDPOINT/api/delete" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$model\"}" 2>>"$LOG_FILE"; then
        success "Модель $model успешно удалена"
    else
        error "Ошибка удаления модели $model"
    fi
}

# Функция показа помощи
show_help() {
    echo "Использование: $0 [КОМАНДА] [ПАРАМЕТРЫ]"
    echo ""
    echo "Команды:"
    echo "  dev          - Скачать модели для разработки"
    echo "  test         - Скачать модели для тестирования"
    echo "  prod         - Скачать модели для production"
    echo "  embeddings   - Скачать модели для эмбеддингов"
    echo "  all          - Скачать все модели"
    echo "  list         - Показать установленные модели"
    echo "  remove MODEL - Удалить указанную модель"
    echo "  clean        - Удалить все модели"
    echo "  help         - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 dev                    # Скачать модели для разработки"
    echo "  $0 remove llama3.2:8b    # Удалить модель llama3.2:8b"
    echo "  $0 list                   # Показать установленные модели"
}

# Основная логика
main() {
    local command="${1:-help}"
    
    case "$command" in
        "dev"|"development")
            check_ollama && download_profile "DEVELOPMENT" DEVELOPMENT_MODELS
            ;;
        "test"|"testing")
            check_ollama && download_profile "TESTING" TESTING_MODELS
            ;;
        "prod"|"production")
            check_ollama && download_profile "PRODUCTION" PRODUCTION_MODELS
            ;;
        "embeddings")
            check_ollama && download_profile "EMBEDDINGS" EMBEDDING_MODELS
            ;;
        "all")
            if check_ollama; then
                download_profile "DEVELOPMENT" DEVELOPMENT_MODELS
                download_profile "PRODUCTION" PRODUCTION_MODELS
                download_profile "EMBEDDINGS" EMBEDDING_MODELS
            fi
            ;;
        "list")
            check_ollama && list_models
            ;;
        "remove")
            if [ -z "$2" ]; then
                error "Укажите модель для удаления"
                echo "Использование: $0 remove MODEL_NAME"
                exit 1
            fi
            check_ollama && remove_model "$2"
            ;;
        "clean")
            warning "Удаление всех моделей..."
            read -p "Вы уверены? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if check_ollama; then
                    models=$(curl -s "$OLLAMA_ENDPOINT/api/tags" | jq -r '.models[].name' 2>/dev/null || echo "")
                    for model in $models; do
                        remove_model "$model"
                    done
                fi
            fi
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Запуск
main "$@"
