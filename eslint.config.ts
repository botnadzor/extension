import eslintJs from "@eslint/js";
import eslintPluginEslintCommentsConfigs from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslintReactEslintPlugin from "@eslint-react/eslint-plugin";
import eslintPluginStylistic from "@stylistic/eslint-plugin";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultCallees } from "eslint-plugin-better-tailwindcss/api/defaults";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginJsxA11y from "eslint-plugin-jsx-a11y";
// @ts-expect-error -- https://github.com/mozilla/eslint-plugin-no-unsanitized/issues/133
import eslintPluginNoUnsanitized from "eslint-plugin-no-unsanitized";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";
import eslintPluginRegexp from "eslint-plugin-regexp";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import typescriptEslint from "typescript-eslint";

const ruleArgsForNoRestrictedImports = [
  "warn",
  {
    paths: ["zod", "zod/v3", "zod/v4"].map((name) => ({
      name,
      message:
        "Please import from 'zod/mini' instead which helps reduce bundle size.",
    })),
    patterns: [],
  },
] as const;

const ruleArgsForNoRestrictedSyntax = [
  "warn",
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='optional']",
    message:
      "Use `z.exactOptional` instead to avoid setting `{ someKey: undefined }` (the key is lost when serialized to JSON and Object.keys can work unreliably).",
  },
] satisfies Linter.RuleSeverityAndOptions<unknown[]>;

export default defineConfig(
  {
    ignores: [".wxt/", "dist/", "node_modules/"],
  },

  eslintJs.configs.recommended,
  {
    rules: {
      curly: "warn",
      eqeqeq: "error",
      "func-style": ["warn", "declaration", { allowTypeAnnotation: true }],
      "no-alert": "warn",
      "no-console": "warn",
      "no-debugger": "warn",
      "no-empty-pattern": "warn",
      "no-empty": "warn",
      "no-implicit-coercion": "error",
      "no-param-reassign": "error",
      "no-restricted-syntax": [
        ...ruleArgsForNoRestrictedSyntax,
        {
          selector:
            "ThrowStatement:not(TryStatement > BlockStatement ThrowStatement)",
          message:
            "Avoid throwing errors that are not handled locally. Avoid using `throw` or wrap it with `try/catch` within the same function. To report errors, use `{ success: false, ...errorDetails }` for type safety. This helps avoid 'happy path blindness'.",
        },
      ],
      "no-useless-rename": "warn",
      "object-shorthand": "warn",
      "prefer-const": "warn",
    },
  },

  eslintPluginEslintCommentsConfigs.recommended,
  {
    rules: {
      "@eslint-community/eslint-comments/no-unused-disable": "warn",
      "@eslint-community/eslint-comments/require-description": "warn",
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- https://github.com/mozilla/eslint-plugin-no-unsanitized/issues/133
  eslintPluginNoUnsanitized.configs.recommended,

  eslintReactEslintPlugin.configs["recommended-type-checked"],
  {
    rules: {
      "@eslint-react/no-missing-component-display-name": "warn",
      "@eslint-react/no-leaked-conditional-rendering": "error",
    },
  },

  {
    plugins: {
      "@stylistic": eslintPluginStylistic,
    },
    rules: {
      "@stylistic/quotes": [
        "warn",
        "double",
        { avoidEscape: true, ignoreStringLiterals: true },
      ],
      "@stylistic/spaced-comment": [
        "warn",
        "always",
        { markers: ["/"], block: { balanced: true } },
      ],
    },
  },

  ...typescriptEslint.configs.strictTypeChecked,
  ...typescriptEslint.configs.stylisticTypeChecked,
  {
    rules: {
      "@typescript-eslint/array-type": ["warn", { default: "array-simple" }],
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description", // autofixed with @typescript-eslint/prefer-ts-expect-error
          minimumDescriptionLength: 10,
        },
      ],
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase"],
        },
      ],
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-import-type-side-effects": "warn",
      "@typescript-eslint/no-restricted-imports": [
        ...ruleArgsForNoRestrictedImports,
      ],
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, caughtErrors: "all" },
      ],
      "@typescript-eslint/no-use-before-define": "warn",
      "@typescript-eslint/restrict-template-expressions": ["error", {}],
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
    },
  },

  {
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        callees: [...getDefaultCallees(), ["cnt", [{ match: "strings" }]]],
        detectComponentClasses: true,
        entryPoint: `${import.meta.dirname}/src/shared/isolated-ui-styling.css`,
      },
    },
    rules: {
      "better-tailwindcss/enforce-canonical-classes": "warn",
      "better-tailwindcss/enforce-consistent-class-order": "warn",
      "better-tailwindcss/enforce-consistent-important-position": "warn",
      "better-tailwindcss/enforce-consistent-line-wrapping": [
        "warn",
        { strictness: "loose" },
      ],
      "better-tailwindcss/enforce-shorthand-classes": "warn",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-deprecated-classes": "warn",
      "better-tailwindcss/no-duplicate-classes": "warn",
      "better-tailwindcss/no-restricted-classes": "error",
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "warn",
    },
  },

  eslintPluginImport.flatConfigs.recommended,
  eslintPluginImport.flatConfigs.typescript,
  {
    rules: {
      "import/namespace": "off", // Done by TypeScript, see also https://github.com/import-js/eslint-plugin-import/issues/3135
      "import/no-unresolved": "off", // Done by TypeScript, see also https://github.com/import-js/eslint-plugin-import/issues/3135

      "import/first": "warn",
      "import/newline-after-import": "warn",
      "import/no-default-export": "warn",
      "import/no-duplicates": ["warn", { "prefer-inline": true }],
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: false,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      "import/no-useless-path-segments": ["warn", { noUselessIndex: true }],
    },
  },

  eslintPluginJsxA11y.flatConfigs.strict,

  eslintPluginReact.configs.flat["recommended"] ?? {},
  eslintPluginReact.configs.flat["jsx-runtime"] ?? {},
  {
    rules: {
      "react/display-name": "off", // Done by @eslint-react/no-missing-component-display-name
      "react/jsx-key": "off", // Done by @eslint-react/no-missing-key
      "react/no-array-index-key": "off", // Done by @eslint-react/no-array-index-key
      "react/prop-types": "off", // Done by TypeScript

      "react/function-component-definition": "warn",
      "react/jsx-boolean-value": ["warn", "always"],
      "react/jsx-curly-brace-presence": "warn",
      "react/no-unknown-property": "warn",
      "react/self-closing-comp": "warn",
    },
    settings: { react: { version: "detect" } },
  },

  eslintPluginReactHooks.configs.flat.recommended,

  {
    ...eslintPluginReactRefresh.configs.vite,
    ignores: [
      "src/shared/@ui-primitives/**",
      "src/entrypoints/content/**", // Hot-reloading not supported by WXT
    ],
  },

  eslintPluginRegexp.configs.recommended,

  {
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },

  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      "unicorn/better-regex": "off", // https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1852
      "unicorn/import-style": [
        "warn",
        {
          styles: {
            react: { namespace: true },
          },
        },
      ],
      "unicorn/no-nested-ternary": "off", // Conflicts with Prettier
      "unicorn/prefer-global-this": "off",
      "unicorn/prefer-set-has": "off",
      "unicorn/prefer-top-level-await": "off", // https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2149
      "unicorn/prevent-abbreviations": "off",

      // Suppressed after upgrading eslint-plugin-unicorn from v64 to v74; needs review.
      "unicorn/consistent-boolean-name": "off",
      "unicorn/consistent-class-member-order": "off",
      "unicorn/consistent-compound-words": "off",
      "unicorn/consistent-conditional-object-spread": "off",
      "unicorn/max-nested-calls": "off",
      "unicorn/name-replacements": "off",
      "unicorn/no-array-from-fill": "off",
      "unicorn/no-break-in-nested-loop": "off",
      "unicorn/no-computed-property-existence-check": "off",
      "unicorn/no-declarations-before-early-exit": "off",
      "unicorn/no-global-object-property-assignment": "off",
      "unicorn/no-incorrect-template-string-interpolation": "off",
      "unicorn/no-non-function-verb-prefix": "off",
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/no-unreadable-for-of-expression": "off",
      "unicorn/no-unsafe-string-replacement": "off",
      "unicorn/no-useless-else": "off",
      "unicorn/no-useless-template-literals": "off",
      "unicorn/no-useless-undefined": "off",
      "unicorn/prefer-array-from-map": "off",
      "unicorn/prefer-await": "off",
      "unicorn/prefer-boolean-return": "off",
      "unicorn/prefer-continue": "off",
      "unicorn/prefer-direct-iteration": "off",
      "unicorn/prefer-early-return": "off",
      "unicorn/prefer-else-if": "off",
      "unicorn/prefer-hoisting-branch-code": "off",
      "unicorn/prefer-includes-over-repeated-comparisons": "off",
      "unicorn/prefer-iterator-to-array": "off",
      "unicorn/prefer-minimal-ternary": "off",
      "unicorn/prefer-number-coercion": "off",
      "unicorn/prefer-object-iterable-methods": "off",
      "unicorn/prefer-observer-apis": "off",
      "unicorn/prefer-promise-try": "off",
      "unicorn/prefer-promise-with-resolvers": "off",
      "unicorn/prefer-simple-condition-first": "off",
      "unicorn/prefer-split-limit": "off",
      "unicorn/prefer-type-literal-last": "off",
      "unicorn/prefer-unary-minus": "off",
      "unicorn/prefer-unicode-code-point-escapes": "off",
      "unicorn/prefer-while-loop-condition": "off",
      "unicorn/require-array-sort-compare": "off",
      "unicorn/single-line-block-comment-style": "off",
    },
  },

  {
    files: ["**/*.{js,tsx}"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["*.config.{js,ts}", "**/*.test.{ts,tsx}", "scripts/**"],
    rules: {
      "no-restricted-syntax": ruleArgsForNoRestrictedSyntax,

      "import/no-default-export": "off",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      "import/no-named-as-default-member": "off",
    },
  },

  {
    files: [
      "src/app.config.ts",
      "src/curated-static-lists/*.ts",
      "src/entrypoints/*.ts",
      "src/entrypoints/*.tsx",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },

  {
    files: ["src/curated-static-lists/*.ts"],
    rules: {
      "unicorn/prefer-string-raw": "off",
    },
  },

  {
    files: [
      "src/entrypoints/content/insertion-configs/**/*",
      "src/entrypoints/content/insertion-variants/*",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },

  {
    files: ["src/entrypoints/content/insertion-variants/**/*.ts"],
    settings: {
      "better-tailwindcss": {
        entryPoint: `${import.meta.dirname}/src/entrypoints/content/insertion-styling.css`,
      },
    },
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        ruleArgsForNoRestrictedImports[0],
        {
          paths: [...ruleArgsForNoRestrictedImports[1].paths],
          patterns: [
            ...ruleArgsForNoRestrictedImports[1].patterns,
            {
              group: ["**/proxy-services"],
              message:
                "When defining an insertion, use services only from getServiceData payload. Avoid importing proxy services directly.",
            },
          ],
        },
      ],
      "import/no-default-export": "off",
    },
  },

  {
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
