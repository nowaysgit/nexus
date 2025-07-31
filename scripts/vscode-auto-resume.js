// ==UserScript==
// @name        VSCode Auto Resume
// @namespace   nexus-automation
// @description Automatically handles VS Code chat interactions with periodic checks
// @version     3.0
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Конфигурация и константы
     */
    const CONFIG = {
        timing: {
            checkInterval: 2000, // мс между проверками (2 секунды)
            actionCooldown: 1000 // мс между действиями для предотвращения спама
        },
        selectors: {
            continueButton: 'a.monaco-button',
            tryAgainButton: '.chat-error-confirmation .chat-buttons-container a.monaco-button',
            lastInteractiveItem: '.interactive-item-container.editing-session.interactive-response.chat-most-recent-response',
            renderedMarkdown: '.value .rendered-markdown',
            lastParagraph: 'p:last-child',
            sendButton: '.action-label.codicon.codicon-send[aria-label="Send (Enter)"]',
            cancelButton: '.action-label.codicon.codicon-stop-circle[aria-label="Cancel"]'
        },
        triggers: {
            awaitNextMove: 'AWAIT NEXT MOVE',
            continueText: 'Continue',
            tryAgainText: 'Try Again'
        }
    };

    /**
     * Утилитные функции
     */
    const Utils = {
        /**
         * Безопасный клик по элементу с логированием
         */
        safeClick(element, buttonName) {
            try {
                if (element && typeof element.click === 'function') {
                    element.click();
                    console.log(`[VSCode Automation] ${buttonName} button clicked successfully`);
                    return true;
                }
            } catch (error) {
                console.error(`[VSCode Automation] Error clicking ${buttonName} button:`, error);
            }
            return false;
        },

        /**
         * Проверка видимости элемента
         */
        isElementVisible(element) {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(element).visibility !== 'hidden';
        },

        /**
         * Форматирование времени для логов
         */
        formatTime() {
            return new Date().toLocaleTimeString();
        }
    };

    /**
     * Основной класс для управления автоматизацией
     */
    class VSCodeAutomation {
        constructor() {
            this.intervalId = null;
            this.isRunning = false;
            this.lastActionTimestamp = 0;
            this.checkCount = 0;
        }

        /**
         * Запуск автоматизации
         */
        start() {
            if (this.isRunning) {
                console.warn('[VSCode Automation] Already running');
                return false;
            }

            this.isRunning = true;
            this.checkCount = 0;
            this.lastActionTimestamp = 0;

            // Запуск периодических проверок
            this.intervalId = setInterval(() => {
                this.performAllChecks();
            }, CONFIG.timing.checkInterval);

            // Выполнить первую проверку немедленно
            setTimeout(() => this.performAllChecks(), 500);

            console.log(`[VSCode Automation] Started with ${CONFIG.timing.checkInterval}ms interval`);
            return true;
        }

        /**
         * Остановка автоматизации
         */
        stop() {
            if (!this.isRunning) {
                console.warn('[VSCode Automation] Not running');
                return false;
            }

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            this.isRunning = false;
            console.log(`[VSCode Automation] Stopped after ${this.checkCount} checks`);
            return true;
        }

        /**
         * Получение статуса автоматизации
         */
        getStatus() {
            return {
                isRunning: this.isRunning,
                checkCount: this.checkCount,
                checkInterval: CONFIG.timing.checkInterval,
                lastActionTime: this.lastActionTimestamp ? new Date(this.lastActionTimestamp).toLocaleTimeString() : 'Never'
            };
        }

        /**
         * Изменение интервала проверок
         */
        setInterval(newInterval) {
            if (newInterval < 500 || newInterval > 30000) {
                console.error('[VSCode Automation] Interval must be between 500ms and 30000ms');
                return false;
            }

            CONFIG.timing.checkInterval = newInterval;
            
            if (this.isRunning) {
                this.stop();
                this.start();
                console.log(`[VSCode Automation] Interval changed to ${newInterval}ms`);
            }
            
            return true;
        }

        /**
         * Выполнение всех проверок и действий
         */
        performAllChecks() {
            if (!this.isRunning) return;

            this.checkCount++;
            const now = Date.now();
            
            // Предотвращаем слишком частые действия
            if (now - this.lastActionTimestamp < CONFIG.timing.actionCooldown) {
                return;
            }

            try {
                const actions = [
                    { name: 'Continue Button', func: this.checkAndClickContinueButton.bind(this) },
                    { name: 'Try Again Button', func: this.checkAndClickTryAgainButton.bind(this) },
                    { name: 'AWAIT NEXT MOVE', func: this.checkAwaitNextMoveCondition.bind(this) }
                ];

                for (const action of actions) {
                    if (action.func()) {
                        this.lastActionTimestamp = now;
                        console.log(`[VSCode Automation] Action performed: ${action.name} at ${Utils.formatTime()}`);
                        break; // Выполняем только одно действие за раз
                    }
                }

                // Логируем каждые 10 проверок для отслеживания активности
                if (this.checkCount % 10 === 0) {
                    console.log(`[VSCode Automation] Performed ${this.checkCount} checks, running for ${Math.round((now - (this.lastActionTimestamp || now)) / 1000)}s`);
                }
            } catch (error) {
                console.error('[VSCode Automation] Error during automation checks:', error);
            }
        }

        /**
         * Проверка и клик по кнопке Continue
         */
        checkAndClickContinueButton() {
            const buttons = document.querySelectorAll(CONFIG.selectors.continueButton);
            
            for (const button of buttons) {
                if (button.textContent?.trim() === CONFIG.triggers.continueText && 
                    Utils.isElementVisible(button)) {
                    return Utils.safeClick(button, 'Continue');
                }
            }
            return false;
        }

        /**
         * Проверка и клик по кнопке Try Again
         */
        checkAndClickTryAgainButton() {
            const tryAgainButton = document.querySelector(CONFIG.selectors.tryAgainButton);
            
            if (tryAgainButton && 
                tryAgainButton.textContent?.trim() === CONFIG.triggers.tryAgainText &&
                Utils.isElementVisible(tryAgainButton)) {
                return Utils.safeClick(tryAgainButton, 'Try Again');
            }
            return false;
        }

        /**
         * Проверка условия AWAIT NEXT MOVE
         */
        checkAwaitNextMoveCondition() {
            try {
                // Находим последний interactive-item-container
                const lastInteractiveItem = document.querySelector(CONFIG.selectors.lastInteractiveItem);
                if (!lastInteractiveItem) return false;

                // Проверяем текст в rendered-markdown
                const renderedMarkdown = lastInteractiveItem.querySelector(CONFIG.selectors.renderedMarkdown);
                if (!renderedMarkdown) return false;

                // Проверяем содержит ли текст "AWAIT NEXT MOVE" как последний элемент
                const lastParagraph = renderedMarkdown.querySelector(CONFIG.selectors.lastParagraph);
                if (!lastParagraph || !lastParagraph.textContent?.includes(CONFIG.triggers.awaitNextMove)) {
                    return false;
                }

                // Проверяем наличие кнопки Send (не Cancel)
                const sendButton = document.querySelector(CONFIG.selectors.sendButton);
                if (!sendButton || !Utils.isElementVisible(sendButton)) return false;

                // Проверяем что нет кнопки Cancel
                const cancelButton = document.querySelector(CONFIG.selectors.cancelButton);
                if (cancelButton && Utils.isElementVisible(cancelButton)) return false;

                console.log('[VSCode Automation] AWAIT NEXT MOVE condition met - ready for next action');
                return true;
            } catch (error) {
                console.error('[VSCode Automation] Error checking AWAIT NEXT MOVE condition:', error);
                return false;
            }
        }
    }

    // Создание экземпляра автоматизации
    const automation = new VSCodeAutomation();
    
    // Автоматический запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => automation.start(), 1000);
        });
    } else {
        setTimeout(() => automation.start(), 1000);
    }

    // Экспорт для управления через консоль браузера
    window.VSCodeAutomation = {
        // Основные методы управления
        start: () => automation.start(),
        stop: () => automation.stop(),
        status: () => automation.getStatus(),
        setInterval: (ms) => automation.setInterval(ms),
        
        // Информационные методы
        help: () => {
            console.log(`
[VSCode Automation Help]
Commands available:
  VSCodeAutomation.start()         - Start automation
  VSCodeAutomation.stop()          - Stop automation  
  VSCodeAutomation.status()        - Show current status
  VSCodeAutomation.setInterval(ms) - Change check interval (500-30000ms)
  VSCodeAutomation.help()          - Show this help

Current status: ${automation.isRunning ? 'RUNNING' : 'STOPPED'}
Check interval: ${CONFIG.timing.checkInterval}ms
            `);
        },
        
        // Ссылка на сам объект автоматизации (для расширенного доступа)
        _instance: automation,
        _config: CONFIG
    };

    // Добавляем обработчики закрытия страницы
    window.addEventListener('beforeunload', () => {
        automation.stop();
    });

    // Приветственное сообщение
    console.log('[VSCode Automation] Script loaded. Use VSCodeAutomation.help() for commands.');
})();