import { z } from "zod/mini";

import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

/*
 * Naming is inspired by https://www.rfc-editor.org/rfc/rfc9457.html
 */

export const problemSchemaForInvalidAccessCode = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:invalid-access-code"),
  description: z.string(),
  accessCodeRecognized: z.exactOptional(z.boolean()),
});

export const problemSchemaForInvalidPayload = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:invalid-payload"),
  description: z.string(),
  fields: z.exactOptional(z.array(z.string())),
});

export const problemSchemaForMissingPermission = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:missing-permission"),
  description: z.string(),
});

export const problemSchemaForNotFound = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:not-found"),
  description: z.string(),
});

export const problemSchemaForNotYetKnown = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:not-yet-known"),
  description: z.string(),
});

export const problemSchemaForRateLimited = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:rate-limited"),
  description: z.string(),
  waitUntil: z.exactOptional(isoDateTimeSchema),
});

export const problemSchemaForRejected = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:rejected"),
  description: z.string(),
});

export const problemSchemaForUnforeseenError = z.object({
  problem: z.literal(true),
  type: z.literal("bn:ext:unforeseen-error"),
  description: z.string(),
});
