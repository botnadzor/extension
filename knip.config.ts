import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "scripts/**/*.script.ts",
    "src/**/*.test.{ts,tsx}",
    "src/app.config.ts",
    "src/curated-static-lists/*.ts",
    "src/entrypoints/background.ts",
    "src/entrypoints/content.ts",
    "src/entrypoints/popup/app.tsx",
    "src/entrypoints/react-fiber-bridge-main-world.ts",
    "src/entrypoints/sidepanel/app.tsx",
    "src/shared/@ui-primitives/*.tsx", // shadcn components may contain unused exports
    "wxt.config.ts",
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    // https://github.com/webpro-nl/knip/issues/1140
    "@wxt-dev/auto-icons",
    "@wxt-dev/module-react",
  ],
  paths: {
    "#imports": [".wxt/types/imports-module.d.ts"],
  },
};

export default config;
