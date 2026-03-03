import { twMerge } from "tailwind-merge";

/**
 * Same as `ClassNameValue` from `tailwind-merge`, but without support for arrays
 * (to keep arguments simple).
 */
export type ClassNameValue =
  | string
  | null
  | undefined
  | 0
  | false
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed for compatibility with Base UI (passing a function is a no-op)
  | Function;

export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(inputs.filter((input) => typeof input !== "function"));
}

/**
 * Same as `cn` but returns a list of class name tokens instead of a single string.
 *
 * Usage:
 *
 * ```ts
 * const myCnTokens = cnt("class1 class2", something && "class3");
 *
 * element.classList.add(...myCnTokens);
 * element.classList.remove(...myCnTokens);
 * ```
 */
export function cnt(...inputs: ClassNameValue[]): string[] {
  return cn(...inputs).split(" ");
}
