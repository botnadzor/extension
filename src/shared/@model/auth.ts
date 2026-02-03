import { z } from "zod/mini";

import { type IsoTime, isoTimeSchema } from "./primitives";

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
    accessCodeEnteredAt: isoTimeSchema,
  }),
);

export type AuthInput = z.infer<typeof authInputSchema>;

export type AuthStatus =
  | {
      state: "empty";
      accessCode: string;
      accessCodeEnteredAt: IsoTime;
    }
  | {
      state: "invalid";
      accessCode: string;
      accessCodeEnteredAt: IsoTime;
      accessCodeRecognized: boolean;
      errorMessage: string;
    }
  | {
      state: "valid";
      expiresAt?: IsoTime;
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
      lastFinishedAt?: IsoTime;
    }
  | {
      state: "ongoing";
      startedAt: IsoTime;
    };
