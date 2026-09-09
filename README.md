# Расширение Ботнадзор<br><em>Botnadzor extension</em>

_Botnadzor browser extension highlights bots on [vk.ru](https://vk.ru) and VK-related sites.  
Learn more at [botnadzor.org/extension](https://botnadzor.org/extension) (ru)._

_For the English version of this README, [see it on Google Translate](https://translate.google.com/translate?sl=ru&tl=en&u=https://github.com/botnadzor/extension/blob/main/README.md)._

---

[![Chrome installs](https://img.shields.io/chrome-web-store/users/loemeolcemafljepnnmgjcoibcbocoma?label=chrome%20users)](https://chromewebstore.google.com/detail/%D0%B1%D0%BE%D1%82%D0%BD%D0%B0%D0%B4%D0%B7%D0%BE%D1%80-botnadzororg/loemeolcemafljepnnmgjcoibcbocoma)
[![Firefox installs](https://img.shields.io/amo/users/botnadzor-org?label=firefox%20users)](https://addons.mozilla.org/ru/firefox/addon/botnadzor-org/)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/botnadzor/extension/ci.yaml?branch=main&label=CI)](https://github.com/botnadzor/extension/actions/workflows/ci.yaml)

Браузерное расширение Ботнадзор подсвечивает ботов на [vk.ru](https://vk.ru) и связанных сайтах.  
Подробнее о расширении: [botnadzor.org/extension](https://botnadzor.org/extension).

## Что делает расширение

<img src="docs/assets/botnadzor-extension-insertions.png" alt="Подсветка ботов в VK и вставка карточек" width="600">

- Подсвечивает ботов на сайтах VK: [vk.ru](https://vk.ru), [vkvideo.ru](https://vkvideo.ru) и их мобильных версиях, а также в [веб-архиве](https://web.archive.org)
- Помогает вставлять [карточки ботов](https://botnadzor.org/docs/how-to-help#cards) в ответ на их комментарии
- Показывает дату регистрации аккаунтов VK
- Помогает изучать подозрительную активность с помощью встроенного инспектора
- Помогает отправлять подозрительные аккаунты на проверку администраторам Ботнадзора

## Установка из магазина браузера

Большинству пользователей подойдёт стабильная версия из магазина браузера.

### Браузеры на&nbsp;базе&nbsp;Chromium

Инструкция подходит для **Chrome**, **Edge**, **Yandex**, **Opera**, **Brave**, **Lemur** и других браузеров, которые поддерживают расширения из Chrome Web Store.

1.  Перейдите на [страницу расширения в каталоге Chrome](https://chromewebstore.google.com/detail/%D0%91%D0%BE%D1%82%D0%BD%D0%B0%D0%B4%D0%B7%D0%BE%D1%80%20%28botnadzor.org%29/loemeolcemafljepnnmgjcoibcbocoma)

1.  Нажмите кнопку _«Добавить»_. Её название может немного отличаться в вашем браузере.

### Firefox

Расширение можно установить и в **Tor Browser**, но [Tor Project предупреждает](https://support.torproject.org/tor-browser/features/plugins/), что сторонние расширения могут снизить анонимность.

1.  Перейдите на [страницу расширения в каталоге Firefox](https://addons.mozilla.org/ru/firefox/addon/botnadzor-org/)

1.  Нажмите кнопку _«Добавить в Firefox»_

### После установки

Откройте VK-паблик, где часто встречаются боты, например [ria](https://vk.ru/ria), [rt_russian](https://vk.ru/rt_russian), [vesti](https://vk.ru/vesti) или [mash](https://vk.ru/mash). Расширение подсветит ботов в комментариях и профилях VK.

Вы можете [поддержать проект](https://botnadzor.org/docs/how-to-help) донатом, оставлять [карточки ботов в VK](https://botnadzor.org/docs/how-to-help#cards) и подписаться на наши соцсети: [Telegram](https://t.me/botnadzor_org) и [VK](https://vk.ru/botnadzor).

## Установка из GitHub Releases

Этот способ подходит тем, кто хочет тестировать экспериментальные версии и помогать искать ошибки.

1.  Откройте [страницу релизов](https://github.com/botnadzor/extension/releases) и выберите нужную версию — обычно самую свежую.

    В блоке `Assets` релиза найдите архив для вашего браузера и скачайте его:  
    `botnadzor-for-BROWSER-VERSION.zip`

    ℹ️ Архив `chrome` предназначен для браузеров на базе Chromium.

    ⚠️ Если в релизе есть файл `botnadzor-sources-VERSION.zip`, он _не нужен_ для установки. Это архив с исходным кодом для публикации расширения в магазине.

1.  Установите скачанный архив:

    **Браузеры на базе Chromium**
    1.  Распакуйте скачанный архив.
    1.  Откройте `chrome://extensions`.
    1.  Включите **Режим разработчика** (переключатель обычно находится в правом верхнем углу).
    1.  Если у вас уже установлено наше расширение из магазина, _не удаляйте его_, а временно отключите.
    1.  Нажмите **«Загрузить распакованное расширение»** (Load unpacked) и выберите распакованную папку.

    **Firefox**
    1.  Если у вас уже установлено наше расширение из магазина, _не удаляйте его_, а временно отключите на странице `about:addons`.
    1.  Откройте `about:debugging#/runtime/this-firefox`.
    1.  Нажмите **«Загрузить временное дополнение»** (Load Temporary Add-on).
    1.  Выберите скачанный zip-файл.

    ⚠️ В Firefox расширение установится как _временное_ и будет удалено при следующем перезапуске браузера.

1.  После установки откройте попап Ботнадзора (иконка расширения) и проверьте версию.
    Она должна совпадать с релизом, который вы скачали (например, `2.0.0-beta.1`).

1.  Чтобы вернуться на стабильную версию, удалите или отключите экспериментальную и снова включите расширение из магазина.

## Архитектура

Расширение построено на [WXT](https://wxt.dev), [React](https://react.dev), [TypeScript](https://www.typescriptlang.org) и [TailwindCSS](https://tailwindcss.com).
Интерфейсные компоненты основаны на [Shadcn UI](https://ui.shadcn.com) и [Base UI](https://base-ui.com).
Для обработки данных используются [Zod](https://zod.dev), [Dexie](https://dexie.org) и [ORPC](https://orpc.dev).
Иконки взяты из [Lucide](https://lucide.dev).

У расширения три основных точки входа:

- **Background** (service worker) — регистрирует сервисы, управляет данными и конфигурацией
- **Content script** — модифицирует DOM на страницах VK через систему вставок (_insertions_) — модульных DOM-модификаций с автоматической очисткой
- **Popup** — показывает меню расширения с настройками, объявлениями и статистикой

_Background_, _content script_ и _popup_ взаимодействуют через библиотеку [`@webext-core/proxy-service`](https://www.npmjs.com/package/@webext-core/proxy-service).

Подробное описание архитектуры, паттернов и соглашений — в [AGENTS.md](AGENTS.md) (на английском).

## Разработка

### Требования

- [Node.js](https://nodejs.org/en/download) 24 (точная версия указана в `.tool-versions`)
- [pnpm](https://pnpm.io/installation) 10–12 (при запуске pnpm автоматически выбирает версию из поля `packageManager` файла `package.json`)

### Установка зависимостей

```bash
pnpm install
```

### Запуск в режиме разработки

```bash
pnpm dev:chrome  # Chrome с живой перезагрузкой изменений
pnpm dev:firefox # Firefox с живой перезагрузкой изменений
```

Сервер разработки автоматически запускает отдельный профиль браузера и открывает тестовую страницу VK.

### Локальная сборка

```bash
pnpm build         # Chrome + Firefox
pnpm build:chrome  # только Chrome
pnpm build:firefox # только Firefox
```

Файлы появятся в директории `dist/`. Их можно установить как временное расширение в основной браузер.

### Линтинг (статические проверки кода)

```bash
pnpm lint # все проверки: ESLint, Prettier, TypeScript, knip, cspell, pnpm dedupe
pnpm fix  # автоматическое исправление некоторых типов проблем
```

Отдельные проверки доступны как `pnpm lint:eslint`, `pnpm lint:tsc` и т.д. — полный список в `package.json`.

### Юнит-тесты

```bash
pnpm test:unit         # прогон всех юнит-тестов один раз
pnpm test:unit --watch # запуск юнит-тестов в режиме наблюдения
```

## CI/CD <sup>[_что это?_](https://ru.wikipedia.org/wiki/CI/CD)</sup>

CI запускается для пулл-реквестов, новых коммитов в ветке `main` и тегов.
Используются [GitHub Actions](https://github.com/features/actions).
Проверки состоят из двух параллельных задач:

- _build_ (сборка расширения)
- _lint and test_ (прогон всех линтеров и юнит-тестов)

Локальный запуск линтеров и юнит-тестов помогает найти проблемы до CI.

## Обратная связь и вклад

Нашли ошибку или хотите предложить улучшение? Создайте [issue](https://github.com/botnadzor/extension/issues) или дополните уже существующее.
Чтобы внести изменения в код или документацию, создайте [pull request](https://github.com/botnadzor/extension/pulls).

Подробнее о проекте Ботнадзор и о способах связи — на странице [botnadzor.org/docs](https://botnadzor.org/docs).
Если сайт недоступен, воспользуйтесь нашим телеграм-ботом [@botnadzor_org_bot](https://t.me/botnadzor_org_bot), чтобы получить ссылку на зеркало.

## Лицензия

[BSD-3-Clause](LICENSE.md)
