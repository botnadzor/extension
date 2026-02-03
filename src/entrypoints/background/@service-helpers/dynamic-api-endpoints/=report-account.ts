import { z } from "zod/mini";

import { permissionLookupSchema } from "@/shared/@model/auth";
import {
  inspectorTriggerSchema,
  reportTextMaxLength,
  reportTextMinLength,
} from "@/shared/@model/inspector";
import {
  accessCodeSchema,
  tagSuggestionSchema,
  vkIdSchema,
} from "@/shared/@model/primitives";

import { base } from "./base";
import {
  problemSchemaForInvalidAccessCode,
  problemSchemaForInvalidPayload,
  problemSchemaForMissingPermission,
  problemSchemaForRateLimited,
  problemSchemaForRejected,
  problemSchemaForUnforeseenError,
} from "./problems";

export const contractForReportAccount = base
  .route({
    path: "/report-account",
  })
  .input(
    z.object({
      body: z.object({
        accessCode: accessCodeSchema,

        tagSuggestion: tagSuggestionSchema,
        text: z
          .string()
          .check(
            z.minLength(reportTextMinLength),
            z.maxLength(reportTextMaxLength),
          ),
        trigger: inspectorTriggerSchema,
        vkId: vkIdSchema,
      }),
    }),
  )
  .output(
    z.object({
      body: z.union([
        z.object({
          problem: z.exactOptional(z.literal(false)),

          message: z.string(),
          remainingPermissionLookup: z.exactOptional(permissionLookupSchema),
          remainingPointCount: z.exactOptional(z.number()),
        }),
        problemSchemaForInvalidAccessCode,
        problemSchemaForInvalidPayload,
        problemSchemaForMissingPermission,
        problemSchemaForRateLimited,
        problemSchemaForRejected,
        problemSchemaForUnforeseenError,
      ]),
    }),
  );
