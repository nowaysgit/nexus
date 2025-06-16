!function () {
    console.log("Cursor Auto Resume and Connection Error Handler: Running");
    let lastResumeClick = 0;
    let lastMessageSent = 0;

    function handleResume() {
        const currentTime = Date.now();
        if (currentTime - lastResumeClick < 3000) return;

        const elements = document.querySelectorAll("body *");
        for (const element of elements) {
            if (element && element.textContent &&
                (element.textContent.includes("stop the agent after 25 tool calls") ||
                    element.textContent.includes("Note: we default stop"))) {
                const links = element.querySelectorAll('a, span.markdown-link, [role="link"], [data-link]');
                for (const link of links) {
                    if (link.textContent.trim() === "resume the conversation") {
                        console.log('Clicking "resume the conversation" link');
                        link.click();
                        lastResumeClick = currentTime;
                        return;
                    }
                }
            }
        }
    }

    function handleConnectionError() {
        const currentTime = Date.now();
        if (currentTime - lastMessageSent < 5000) return; // Ограничение на частоту отправки сообщений

        const errorNotifications = document.querySelectorAll('.bg-dropdown-background.border-dropdown-border');
        for (const notification of errorNotifications) {
            if (notification.textContent.includes("Connection failed. If the problem persists, please check your internet connection or VPN")) {
                console.log('Connection error detected, attempting to send message');
                sendMessageToChat("Продолжи, тебя прервала ошибка соединения");
                lastMessageSent = currentTime;
                return true;
            }
        }
        return false;
    }

    function handleConnectionIssue() {
        const errorNotification = Array.from(document.querySelectorAll('div.bg-dropdown-background.border-dropdown-border')).find(el =>
            el.textContent.includes("We're having trouble connecting to the model provider. This might be temporary - please try again in a moment.")
        );

        if (errorNotification) {
            const resumeButton = Array.from(errorNotification.querySelectorAll('div.anysphere-secondary-button')).find(btn =>
                btn.textContent.includes('Resume')
            );

            if (resumeButton) {
                console.log('Found "Resume" button for connection issue, clicking it...');
                resumeButton.click();
                return true;
            }
        }
        return false;
    }

    function sendMessageToChat(message) {
        const chatInput = document.querySelector('.aislash-editor-input[data-lexical-editor="true"]');
        if (chatInput) {
            // Фокусируемся на поле ввода
            chatInput.focus();

            // Очищаем текущее содержимое инпута безопасным способом
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);

            // Вставляем текст сообщения
            document.execCommand('insertText', false, message);

            // Создаем событие ввода текста для обновления состояния
            const inputEvent = new Event('input', { bubbles: true });
            chatInput.dispatchEvent(inputEvent);

            // Ждем небольшую задержку, чтобы интерфейс обновился
            setTimeout(() => {
                // Ищем и нажимаем кнопку отправки
                const sendButtonContainer = document.querySelector('.composer-button-area');
                if (sendButtonContainer) {
                    const sendButton = sendButtonContainer.querySelector('.anysphere-icon-button[data-variant="background"]');
                    if (sendButton && !sendButton.hasAttribute('data-disabled')) {
                        sendButton.click();
                        console.log('Message sent to chat:', message);
                    } else {
                        // Альтернативный способ отправки через событие Enter
                        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                        chatInput.dispatchEvent(enterEvent);
                        console.log('Attempted to send message via Enter key event');
                    }
                } else {
                    console.log('Send button container not found');
                }
            }, 500);
        } else {
            console.log('Chat input not found');
        }
    }

    // Проверка последнего сообщения на наличие 'AWAIT NEXT MOVE'
    function handleAwaitNextMove() {
        const messages = document.querySelectorAll('.message-content-animated');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && (lastMessage.textContent.trim().endsWith('AWAIT NEXT MOVE') || lastMessage.textContent.trim().endsWith('AWAIT NEXT MOVE.'))) {
            // Проверка, что генерация не идет
            const isGenerating = document.querySelector('.group [style*="user-select: text"]') !== null;
            if (!isGenerating) {
                const chatInput = document.querySelector('.aislash-editor-input[data-lexical-editor="true"]');
                if (chatInput) {
                    // Фокусируемся на поле ввода
                    chatInput.focus();

                    // Очищаем текущее содержимое инпута безопасным способом
                    document.execCommand('selectAll', false, null);
                    document.execCommand('delete', false, null);

                    // Вставляем текст сообщения
                    const message = 'Продолжай попытки решать проблемы из "pending", после этого проанализируй .progress.helper, актуализируй его.';
                    document.execCommand('insertText', false, message);

                    // Создаем событие ввода текста для обновления состояния
                    const inputEvent = new Event('input', { bubbles: true });
                    chatInput.dispatchEvent(inputEvent);

                    // Ждем небольшую задержку, чтобы интерфейс обновился
                    setTimeout(() => {
                        // Ищем и нажимаем кнопку отправки
                        const sendButtonContainer = document.querySelector('.composer-button-area');
                        if (sendButtonContainer) {
                            const sendButton = sendButtonContainer.querySelector('.anysphere-icon-button[data-variant="background"]');
                            if (sendButton && !sendButton.hasAttribute('data-disabled')) {
                                sendButton.click();
                                console.log('Message sent to chat:', message);
                            } else {
                                // Альтернативный способ отправки через событие Enter
                                const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                                chatInput.dispatchEvent(enterEvent);
                                console.log('Attempted to send message via Enter key event');
                            }
                        } else {
                            console.log('Send button container not found');
                        }
                    }, 500);
                } else {
                    console.log('Chat input not found');
                }
            }
        }
    }

    setInterval(() => {
        handleConnectionIssue()
    }, 15000); // Проверять каждые 15 секунд

    setInterval(() => {
        handleResume();
        handleConnectionError();
        handleAwaitNextMove();
    }, 5000); // Проверять каждые 5 секунд

    // Вызываем сразу при запуске
    handleResume();
    handleConnectionError();
    handleAwaitNextMove();
}(); 