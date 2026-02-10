import { z } from "zod/mini";

export const isoDateSchema = z
  .string()
  .check(z.regex(/^\d{4}-\d{2}-\d{2}$/))
  .brand<"IsoDate">();
/** @public */
export type IsoDate = z.infer<typeof isoDateSchema>;

export const isoDateTimeSchema = z
  .pipe(
    z.transform((input: unknown) =>
      input === undefined
        ? new Date().toISOString()
        : input instanceof Date
          ? input.toISOString()
          : typeof input === "number"
            ? new Date(input).toISOString()
            : input,
    ),
    z.string().check(
      z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
      z.overwrite((value: string) => value.replace(/\.\d{3}Z/, "Z")),
    ),
  )
  .brand<"IsoDateTime">();
/** @public */
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
