import { z } from "zod/mini";

import { permissionLookupSchema } from "@/shared/@model/auth";
import { accessCodeSchema, isoTimeSchema } from "@/shared/@model/primitives";

import { base } from "./base";
import {
  problemSchemaForInvalidAccessCode,
  problemSchemaForUnforeseenError,
} from "./problems";

export const contractForGetMe = base
  .route({
    path: "/get-me",
  })
  .input(
    z.object({
      body: z.object({
        accessCode: accessCodeSchema,
      }),
    }),
  )
  .output(
    z.object({
      body: z.union([
        z.object({
          problem: z.exactOptional(z.literal(false)),

          accessLevel: z.number(),
          expiresAt: z.exactOptional(isoTimeSchema),
          permissionLookup: permissionLookupSchema,
          pointCount: z.number().check(z.minimum(0), z.maximum(1_000_000_000)),
        }),
        problemSchemaForInvalidAccessCode,
        problemSchemaForUnforeseenError,
      ]),
    }),
  );
