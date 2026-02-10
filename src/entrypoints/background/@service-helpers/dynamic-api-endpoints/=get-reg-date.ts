import { z } from "zod/mini";

import { permissionLookupSchema } from "@/shared/@model/auth";
import { accessCodeSchema } from "@/shared/@primitives/misc";
import {
  isoDateSchema,
  isoDateTimeSchema,
} from "@/shared/@primitives/temporal";
import { positiveVkIdSchema } from "@/shared/@primitives/vk";

import { base } from "./base";
import {
  problemSchemaForInvalidAccessCode,
  problemSchemaForInvalidPayload,
  problemSchemaForMissingPermission,
  problemSchemaForNotYetKnown,
  problemSchemaForRateLimited,
  problemSchemaForUnforeseenError,
} from "./problems";

export const contractForGetRegDate = base
  .route({
    path: "/get-reg-date",
  })
  .input(
    z.object({
      body: z.object({
        accessCode: accessCodeSchema,

        vkId: positiveVkIdSchema,
      }),
    }),
  )
  .output(
    z.object({
      body: z.union([
        z.object({
          problem: z.exactOptional(z.literal(false)),

          value: z.union([isoDateSchema, isoDateTimeSchema]),
          remainingPermissionLookup: z.exactOptional(permissionLookupSchema),
          remainingPointCount: z.exactOptional(z.number()),
        }),
        problemSchemaForInvalidAccessCode,
        problemSchemaForInvalidPayload,
        problemSchemaForMissingPermission,
        problemSchemaForNotYetKnown,
        problemSchemaForRateLimited,
        problemSchemaForUnforeseenError,
      ]),
    }),
  );
