import fs from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import reactCompiler from "babel-plugin-react-compiler";
import { defineConfig } from "wxt";

import { contentScriptMatches } from "./src/entrypoints/content/hosts-and-matches";
import { determineExtensionVersioning } from "./src/wxt-helpers";

export default defineConfig({
  autoIcons: { baseIconPath: "icon.png" },

  // Prevent clashes with dev servers that use 3000 by default
  dev: { server: { port: 3100 } },

  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.mode === "development") {
        manifest.name = "Ботнадзор (local dev)";
      }

      // WXT sorts matches alphabetically; we resort them manually to show more important matches first
      for (const contentScriptConfig of manifest.content_scripts ?? []) {
        // Individual content scripts may have subsets of matches; so we don't just replace them with the sorted list
        contentScriptConfig.matches = contentScriptConfig.matches?.toSorted(
          (a, b) => {
            const aIndex = contentScriptMatches.indexOf(a);
            const bIndex = contentScriptMatches.indexOf(b);

            if (aIndex === -1 && bIndex === -1) {
              return a.localeCompare(b);
            } else if (aIndex === -1) {
              return 1;
            } else if (bIndex === -1) {
              return -1;
            } else {
              return aIndex - bIndex;
            }
          },
        );
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
    const { extensionVersion, extensionVersionName, publishableToStores } =
      determineExtensionVersioning(configEnv.mode);

    const description = "Подсветка ботов в VK";

    // Firefox does not support version_name, so we extract the value from the description (see app.config.ts)
    const patchedDescription =
      configEnv.browser === "firefox"
        ? `Подсветка ботов в VK${extensionVersionName ? ` (${extensionVersionName})` : ""}`
        : description;

    return {
      name: "Ботнадзор: botnadzor.org",
      description: patchedDescription,
      permissions: ["activeTab", "alarms", "storage", "unlimitedStorage"],

      version: extensionVersion,
      version_name: extensionVersionName,

      ...(publishableToStores && configEnv.browser === "firefox"
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

  react: {
    vite: {
      babel: {
        plugins: [reactCompiler],
      },
    },
  },

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
