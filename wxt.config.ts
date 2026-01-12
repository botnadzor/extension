import fs from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { determineExtensionVersioning } from "./src/lib/wxt-helpers";

export default defineConfig({
  // Prevent clashes with dev servers that use 3000 by default
  dev: { server: { port: 3100 } },

  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.mode === "development") {
        manifest.name = "Ботнадзор (local dev)";
      }
    },

    "zip:done": (wxt, zipFiles) => {
      const { extensionVersionName } = determineExtensionVersioning(
        wxt.config.mode,
      );

      for (const zipFilePath of zipFiles) {
        fs.renameSync(
          zipFilePath,
          zipFilePath.replace("latest", extensionVersionName),
        );
      }
    },
  },

  imports: false,

  manifest: (configEnv) => {
    const { extensionVersion, extensionVersionName, publishable } =
      determineExtensionVersioning(configEnv.mode);

    return {
      name: "Ботнадзор: botnadzor.org",
      permissions: ["activeTab", "alarms", "storage", "unlimitedStorage"],

      version: extensionVersion,
      version_name: extensionVersionName,

      ...(publishable
        ? {
            browser_specific_settings: {
              gecko: { id: "extension@botnadzor.org" },
            },
          }
        : {}),
    };
  },

  modules: ["@wxt-dev/auto-icons", "@wxt-dev/module-react"],

  outDir: "dist",

  srcDir: "src",

  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        // https://github.com/tailwindlabs/tailwindcss/discussions/16119#discussioncomment-12758373
        // cspell:ignore onwarn
        name: "vite-plugin-ignore-sourcemap-warnings",
        apply: "build",
        configResolved(config) {
          const originalOnWarn = config.build.rollupOptions.onwarn;
          config.build.rollupOptions.onwarn = (warning, warn) => {
            if (
              warning.code === "SOURCEMAP_BROKEN" &&
              warning.plugin === "@tailwindcss/vite:generate:build"
            ) {
              return;
            }

            if (originalOnWarn) {
              originalOnWarn(warning, warn);
            } else {
              warn(warning);
            }
          };
        },
      },
    ],
  }),

  webExt: {
    startUrls: ["https://vk.com/ria"],
  },
  zip: {
    // These files are renamed in "zip:done" hook
    artifactTemplate: "botnadzor-for-{{browser}}-latest.zip",
    sourcesTemplate: "botnadzor-for-{{browser}}-latest.sources.zip",
    zipSources: true,
  },
});
