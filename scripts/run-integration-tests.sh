#!/bin/bash

# Скрипт для запуска интеграционных тестов с LLM
# Использование: ./scripts/run-integration-tests.sh [--cleanup]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка зависимостей
check_dependencies() {
    log_info "Проверяем зависимости..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker не установлен!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose не установлен!"
        exit 1
    fi
    
    log_success "Зависимости проверены"
}

# Очистка предыдущих запусков
cleanup() {
    log_info "Очищаем предыдущие контейнеры..."
    
    cd "$PROJECT_ROOT"
    
    # Останавливаем и удаляем контейнеры
    docker-compose -f docker-compose.integration.yml down -v --remove-orphans 2>/dev/null || true
    
    # Удаляем старые образы (опционально)
    if [ "$1" = "--full-cleanup" ]; then
        docker system prune -f
        docker volume prune -f
    fi
    
    log_success "Очистка завершена"
}

# Запуск тестовой инфраструктуры
start_infrastructure() {
    log_info "Запускаем тестовую инфраструктуру..."
    
    cd "$PROJECT_ROOT"
    
    # Запускаем базовые сервисы
    docker-compose -f docker-compose.integration.yml up -d test-postgres test-redis test-ollama
    
    log_info "Ожидаем готовности сервисов..."
    
    # Ждем готовности PostgreSQL
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f docker-compose.integration.yml exec -T test-postgres pg_isready -U test_user -d nexus_test &>/dev/null; then
            log_success "PostgreSQL готов"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        log_error "PostgreSQL не запустился за отведенное время"
        return 1
    fi
    
    # Ждем готовности Redis
    timeout=30
    while [ $timeout -gt 0 ]; do
        if docker-compose -f docker-compose.integration.yml exec -T test-redis redis-cli ping &>/dev/null; then
            log_success "Redis готов"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    # Ждем готовности Ollama
    log_info "Ожидаем запуска Ollama (это может занять несколько минут)..."
    timeout=180
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:11435/api/tags &>/dev/null; then
            log_success "Ollama готов"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        log_warning "Ollama не отвечает, но продолжаем (тесты могут быть пропущены)"
    fi
}

# Загрузка LLM модели
setup_llm_model() {
    log_info "Загружаем LLM модель для тестов..."
    
    # Запускаем загрузку модели
    docker-compose -f docker-compose.integration.yml up test-model-setup
    
    # Проверяем, что модель загружена
    if curl -s http://localhost:11435/api/tags | grep -q "llama3.2:1b"; then
        log_success "Модель llama3.2:1b загружена"
    else
        log_warning "Модель может быть не загружена полностью"
    fi
}

# Запуск тестов
run_tests() {
    log_info "Запускаем интеграционные тесты..."
    
    cd "$PROJECT_ROOT"
    
    # Устанавливаем переменные окружения для тестов
    export NODE_ENV=test
    export DATABASE_URL="postgresql://test_user:test_password@localhost:5433/nexus_test"
    export REDIS_URL="redis://localhost:6380"
    export LLM_PROVIDER="llama"
    export LLM_ENDPOINT="http://localhost:11435"
    export LLM_MODEL="llama3.2:1b"
    
    # Выполняем миграции
    log_info "Выполняем миграции базы данных..."
    npm run migration:run
    
    # Запускаем только интеграционные тесты
    log_info "Запускаем тесты..."
    if npm run test:integration; then
        log_success "Все интеграционные тесты прошли успешно!"
        return 0
    else
        log_error "Некоторые тесты завершились с ошибками"
        return 1
    fi
}

# Главная функция
main() {
    log_info "🚀 Запуск интеграционных тестов с LLM"
    
    # Обработка аргументов
    CLEANUP_MODE="normal"
    RUN_TESTS=true
    
    for arg in "$@"; do
        case $arg in
            --cleanup)
                cleanup "$CLEANUP_MODE"
                exit 0
                ;;
            --full-cleanup)
                CLEANUP_MODE="full-cleanup"
                cleanup "$CLEANUP_MODE"
                exit 0
                ;;
            --setup-only)
                RUN_TESTS=false
                ;;
        esac
    done
    
    # Выполняем шаги
    check_dependencies
    cleanup
    start_infrastructure
    setup_llm_model
    
    if [ "$RUN_TESTS" = true ]; then
        if run_tests; then
            log_success "🎉 Интеграционные тесты завершены успешно!"
            exit 0
        else
            log_error "💥 Тесты завершились с ошибками"
            exit 1
        fi
    else
        log_success "🔧 Инфраструктура настроена. Запустите тесты вручную:"
        log_info "npm run test:integration"
    fi
}

# Обработка сигналов
trap 'log_warning "Получен сигнал завершения, очищаем..."; cleanup; exit 130' INT TERM

# Запуск
main "$@"
