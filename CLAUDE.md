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
pnpm lint:cspell   # Check spelling
pnpm lint:eslint   # Run ESLint only
pnpm lint:knip     # Check for unused exports/dependencies
pnpm lint:prettier # Check code formatting
pnpm lint:tsc      # Run TypeScript type checking only

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

Note: `wxt prepare` is included in relevant scripts and does not need to be run manually. It generates `.wxt/tsconfig.json` with auto-imports.

## Architecture

### WXT Framework

This extension uses **WXT** (Web Extension Tools), a modern framework for building cross-browser extensions. Key concepts:

- **Entry points** in `src/entrypoints/` define extension components (background, content scripts, popup)
- WXT automatically generates manifest files for Chrome and Firefox
- WXT provides utilities like `createShadowRootUi` for isolated React rendering
- Configuration in `wxt.config.ts`

### Core Components

1.  **Background Script** (`src/entrypoints/background.ts`)
    - Registers proxy services using `@webext-core/proxy-service`
    - Creates and configures AliasManager instances for URL rotation (dynamicApi, frontend, staticApi)
    - Services include: AffiliationService, AuthService, CommentCollectingService, FrontendService, InspectorService, NotificationService, PopupService, RegDateService, StaticListsService, UserConfigService
    - Fetches root config from remote system and populates static lists
    - Handles online/offline events to reset alias statuses
    - Persists data on `onSuspend` event (e.g., registered comments)

1.  **Content Script** (`src/entrypoints/content.ts`)
    - Main orchestrator that runs on VK.com pages
    - Derives page information (mobile/desktop, archived snapshot)
    - Manages insertion lifecycle via `insertion-management.ts`
    - Starts in-page React notification app
    - Uses manual CSS injection mode

1.  **Popup** (`src/entrypoints/popup/`)
    - Extension popup UI built with React
    - Entry point: `main.tsx`, app component: `app.tsx`

1.  **In-Page App** (`src/entrypoints/content/in-page-app/`)
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
import { defineInsertion } from "../insertion-basics";

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".ProfileHeader",
  init: ({ contentId, element, logger, archivedSnapshot }) => {
    // Modify DOM
    const badge = createBadge();
    element.appendChild(badge);

    // Return cleanup function
    return () => badge.remove();
  },
});
```

**Insertion Management:**

- All insertions are registered in `src/entrypoints/content/insertions.ts` → `insertionLookup`
- `insertion-management.ts` uses MutationObserver to detect new elements
- Each insertion instance is tagged with `data-bn-insertion-instance-id`
- Automatic cleanup on page unload

**Adding New Insertions:**

1.  Create file in `src/entrypoints/content/insertions/` (e.g., `desktop-new-feature.ts`)
1.  Export default object satisfying `Insertion` type
1.  Add to `insertionLookup` in `insertions.ts`

### Proxy Service Pattern

Background-content script communication uses `@webext-core/proxy-service`:

**Background script** (registers services):

```typescript
import { registerService } from "@webext-core/proxy-service";
import { affiliationServiceKey } from "@/shared/proxy-service-keys";
import { AffiliationService } from "@/entrypoints/background/@services/affiliation-service";

const affiliationService = new AffiliationService({ staticListsService });
registerService(affiliationServiceKey, affiliationService);
```

**Content script** (calls services):

```typescript
import { affiliationService } from "@/shared/proxy-services";
const result = await affiliationService.checkAffiliation(vkDomain);
```

Services are defined in `src/entrypoints/background/@services/` and use this pattern for clean separation between background logic and content script UI. The proxy service keys are centralized in `src/shared/proxy-service-keys.ts`, and proxy service instances for content scripts are created in `src/shared/proxy-services.ts`.

### AliasManager Pattern

The extension uses an **AliasManager** system (in `src/entrypoints/background/@service-helpers/alias-manager.ts`) for URL rotation and failover across multiple endpoints:

- Three separate alias managers: `dynamicApi`, `frontend`, `staticApi`
- Each manages a set of URL aliases with availability tracking
- Automatically rotates to backup URLs if primary fails
- Tracks alias status: `unknown`, `available`, or `unavailable`
- Resets statuses on online/offline events
- Configuration is dynamically updated from remote `root-config.json`

**Other service helpers** in `@service-helpers/`:

- `fetch-from-remote-system.ts` - Fetch wrapper with alias rotation
- `store-with-schema.ts` - Type-safe storage abstraction
- `vk-domain-resolver.ts` - Resolves VK domains to user IDs
- `dynamic-api-endpoints.ts` - Dynamic API endpoint definitions

### Fractal Tree File Structure

This project follows a **fractal tree** approach to file organization, where the structure of any part mirrors the whole. This self-similar organization allows confident navigation without needing to understand the entire codebase.

#### Core Principles

- **Recursive structure**: Every directory follows the same organizational patterns, creating predictable navigation at any depth.

- **Organic growth**: Start with a single file; extract to subdirectories only when complexity demands it. No boilerplate structure upfront.

- **Encapsulation**: Resources in a subdirectory are private to the parent file unless explicitly re-exported. A `shapes/` directory is "owned" by `shapes.ts`.

- **Contextual sharing**: Common logic lives at the closest common ancestor. The `shared/` directory exists at the `src/` level because multiple entrypoints need it.

- **Present-state focus**: Structure reflects current reality, not anticipated future needs. Refactor freely as usage patterns evolve.

#### Mini-Library Pattern

Each file acts as a self-contained "mini-library" with cohesive exports. When a file outgrows its scope, extract helpers into a sibling subdirectory with the same name:

```text
my-app.ts          → my-app.ts (keeps public API)
                   → my-app/
                       ├── config.ts
                       ├── lifecycle.ts
                       ├── lifecycle/
                       │   ├── something.ts
                       │   └── something-else.ts
                       └── helpers.ts
```

Only `my-app.ts` imports from the `my-app/` directory, and only `lifecycle.ts` imports from the `lifecycle/` directory—each file owns its namespace.

#### Scoped Directories with `@` Prefix

Directories prefixed with `@` group related utilities under a namespace, similar to npm scoped packages:

```text
src/shared/
├── @model/           # Type definitions and schemas (affiliation, auth, config, etc.)
├── @pollable/        # Polling/observation pattern (core + React hook)
├── @ui-helpers/      # React hooks (data-hooks, use-animate)
└── @ui-primitives/   # Shadcn/Radix components (accordion, button, checkbox, dialog, label, scroll-area, select, tabs, textarea, tooltip)
```

This prevents naming collisions and clearly signals "this is a utility namespace, not a feature."

#### Import Rules

As a consequence of encapsulation, imports should only target "public" resources:

```typescript
// ✓ Correct: import from the mini-library entry point
import { something } from "@/shared/foo";
import { other } from "@/shared/@scope/bar";

// ✗ Incorrect: import from internal files (owned by their parent)
import { internal } from "@/shared/foo/helpers";
import { deep } from "@/shared/@scope/bar/internal";

// ✗ Incorrect: import from a scope directly (like npm, scopes aren't packages)
import { wrong } from "@/shared/@scope";
```

### Directory Structure

```text
src/
├── entrypoints/              # WXT entry points
│   ├── background.ts         # Service worker (registers proxy services)
│   ├── background/
│   │   ├── @services/        # Proxy service implementations
│   │   └── @service-helpers/ # AliasManager, fetch helpers, etc.
│   ├── content.ts            # Content script orchestrator
│   ├── popup/                # Extension popup (React)
│   └── content/
│       ├── insertions/       # Modular DOM modifications
│       │   ├── shared/       # Shared UI helpers (badges, buttons, icons)
│       │   ├── desktop-*.ts  # Desktop-specific insertions
│       │   └── mobile-*.ts   # Mobile-specific insertions
│       ├── in-page-app/      # React notification app (shadow DOM)
│       ├── insertion-management.ts  # Insertion lifecycle manager
│       ├── insertion-basics.ts      # Type definitions and defineInsertion()
│       ├── insertions.ts            # Insertion registry
│       ├── derived-page-info.ts     # Page variant detection
│       └── hosts.ts                 # Supported VK hosts
├── shared/                   # Shared utilities
    ├── @model/               # Type definitions and schemas
    ├── proxy-service-keys.ts # Service keys for @webext-core/proxy-service
    ├── proxy-services.ts     # Proxy service instances for content scripts
    ├── logging.ts            # LogTape configuration
    ├── tailwindcss-helpers.ts # cn() and cnl() utilities
    └── ...
```

### Tech Stack

**Core:**

- **TypeScript 5.9.3** - Strict mode with `@tsconfig/strictest`
- **React 19.2.3** - UI framework with React Compiler
- **React Compiler** (`babel-plugin-react-compiler` 1.0.0) - Automatic memoization, configured in `wxt.config.ts`
- **WXT 0.20.13** - Browser extension framework
- **TailwindCSS 4.1.18** - Utility-first CSS with `bn:` prefix for isolation

**Extension Infrastructure:**

- **@webext-core/proxy-service 2.0.0** - Background-content communication
- **@webext-core/job-scheduler 1.0.0** - Scheduled jobs in background script
- **@logtape/logtape 1.3.6** - Structured logging
- **Dexie 4.2.1** - IndexedDB wrapper for local storage

**UI Components:**

- **Shadcn UI + Radix UI** - Component library (accordion, checkbox, dialog, label, scroll-area, select, tabs, tooltip)
- **lucide-react / lucide-static 0.562.0** - Icon library
- **class-variance-authority 0.7.1** - Component variant styling
- **chart.js 4.5.1** - Charting library

**Utilities:**

- **zod 4.3.5** - Schema validation (use `zod/mini` import for smaller bundle size)
- **es-toolkit 1.43.0** - Utility functions
- **immer 11.1.3** - Immutable state updates
- **intl-messageformat 11.0.9** - ICU message formatting
- **lru-cache 11.2.4** - Least-recently-used caching
- **nanoid 5.1.6** - ID generation
- **semver 7.7.3** - Semantic version parsing
- **marked-react 3.0.2** - Markdown rendering

### Important Conventions

1.  **React Compiler**: The project uses React Compiler for automatic memoization. This means:
    - Do NOT manually add `useMemo`, `useCallback`, or `React.memo` for performance - the compiler handles this automatically
    - Write straightforward React code without manual memoization optimizations
    - The compiler will optimize re-renders and memoize values/callbacks as needed
    - Configuration is in `wxt.config.ts` under `react.vite.babel.plugins`

1.  **Tailwind Class Prefix in insertions**: All Tailwind classes inside `src/entrypoints/content/insertions/**` MUST use `bn:` prefix for style isolation in content scripts

    ```tsx
    <div className="bn:ml-1 bn:flex bn:items-center">
    ```

    Note: The popup and other isolated React apps use unprefixed Tailwind classes.

1.  **CSS Injection**:
    - Manual CSS injection mode is used for content scripts
    - Two separate Tailwind configurations:
      - `src/shared/isolated-ui-styling.css` - For popup and shadow DOM React components (unprefixed)
      - `src/entrypoints/content/insertion-styling.css` - For content script insertions (`bn:` prefix)

1.  **Logging**: Use hierarchical logger categories

    ```typescript
    import { getContentLogger } from "@/shared/logging";
    const logger = getContentLogger(["insertion-name"]);
    logger.info("Message", { data });
    ```

1.  **Icons**: Import SVG icons from `lucide-static` (not `lucide-react`) inside insertions

    ```typescript
    import { icons } from "..path/to/insertions/shared/icons";
    element.innerHTML = icons.Info;
    ```

1.  **Cleanup Pattern**: Insertions and DOM modifications should return cleanup functions

1.  **Element Tagging**: Insertion instances are tracked with `data-bn-insertion-instance-id` attribute

1.  **Frontend URLs**: Use `frontendService.getBaseUrl()` for API calls (supports rotation via AliasManager)

1.  **Class Utilities**: Use `cn()` for combining class names with `tailwind-merge`, or `cnl()` to get an array for `classList.add()`

    ```typescript
    import { cn, cnl } from "@/shared/tailwindcss-helpers";

    // cn() returns a merged class string
    const classes = cn("bn:flex", condition && "bn:hidden", className);

    // cnl() returns an array of class names for classList.add()
    element.classList.add(...cnl("bn:flex", condition && "bn:hidden"));
    ```

1.  **Formatting Utilities**: Use helpers from `@/shared/formatting` for locale-aware formatting

    ```typescript
    import {
      createMessage,
      formatInt,
      formatDate,
      formatTime,
    } from "@/shared/formatting";

    // ICU message format with Russian pluralization
    const message = createMessage(
      "{count, plural, one {# яблоко} few {# яблока} other {# яблок}}",
    );
    message.format({ count: 5 }); // "5 яблок"

    // Number formatting with Russian locale
    formatInt(1234567); // "1 234 567"

    // Date/time formatting
    formatDate("2000-01-31"); // "31.1.2000"
    formatTime("2000-01-31T06:42:00Z"); // "31.1.2000 9:42" (in UTC+3)
    ```

1.  **Type Definitions**: Prefer `type` over `interface` (enforced by ESLint `@typescript-eslint/consistent-type-definitions`)

1.  **Type Assertions**: Avoid `as` assertions (enforced by `@typescript-eslint/consistent-type-assertions: never`); add a comment explaining the type assertion if unavoidable

1.  **Error Handling**: Avoid unhandled `throw` statements outside `try/catch` blocks. Prefer returning `{ success: false, ...errorDetails }` for type-safe error handling

1.  **Zod Imports**: Always import from `zod/mini` instead of `zod` to reduce bundle size

1.  **Zod Optional Fields**: Use `z.exactOptional()` instead of `z.optional()` to avoid serialization issues with `{ someKey: undefined }` (enforced by ESLint)

### Definitions Pattern (`=*.ts` / `=*.tsx` files)

The codebase uses a **definitions pattern** for organizing related definitions that are aggregated into a lookup object. This pattern consists of:

1.  A **parent file** (e.g., `things.ts`) that imports and re-exports definitions from child files
1.  A **sibling directory** with the same name (e.g., `things/`) containing individual definition files prefixed with `=` (e.g., `=variant.ts` or `=variant.tsx`)

The `=` prefix serves multiple purposes:

- Visually distinguishes definition files from regular modules
- Groups them at the top of directory listings (sorts before letters)
- Makes the pattern easily searchable across the codebase

#### Example

```text
src/
├── shapes.ts                    # Parent: imports and aggregates all definitions
└── shapes/
    ├── =circle.ts               # Individual definition variant
    ├── =square.ts
    ├── =triangle.ts
    ├── helpers.ts               # Shared helpers (no = prefix)
    └── types.ts                 # Shared types (no = prefix)
```

Parent file (`shapes.ts`):

```typescript
import { circleDefinition } from "./shapes/=circle";
import { squareDefinition } from "./shapes/=square";
import { triangleDefinition } from "./shapes/=triangle";

export const shapeDefinitionLookup = {
  circle: circleDefinition,
  square: squareDefinition,
  triangle: triangleDefinition,
} satisfies Record<string, ShapeDefinition>;
```

Definition file (`=circle.ts`):

```typescript
export const circleDefinition: ShapeDefinition = {
  name: "circle",
  // ...
};
```

#### When to use this pattern

- When you have multiple related definitions that share a common type
- When definitions need to be aggregated into a lookup object
- When each definition is complex enough to warrant its own file

#### Real examples in this codebase

- `src/entrypoints/popup/app/tabs/` - Popup tab components (`=announcements.tsx`, `=config.tsx`, `=stats.tsx`, `=access.tsx`)
- `src/entrypoints/background/@service-helpers/dynamic-api-endpoints/` - API endpoint definitions

#### Adding a new definition

1.  Create `=new-variant.ts` (or `=new-variant.tsx`) in the appropriate directory
1.  Export the definition following the established type
1.  Import and add to the lookup object in the parent file

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

Archived snapshots (`web.archive.org`) are also supported via URL pattern matching in `wxt.config.ts`.

Page variants detected: `desktopVkWebsite`, `mobileVkWebsite`, `archivedSnapshot`

### Common Development Patterns

**Creating a new insertion:**

1.  Determine target element selector and website variant (desktop/mobile)
1.  Create file in `src/entrypoints/content/insertions/[variant]-[feature].ts`
1.  Import and use shared UI helpers from `insertions/shared/` (badges, buttons, icons)
1.  Return cleanup function to remove DOM modifications
1.  Register in `insertions.ts` → `insertionLookup`

**Adding a new proxy service:**

1.  Create service class in `src/entrypoints/background/@services/[name]-service.ts`
1.  Add service key to `src/shared/proxy-service-keys.ts`
1.  Create proxy in `src/shared/proxy-services.ts` using `createProxyService()`
1.  Register in `background.ts` using `registerService()`
1.  Import and use in content script via the proxy from `@/shared/proxy-services`

**Styling components:**

- For content script insertions: Always use `bn:` prefix with Tailwind classes
- For React components in popup/shadow DOM: Use unprefixed Tailwind classes
- Use `cn()` or `cnl()` helpers from `@/shared/tailwindcss-helpers` for conditional classes
- For shadow DOM components, styles are isolated automatically

**Debugging:**

- Check browser console for LogTape structured logs
- Use logger categories to filter: `botnadzor > content > [insertion-name]`
- In dev mode, manifest name shows "Ботнадзор (local dev)"
- Dev server runs on port 3100 (to avoid conflicts with typical port 3000 dev servers)
