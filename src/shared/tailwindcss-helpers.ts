import { twMerge } from "tailwind-merge";

/**
 * Same as `ClassNameValue` from `tailwind-merge`, but without support for arrays
 * (to keep arguments simple)
 */
export type ClassNameValue = string | null | undefined | 0 | false;

export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(inputs);
}

/**
 * Same as `cn` but returns a list of class names.
 *
 * Usage:
 *
 * ```ts
 * element.classList.add(...cnl("class1 class2", something && "class3"));
 * ```
 */
export function cnl(...inputs: ClassNameValue[]): string[] {
  return cn(...inputs).split(" ");
}
