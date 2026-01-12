import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app.config.ts",
    "src/entrypoints/background.ts",
    "src/entrypoints/content.ts",
    "src/entrypoints/popup/main.tsx",
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
