// Semver schemas are separated from primitives to avoid bundling semver package when it's not needed

import semverValid from "semver/functions/valid";
import semverValidRange from "semver/ranges/valid";
import { z } from "zod/mini";

export const semverSchema = z
  .string()
  .check(z.refine(semverValid, "Invalid semver"))
  .brand<"Semver">();
/** @public */
export type Semver = z.infer<typeof semverSchema>;

export const semverRangeSchema = z
  .string()
  .check(z.refine(semverValidRange, "Invalid semver range"))
  .brand<"SemverRange">();
/** @public */
export type SemverRange = z.infer<typeof semverRangeSchema>;
