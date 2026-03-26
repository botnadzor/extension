import { kebabCase } from "es-toolkit";

export function interpretStyleProperty(property: string): string {
  if (property.startsWith("--")) {
    return property;
  }
  return kebabCase(property);
}
