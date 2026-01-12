import { z } from "zod/mini";

import { type IsoTime, isoTimeSchema } from "@/lib/primitive-values";
import { defineStoreWithSchema } from "@/lib/store-with-schema";

const authInputSchema = z.readonly(
  z.object({
    accessCode: z.string(),
    accessCodeEnteredAt: isoTimeSchema,
  }),
);

export type AuthInput = z.infer<typeof authInputSchema>;

export const authInputStore = defineStoreWithSchema(
  "sync:auth-input",
  authInputSchema,
);

export const defaultAuthInput: AuthInput = {
  accessCode: "",
  accessCodeEnteredAt: isoTimeSchema.parse(new Date(0)),
};

type Permission = "canOpenInspector" | "canGetRegDate" | "canReportAccount";

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
    }
  | {
      state: "valid";
      expiresAt?: IsoTime;
      accessLevel: number;
      pointCount: number;
      permissionLookup: Partial<Record<Permission, true>>;
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
