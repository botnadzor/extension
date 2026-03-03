# Botnadzor extension development guide

Browser extension for vk.com (bot/spam detection).
Built with WXT, React, TypeScript, TailwindCSS.

## Key architecture

- **Insertion system**: Config-driven DOM modifications.
  Variants registered in `insertion-variants.ts`.
- **Proxy services**: Background↔content script communication via `@webext-core/proxy-service`.
  See `src/entrypoints/background/@services/`.
- **File structure**: Recursive tree approach — see `file-structuring` skill.

## Conventions

1.  **React Compiler** handles memoization — do NOT use `useMemo`, `useCallback`, or `React.memo`.
1.  **Tailwind `bn:` prefix**: Required in `src/entrypoints/content/insertion-variants/**`.
    Popup/isolated UIs use unprefixed classes.
1.  **Icons in insertions**: Import from `lucide-static`, not `lucide-react`.
1.  **Class utilities**: `cn()` and `cnt()` from `@/shared/tailwindcss-helpers`.
1.  **Formatting**: Use helpers from `@/shared/formatting` (ICU messages, `formatInt`, `formatDate`, `formatDateTime`).
1.  **Logging**: Hierarchical categories via `@/shared/logging`.
1.  **Error handling**: Prefer `{ success: false, ...errorDetails }` over unhandled `throw`.
1.  **Zod**: Import from `zod/mini`, use `z.exactOptional()` not `z.optional()`.
