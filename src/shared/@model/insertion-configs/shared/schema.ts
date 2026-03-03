import { z } from "zod/mini";

import { semverRangeSchema } from "../../../@primitives/semver";
import { elementSelectorSchema } from "./primitives";

export const appliesToSchema = z.enum([
  "desktopAndMobileVkWebsite",
  "desktopVkWebsite",
  "mobileVkWebsite",
]);

const baseShape = {
  id: z.string(),
  disabled: z.exactOptional(z.literal(true)),
  appliesTo: appliesToSchema,
  appliesToArchivedSnapshotsOnly: z.exactOptional(z.literal(true)),
  extensionVersionRange: z.exactOptional(semverRangeSchema),
  selector: elementSelectorSchema,
};

export function createInsertionConfigSchema<
  Variant extends string,
  VariantShape extends z.core.$ZodShape,
>(
  variant: Variant,
  variantShape: VariantShape &
    Partial<Record<keyof typeof baseShape | "id", never>>,
): z.ZodMiniReadonly<
  z.ZodMiniObject<
    { variant: z.ZodMiniLiteral<Variant> } & typeof baseShape & VariantShape
  >
> {
  return z.readonly(
    z.object({
      variant: z.literal(variant),
      ...baseShape,
      ...variantShape,
    }),
  );
}
