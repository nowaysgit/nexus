// ==UserScript==
// @name        VSCode Auto Resume
// @namespace   nexus-automation
// @description Automatically handles VS Code chat interactions with optimized performance
// @version     2.0
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Конфигурация и константы
     */
    const CONFIG = {
        observer: {
            childList: true,
            subtree: true,
            characterData: true
        },
        throttle: {
            delay: 100 // мс для throttling обработчика мутаций
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
         * Throttling функция для ограничения частоты вызовов
         */
        throttle(func, delay) {
            let timeoutId;
            let lastExecTime = 0;
            
            return function(...args) {
                const currentTime = Date.now();
                
                if (currentTime - lastExecTime > delay) {
                    func.apply(this, args);
                    lastExecTime = currentTime;
                } else {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        func.apply(this, args);
                        lastExecTime = Date.now();
                    }, delay - (currentTime - lastExecTime));
                }
            };
        },

        /**
         * Безопасный клик по элементу с логированием
         */
        safeClick(element, buttonName) {
            try {
                if (element && typeof element.click === 'function') {
                    element.click();
                    console.log(`${buttonName} button clicked successfully`);
                    return true;
                }
            } catch (error) {
                console.error(`Error clicking ${buttonName} button:`, error);
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
        }
    };

    /**
     * Основной класс для управления автоматизацией
     */
    class VSCodeAutomation {
        constructor() {
            this.observer = null;
            this.isInitialized = false;
            this.lastActionTimestamp = 0;
            
            // Throttled версия обработчика мутаций
            this.throttledMutationHandler = Utils.throttle(
                this.handleMutations.bind(this), 
                CONFIG.throttle.delay
            );
        }

        /**
         * Инициализация автоматизации
         */
        init() {
            if (this.isInitialized) {
                console.warn('VSCodeAutomation already initialized');
                return;
            }

            this.setupMutationObserver();
            this.runInitialChecks();
            this.setupCleanup();
            
            this.isInitialized = true;
            console.log('VSCodeAutomation initialized successfully');
        }

        /**
         * Настройка MutationObserver
         */
        setupMutationObserver() {
            this.observer = new MutationObserver(this.throttledMutationHandler);
            this.observer.observe(document.body, CONFIG.observer);
        }

        /**
         * Обработчик мутаций DOM
         */
        handleMutations(mutationsList) {
            const relevantMutations = mutationsList.filter(mutation => 
                mutation.type === 'childList' || mutation.type === 'characterData'
            );

            if (relevantMutations.length === 0) return;

            this.performAllChecks();
        }

        /**
         * Выполнение всех проверок и действий
         */
        performAllChecks() {
            const now = Date.now();
            // Предотвращаем слишком частые действия
            if (now - this.lastActionTimestamp < 500) return;

            try {
                const actions = [
                    this.checkAndClickContinueButton.bind(this),
                    this.checkAndClickTryAgainButton.bind(this),
                    this.checkAwaitNextMoveCondition.bind(this)
                ];

                for (const action of actions) {
                    if (action()) {
                        this.lastActionTimestamp = now;
                        break; // Выполняем только одно действие за раз
                    }
                }
            } catch (error) {
                console.error('Error during automation checks:', error);
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

                console.log('AWAIT NEXT MOVE condition met - ready for next action');
                return true;
            } catch (error) {
                console.error('Error checking AWAIT NEXT MOVE condition:', error);
                return false;
            }
        }

        /**
         * Запуск первоначальных проверок
         */
        runInitialChecks() {
            // Небольшая задержка для загрузки DOM
            setTimeout(() => {
                this.performAllChecks();
            }, 300);
        }

        /**
         * Настройка очистки ресурсов
         */
        setupCleanup() {
            const cleanup = () => {
                if (this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
                this.isInitialized = false;
                console.log('VSCodeAutomation cleaned up');
            };

            // Очистка при закрытии страницы
            window.addEventListener('unload', cleanup);
            window.addEventListener('beforeunload', cleanup);
            
            // Очистка при потере фокуса (опционально)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.observer) {
                    console.log('Page hidden, pausing automation');
                }
            });
        }

        /**
         * Принудительная остановка автоматизации
         */
        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.isInitialized = false;
            console.log('VSCodeAutomation stopped manually');
        }
    }

    // Инициализация автоматизации
    const automation = new VSCodeAutomation();
    
    // Ожидаем полной загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => automation.init());
    } else {
        automation.init();
    }

    // Экспорт для возможного ручного управления через консоль
    window.VSCodeAutomation = automation;
})();