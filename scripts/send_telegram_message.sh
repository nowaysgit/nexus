#!/bin/bash

# Скрипт для отправки сообщения через Telegram-бота
# Использование: ./send_telegram_message.sh "Ваше сообщение"

# Проверяем, передан ли аргумент
if [ $# -ne 1 ]; then
    echo "Ошибка: Необходимо передать сообщение в качестве аргумента."
    echo "Пример: ./send_telegram_message.sh \"Привет, это тестовое сообщение\""
    exit 1
fi

# Токен вашего Telegram-бота (замените на свой)
BOT_TOKEN="7591587878:AAHn7vnsUajsXiGMoQup9RnZYmRWwQUv0kg"

# ID чата пользователя, которому отправляется сообщение (замените на свой)
CHAT_ID="1769589448"

# Сообщение, которое нужно отправить
MESSAGE="$1"

# Отправка сообщения через API Telegram
curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d text="$MESSAGE" \
    -d parse_mode="Markdown"

# Проверяем результат отправки
if [ $? -eq 0 ]; then
    echo "Сообщение успешно отправлено."
else
    echo "Ошибка при отправке сообщения."
fi 