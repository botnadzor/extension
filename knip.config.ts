import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "scripts/**/*.script.ts",
    "src/app.config.ts",
    "src/entrypoints/background.ts",
    "src/entrypoints/content.ts",
    "src/entrypoints/popup/app.tsx",
    "src/shared/@ui-primitives/*.tsx", // shadcn components may contain unused exports
    "wxt.config.ts",
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    // https://github.com/webpro-nl/knip/issues/1140
    "@wxt-dev/auto-icons",
    "@wxt-dev/module-react",
    "@vitejs/plugin-react",
    "tsx",
  ],
  paths: {
    "#imports": [".wxt/types/imports-module.d.ts"],
  },
};

export default config;
