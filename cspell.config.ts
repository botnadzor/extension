import { defineConfig } from "cspell";

export default defineConfig({
  caseSensitive: true,
  dictionaries: ["cspell-words.txt"],
  dictionaryDefinitions: [
    { name: "cspell-words.txt", path: "./cspell-words.txt", addWords: true },
  ],
  enableFiletypes: ["mdx"],
  ignorePaths: [
    ".claude/settings.local.json",
    ".git/**",
    ".gitattributes",
    ".vscode/extensions.json",
    ".vscode/settings.json",
    "**/*-LICENSE.txt",
    "**/*.svg",
    "patches/**",
    "pnpm-lock.yaml",
  ],
  ignoreRegExpList: [/_URL\/\S+/g, /\p{L}+&shy;\p{L}+/gu, /url(\S+)/g],
  import: ["@cspell/dict-ru_ru/cspell-ext.json"],
  language: "en,ru",
  minWordLength: 3,
  useGitignore: true,
});
