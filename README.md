# Botnadzor extension / Расширение Ботнадзор

_Botnadzor browser extension highlights bots on [vk.com](https://vk.com) and VK-related sites. Learn more at [botnadzor.org/extension](https://botnadzor.org/extension) (ru)._

_For the English version of this README, [see it on Google Translate](https://translate.google.com/translate?sl=ru&tl=en&u=https://github.com/botnadzor/extension/blob/main/README.md)._

---

[![Chrome installs](https://img.shields.io/chrome-web-store/users/loemeolcemafljepnnmgjcoibcbocoma?label=chrome%20users)](https://chromewebstore.google.com/detail/%D0%B1%D0%BE%D1%82%D0%BD%D0%B0%D0%B4%D0%B7%D0%BE%D1%80-botnadzororg/loemeolcemafljepnnmgjcoibcbocoma)
[![Firefox installs](https://img.shields.io/amo/users/botnadzor-org?label=firefox%20users)](https://addons.mozilla.org/ru/firefox/addon/botnadzor-org/)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/botnadzor/extension/ci.yaml?branch=main&label=CI)](https://github.com/botnadzor/extension/actions/workflows/ci.yaml)

Браузерное расширение Ботнадзор подсвечивает ботов на [vk.com](https://vk.com) и связанных сайтах.  
Подробнее о расширении: [botnadzor.org/extension](https://botnadzor.org/extension).

## Что делает расширение

- Подсвечивает ботов на сайтах VK: ([m.](https://m.vk.com))[vk.com](https://vk.com), ([m.](https://m.vk.ru))[vk.ru](https://vk.ru), ([m.](https://m.vkvideo.ru))[vkvideo.ru](https://vkvideo.ru), а также на веб-архиве: [web.archive.org](https://web.archive.org)
- Упрощает вставку [карточек ботов](https://botnadzor.org/docs/how-to-help#cards) в ответ на их комментарии
- Позволяет узнавать дату регистрации аккаунтов VK
- Позволяет изучать подозрительную активность аккаунтов с помощью встроенного инспектора
- Позволяет отправлять подозрительные аккаунты на проверку администраторам Ботнадзора

## Установка

- [Chrome Web Store](https://chromewebstore.google.com/detail/%D0%B1%D0%BE%D1%82%D0%BD%D0%B0%D0%B4%D0%B7%D0%BE%D1%80-botnadzororg/loemeolcemafljepnnmgjcoibcbocoma)
- [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/botnadzor-org/)
<!-- - [GitHub Releases](https://github.com/botnadzor/extension/releases) (ручная установка пре-релизов) -->

| ⚠️ Внимание                                                                                                                                                                                                              |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| В браузерных магазинах пока что опубликована версия 1.x. Этот репозиторий содержит версию 2.x, которая доделывается. Бета-версии 2.0.0 публикуются в [GitHub Releases](https://github.com/botnadzor/extension/releases). |

## Архитектура

Расширение построено на [WXT](https://wxt.dev) с использованием [React](https://react.dev), [TypeScript](https://www.typescriptlang.org) и [TailwindCSS](https://tailwindcss.com).
Интерфейсные компоненты основаны на [Shadcn UI](https://ui.shadcn.com) и [Radix UI](https://www.radix-ui.com).
Данные обрабатываются при помощи [Zod](https://zod.dev), [Dexie](https://dexie.org) и [ORPC](https://orpc.dev).
Иконки взяты из [Lucide](https://lucide.dev).

У расширения три точки входа:

- **Background** (service worker) — регистрирует сервисы, управляет данными и конфигурацией
- **Content script** — модифицирует DOM на страницах VK через систему вставок (_insertions_) — модульных DOM-модификаций с автоматической очисткой
- **Popup** — показывает меню расширения с настройками, объявлениями и статистикой

Связь _background_ с _content script_ и _popup_ реализована через библиотеку [`@webext-core/proxy-service`](https://www.npmjs.com/package/@webext-core/proxy-service).

Подробное описание архитектуры, паттернов и соглашений — в [AGENTS.md](AGENTS.md) (на английском).

## Разработка

### Требования

- [Node.js 24](https://nodejs.org/en/download) (точная версия указана в `.tool-versions`, но подойдёт любая версия ≥ 24.0)
- [pnpm 10](https://pnpm.io/installation) (точная версия указана в `package.json` → `packageManager`, но подойдёт любая версия ≥ 10.0)

### Установка зависимостей

```bash
pnpm install
```

### Запуск в режиме разработки

```bash
pnpm dev:chrome  ## Chrome с живой перезагрузкой изменений
pnpm dev:firefox ## Firefox с живой перезагрузкой изменений
```

Сервер разработки автоматически запускает чистую копию браузера и открывает тестовую страницу на сайте VK.

Файлы сборки доступны в директории `dist/`.
При желании их можно вручную добавить в свой основной браузер.

### Локальная сборка

```bash
pnpm build         ## Chrome + Firefox
pnpm build:chrome  ## только Chrome
pnpm build:firefox ## только Firefox
```

Файлы сборки доступны в директории `dist/`.
При желании их можно вручную добавить в свой основной браузер.

### Проверка кода

```bash
pnpm lint ## все проверки: ESLint, Prettier, TypeScript, knip, cspell, pnpm dedupe
pnpm fix  ## автоматическое исправление некоторых типов проблем
```

Отдельные проверки доступны как `pnpm lint:eslint`, `pnpm lint:tsc` и т.д. — полный список в `package.json`.

## CI/CD <sup>[_что это?_](https://ru.wikipedia.org/wiki/CI/CD)</sup>

CI запускается для пулл-реквестов и для новых коммитов в ветке `main`.
Используются [GitHub Actions](https://github.com/features/actions).
Проверки состоят из двух параллельных задач:

- _build_ (упаковка расширения для обоих браузеров)
- _lint and test_ (все проверки из `pnpm lint`)

Запуск `pnpm lint` локально перед push позволяет заранее поймать большинство проблем, а `pnpm fix` — автоматически исправить некоторые типы из них.

## Обратная связь и вклад

Если вы нашли ошибку или хотите предложить улучшение, создайте [issue](https://github.com/botnadzor/extension/issues) или дополните уже существующее.
Если вы хотите внести изменения в код или документацию, создайте [pull request](https://github.com/botnadzor/extension/pulls).

Подробнее о проекте Ботнадзор и о способах связи — на странице [botnadzor.org/docs](https://botnadzor.org/docs).
Если сайт недоступен, воспользуйтесь нашим телеграм-ботом [@botnadzor_org_bot](https://t.me/botnadzor_org_bot).

## Лицензия

[BSD-3-Clause](LICENSE.md)
