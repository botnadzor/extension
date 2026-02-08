import { z } from "zod/mini";

import { type IsoDateTime, isoDateTimeSchema } from "./primitives";

export const permissionLookupSchema = z.readonly(
  z.object({
    getRegDate: z.exactOptional(z.literal(true)),
    inspectAccount: z.exactOptional(z.literal(true)),
    reportAccount: z.exactOptional(z.literal(true)),
  }),
);
export type PermissionLookup = z.infer<typeof permissionLookupSchema>;

export const authInputSchema = z.readonly(
  z.object({
    accessCode: z.string(),
    accessCodeEnteredAt: isoDateTimeSchema,
  }),
);

export type AuthInput = z.infer<typeof authInputSchema>;

export type AuthStatus =
  | {
      state: "empty";
      accessCode: string;
      accessCodeEnteredAt: IsoDateTime;
    }
  | {
      state: "invalid";
      accessCode: string;
      accessCodeEnteredAt: IsoDateTime;
      accessCodeRecognized: boolean;
      errorMessage: string;
    }
  | {
      state: "valid";
      expiresAt?: IsoDateTime;
      accessLevel: number;
      pointCount: number;
      permissionLookup: PermissionLookup;
    }
  | {
      state: "unknown"; // when access code is present, but dynamic API is unavailable since launch
    };

export type AuthCheck =
  | {
      state: "idle";
      lastFinishedAt?: IsoDateTime;
    }
  | {
      state: "ongoing";
      startedAt: IsoDateTime;
    };
