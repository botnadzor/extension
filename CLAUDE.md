# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Botnadzor is a browser extension for VK.com (VKontakte social network) that monitors user accounts and displays affiliation information (bot detection, spam detection, etc.). Built with WXT framework, React, TypeScript, and TailwindCSS. Supports desktop and mobile VK.com variants, including web.archive.org snapshots.

See [botnadzor.org/extension](https://botnadzor.org/extension) for more information.

## Development Commands

### Development

```bash
pnpm dev:chrome  # Start development mode for Chrome with hot reload
pnpm dev:firefox # Start development mode for Firefox with hot reload
```

The dev server automatically opens VK.com test pages (configured in `wxt.config.ts` → `webExt.startUrls`).

### Building

```bash
pnpm build         # Build for all browsers (Chrome + Firefox)
pnpm build:chrome  # Build for Chrome only
pnpm build:firefox # Build for Firefox only
```

### Packaging

```bash
pnpm zip         # Create distribution zip files for all browsers
pnpm zip:chrome  # Create zip for Chrome Web Store
pnpm zip:firefox # Create zip for Firefox Addons
```

### Code Quality

```bash
pnpm lint          # Run all linters (ESLint, Prettier, TypeScript, knip, pnpm dedupe, cspell)
pnpm lint:eslint   # Run ESLint only
pnpm lint:tsc      # Run TypeScript type checking only
pnpm lint:prettier # Check code formatting
pnpm lint:knip     # Check for unused exports/dependencies
pnpm lint:cspell   # Check spelling

pnpm fix          # Auto-fix all issues (ESLint, Prettier, knip, pnpm dedupe)
pnpm fix:eslint   # Auto-fix ESLint issues
pnpm fix:prettier # Auto-format code with Prettier
```

### Testing

```bash
pnpm test:unit   # Unit tests (not yet configured)
pnpm test:system # System tests (not yet configured)
```

### Preparation

```bash
pnpm prepare # Initialize Husky git hooks and run WXT prepare
```

Note: `wxt prepare` must be run before `lint:tsc` or `lint:eslint` as it generates `.wxt/tsconfig.json` with auto-imports.

## Architecture

### WXT Framework

This extension uses **WXT** (Web Extension Tools), a modern framework for building cross-browser extensions. Key concepts:

- **Entry points** in `src/entrypoints/` define extension components (background, content scripts, popup)
- WXT automatically generates manifest files for Chrome and Firefox
- WXT provides utilities like `createShadowRootUi` for isolated React rendering
- Configuration in `wxt.config.ts`

### Core Components

1. **Background Script** (`src/entrypoints/background.ts`)
   - Registers proxy services using `@webext-core/proxy-service`
   - Creates and configures AliasManager instances for URL rotation (dynamicApi, frontend, staticApi)
   - Services include: AffiliationService, CommentCollectingService, FrontendService, InspectorService, NotificationService, PopupService, RegDateService, StaticListsService, UserService
   - Fetches root config from remote system and populates static lists
   - Handles online/offline events to reset alias statuses

2. **Content Script** (`src/entrypoints/content.ts`)
   - Main orchestrator that runs on VK.com pages
   - Derives page information (mobile/desktop, archived snapshot)
   - Manages insertion lifecycle via `insertion-management.ts`
   - Starts in-page React notification app
   - Uses manual CSS injection mode

3. **Popup** (`src/entrypoints/popup/`)
   - Extension popup UI built with React
   - Entry point: `main.tsx`, app component: `app.tsx`

4. **In-Page App** (`src/entrypoints/content/in-page-app/`)
   - React components rendered in shadow DOM for notifications
   - Isolated from page styles using shadow DOM boundary
   - Has its own Tailwind CSS injection

### Insertion System (Core Pattern)

The **insertion system** is the primary architecture for DOM modifications. Each insertion is a modular, declarative unit that:

- Targets specific elements via CSS selector (`elementSelector`)
- Declares which website variant it applies to (`appliesTo`: "desktopVkWebsite" | "mobileVkWebsite")
- Optionally restricts to archived snapshots only (`appliesToArchivedSnapshotsOnly`)
- Implements an `init()` function that receives `{ contentId, element, logger, archivedSnapshot }`
- Returns a cleanup function for teardown

**Example insertion structure:**

```typescript
export default {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".ProfileHeader",
  init: ({ contentId, element, logger, archivedSnapshot }) => {
    // Modify DOM
    const badge = createBadge();
    element.appendChild(badge);

    // Return cleanup function
    return () => badge.remove();
  },
} satisfies Insertion;
```

**Insertion Management:**

- All insertions are registered in `src/entrypoints/content/insertions.ts` → `insertionLookup`
- `insertion-management.ts` uses MutationObserver to detect new elements
- Each insertion instance is tagged with `data-bn-insertion-instance-id`
- Automatic cleanup on page unload

**Adding New Insertions:**

1. Create file in `src/entrypoints/content/insertions/` (e.g., `desktop-new-feature.ts`)
2. Export default object satisfying `Insertion` type
3. Add to `insertionLookup` in `insertions.ts`

### Proxy Service Pattern

Background-content script communication uses `@webext-core/proxy-service`:

**Background script** (registers services):

```typescript
import { registerService } from "@webext-core/proxy-service";
import { affiliationServiceKey } from "@/lib/proxy-service-keys";
import { AffiliationService } from "@/services/affiliation-service";

const affiliationService = new AffiliationService({ staticListsService });
registerService(affiliationServiceKey, affiliationService);
```

**Content script** (calls services):

```typescript
import { affiliationService } from "@/lib/proxy-services";
const result = await affiliationService.checkAffiliation(vkDomain);
```

Services are defined in `src/services/` and use this pattern for clean separation between background logic and content script UI. The proxy service keys are centralized in `src/lib/proxy-service-keys.ts`, and proxy service instances for content scripts are created in `src/lib/proxy-services.ts`.

### AliasManager Pattern

The extension uses an **AliasManager** system (in `src/entrypoints/background/alias-manager.ts`) for URL rotation and failover across multiple endpoints:

- Three separate alias managers: `dynamicApi`, `frontend`, `staticApi`
- Each manages a set of URL aliases with availability tracking
- Automatically rotates to backup URLs if primary fails
- Tracks alias status: `unknown`, `available`, or `unavailable`
- Resets statuses on online/offline events
- Configuration is dynamically updated from remote `root-config.json`

### Directory Structure

```
src/
├── entrypoints/              # WXT entry points
│   ├── background.ts         # Service worker (registers proxy services)
│   ├── background/           # Background script modules (AliasManager, etc.)
│   ├── content.ts            # Content script orchestrator
│   ├── popup/                # Extension popup (React)
│   └── content/
│       ├── insertions/       # Modular DOM modifications
│       │   ├── shared/       # Shared UI helpers (badges, buttons, icons)
│       │   ├── desktop-*.ts  # Desktop-specific insertions
│       │   └── mobile-*.ts   # Mobile-specific insertions
│       ├── in-page-app/      # React notification app (shadow DOM)
│       ├── insertion-management.ts  # Insertion lifecycle manager
│       ├── insertion-basics.ts      # Type definitions
│       ├── insertions.ts            # Insertion registry
│       ├── derived-page-info.ts     # Page variant detection
│       └── hosts.ts                 # Supported VK hosts
├── services/                 # Proxy services (background)
├── lib/                      # Utilities (logging, utils, urls)
├── hooks/                    # React hooks and service hooks
├── components/ui/            # Shadcn UI components
└── assets/                   # Fonts, CSS files
```

### Tech Stack

- **TypeScript 5.9.3** - Strict mode with `@tsconfig/strictest`
- **React 19.2.3** - UI framework
- **WXT 0.20.13** - Browser extension framework
- **TailwindCSS 4.1.18** - Utility-first CSS with `bn:` prefix for isolation
- **@webext-core/proxy-service 2.0.0** - Background-content communication
- **@webext-core/job-scheduler 1.0.0** - Scheduled jobs in background script
- **@logtape/logtape 1.3.5** - Structured logging
- **lucide-react / lucide-static 0.562.0** - Icon library
- **Shadcn UI** - Component library (button, checkbox, dialog, tabs, etc.)
- **Dexie 4.2.1** - IndexedDB wrapper for local storage
- **chart.js 4.5.1** - Charting library
- **immer 11.1.3** - Immutable state updates
- **es-toolkit 1.43.0** - Utility functions
- **zod 4.3.5** - Schema validation (use `zod/mini` import for smaller bundle size)

### Important Conventions

1. **Tailwind Class Prefix**: All Tailwind classes MUST use `bn:` prefix for style isolation in content scripts

   ```tsx
   <div className="bn:ml-1 bn:flex bn:items-center">
   ```

   Note: The popup and other isolated React apps use unprefixed Tailwind classes.

2. **CSS Injection**:
   - Manual CSS injection mode is used for content scripts
   - Two separate Tailwind configurations:
     - `src/assets/tailwindcss-for-isolated-ui.css` - For popup and shadow DOM React components (unprefixed)
     - `src/entrypoints/content/tailwindcss-for-content.css` - For content script insertions (`bn:` prefix)

3. **Logging**: Use hierarchical logger categories

   ```typescript
   import { getContentLogger } from "@/lib/logging";
   const logger = getContentLogger(["insertion-name"]);
   logger.info("Message", { data });
   ```

4. **Icons**: Import SVG icons from `lucide-static` (not `lucide-react`) for content scripts

   ```typescript
   import { icons } from "@/entrypoints/content/insertions/shared/icons";
   element.innerHTML = icons.Info;
   ```

5. **Cleanup Pattern**: Insertions and DOM modifications should return cleanup functions

6. **Element Tagging**: Insertion instances are tracked with `data-bn-insertion-instance-id` attribute

7. **Frontend URLs**: Use `frontendService.getBaseUrl()` for API calls (supports rotation via AliasManager)

8. **Class Utilities**: Use `cn()` for combining class names with `tailwind-merge`, or `cnl()` for template literal strings

   ```typescript
   import { cn, cnl } from "@/lib/utils";

   // For arrays/arguments
   const classes = cn("bn:flex", condition && "bn:hidden", className);

   // For template literals
   const classes = cnl`bn:flex ${condition && "bn:hidden"} ${className}`;
   ```

9. **Type Definitions**: Prefer `type` over `interface` (enforced by ESLint `@typescript-eslint/consistent-type-definitions`)

10. **Type Assertions**: Avoid `as` assertions (enforced by `@typescript-eslint/consistent-type-assertions: never`)

11. **Error Handling**: Avoid unhandled `throw` statements outside `try/catch` blocks. Prefer returning `{ success: false, ...errorDetails }` for type-safe error handling

12. **Zod Imports**: Always import from `zod/mini` instead of `zod` to reduce bundle size

### Configuration Files

- `wxt.config.ts` - WXT configuration, manifest customization, dev start URLs, Vite plugins
- `tsconfig.json` - TypeScript strict configuration extending `@tsconfig/strictest`, `@tsconfig/node24`, `@tsconfig/node-ts`
- `eslint.config.ts` - ESLint flat config with numerous plugins (React, unicorn, a11y, better-tailwindcss, etc.)
- `.husky/` - Git hooks (runs `lint-staged` on pre-commit)
- `package.json` - Scripts use `npm-run-all2` for parallel execution

### Supported VK.com Variants

The extension matches these hosts (defined in `src/entrypoints/content/hosts.ts`):

- `vk.com`, `m.vk.com` (main sites)
- `vk.ru`, `m.vk.ru` (alternate domain)
- `vkvideo.ru`, `m.vkvideo.ru` (video platform)
- `web.archive.org/web/*/https://vk.com/*` (archived snapshots)

Page variants detected: `desktopVkWebsite`, `mobileVkWebsite`, `archivedSnapshot`

### Common Development Patterns

**Creating a new insertion:**

1. Determine target element selector and website variant (desktop/mobile)
2. Create file in `src/entrypoints/content/insertions/[variant]-[feature].ts`
3. Import and use shared UI helpers from `insertions/shared/` (badges, buttons, icons)
4. Return cleanup function to remove DOM modifications
5. Register in `insertions.ts` → `insertionLookup`

**Adding a new proxy service:**

1. Create service class in `src/services/[name]-service.ts`
2. Add service key to `src/lib/proxy-service-keys.ts`
3. Create proxy in `src/lib/proxy-services.ts` using `createProxyService()`
4. Register in `background.ts` using `registerService()`
5. Import and use in content script via the proxy from `@/lib/proxy-services`

**Styling components:**

- For content script insertions: Always use `bn:` prefix with Tailwind classes
- For React components in popup/shadow DOM: Use unprefixed Tailwind classes
- Use `cn()` or `cnl()` helpers from `@/lib/utils` for conditional classes
- For shadow DOM components, styles are isolated automatically

**Debugging:**

- Check browser console for LogTape structured logs
- Use logger categories to filter: `botnadzor > content > [insertion-name]`
- In dev mode, manifest name shows "Ботнадзор (local dev)"
- Dev server runs on port 3100 (to avoid conflicts with typical port 3000 dev servers)
