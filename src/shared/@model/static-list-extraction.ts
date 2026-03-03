import { jsonrepair } from "jsonrepair";

/**
 * Extracts the default-exported array from a curated static list TypeScript
 * file.
 *
 * Handles files like:
 * ```typescript
 * import type { z } from "zod/mini";
 * export default [
 *   { id: "example", ... },
 * ] satisfies Array<z.input<typeof schema>>;
 * ```
 *
 * @param text - Full TypeScript file content
 * @returns The parsed array or `undefined` if the pattern was not found
 */
export function extractCuratedListFromTs(text: string): unknown[] | undefined {
  // Find "export default" position
  const exportMatch = /export\s+default\s*/.exec(text);
  if (!exportMatch) {
    return undefined;
  }

  const startPos = exportMatch.index + exportMatch[0].length;

  // Find opening bracket after "export default"
  const openBracket = text.indexOf("[", startPos);
  if (openBracket === -1) {
    return undefined;
  }

  // Find closing bracket - prefer `] satisfies` pattern, fall back to last `]`
  const satisfiesMatch = /\]\s+satisfies\s+/.exec(text.slice(openBracket));
  const closeBracket = satisfiesMatch
    ? openBracket + satisfiesMatch.index + 1
    : text.lastIndexOf("]") + 1;

  if (closeBracket <= openBracket) {
    return undefined;
  }

  const repaired = jsonrepair(text.slice(openBracket, closeBracket));
  const parsed: unknown = JSON.parse(repaired);

  return Array.isArray(parsed) ? parsed : undefined;
}
