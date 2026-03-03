---
name: file-structuring
description: "Guides file and folder organization using recursive tree structure: self-similar directories, encapsulation, shared/ folders, mini-library pattern, definitions pattern (=*.ts files), and kebab-case naming. Use when creating, moving, or renaming files, extracting modules into subdirectories, deciding where shared code belongs, checking import boundaries, or adding definition variants to a lookup."
---

# File structuring

This project follows a **recursive tree** approach to file organization, where the structure of any part mirrors the whole.
This self-similar organization allows confident navigation without needing to understand the entire codebase.

## Core principles

- **Self-repeating structure**: Every directory follows the same organizational patterns, creating predictable navigation at any depth.

- **Organic growth**: Start with a single file; extract to subdirectories only when complexity demands it.
  No boilerplate structure upfront.

- **Encapsulation**: Resources in a subdirectory are private to the parent file unless explicitly re-exported.
  A `shapes/` directory is "owned" by `shapes.ts`.

- **Contextual sharing**: Common logic lives at the closest common ancestor.
  The `shared/` directory exists at the `src/` level because multiple entrypoints need it.

- **Present-state focus**: Structure reflects current reality, not anticipated future needs.
  Refactor freely as usage patterns evolve.

## Mini-library pattern

Each file acts as a self-contained "mini-library" with cohesive exports.
When a file outgrows its scope, extract helpers into a sibling subdirectory with the same name:

```text
my-app.ts → my-app.ts (keeps public API)
          → my-app/
              ├── config.ts
              ├── lifecycle.ts
              ├── lifecycle/
              │   ├── something.ts
              │   └── something-else.ts
              └── helpers.ts
```

Only `my-app.ts` imports from the `my-app/` directory, and only `lifecycle.ts` imports from the `lifecycle/` directory—each file owns its namespace.

## Scoped directories with `@` prefix

Directories prefixed with `@` group related utilities under a namespace, similar to npm scoped packages.
This prevents naming collisions and clearly signals "this is a utility namespace, not a feature."

## Import rules

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

## Definitions pattern (`=*.ts` / `=*.tsx` files)

The codebase uses a **definitions pattern** for organizing related definitions that are aggregated into a lookup object.
This pattern consists of:

1.  A **parent file** (e.g., `things.ts`) that imports and re-exports definitions from child files
1.  A **sibling directory** with the same name (e.g., `things/`) containing individual definition files prefixed with `=` (e.g., `=variant.ts` or `=variant.tsx`)

The `=` prefix serves multiple purposes:

- Visually distinguishes definition files from regular modules
- Groups them at the top of directory listings (sorts before letters)
- Makes the pattern easily searchable across the codebase

### Example

```text
src/
├── shapes.ts                    ## Parent: imports and aggregates all definitions
└── shapes/
    ├── =circle.ts               ## Individual definition variant
    ├── =square.ts
    ├── =triangle.ts
    ├── helpers.ts               ## Shared helpers (no = prefix)
    └── types.ts                 ## Shared types (no = prefix)
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

### Adding a new definition

1.  Create `=new-variant.ts` (or `=new-variant.tsx`) in the appropriate directory
1.  Export the definition following the established type
1.  Import and add to the lookup object in the parent file
