# Аалам Хаус

Лендинг агентства аренды недвижимости на Иссык-Куле и по Кыргызстану. Pet-проект, все контакты и объекты — моки.

**Стек:** Next.js 16 (App Router), React 19, TypeScript, чистый CSS. Деплой — Vercel.

## Запуск

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Где что лежит

- `lib/content.ts` — все тексты, контакты, услуги, объекты, FAQ (моки)
- `app/page.tsx` — разметка лендинга
- `app/globals.css` — стили и цветовые токены
- `app/api/lead/route.ts` — приём заявок с формы
- `design/` — исходный макет из Claude Design (для справки)

## Заявки в Telegram (необязательно)

Задайте в Vercel → Settings → Environment Variables `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`.
Без них заявки пишутся в логи функции (Vercel → Logs).
