import { z } from "zod/mini";

import type { IsoTime } from "./primitives";

export const permissionLookupSchema = z.readonly(
  z.partialRecord(
    z.enum(["canGetRegDate", "canOpenInspector", "canReportAccount"]),
    z.literal(true),
  ),
);
export type PermissionLookup = z.infer<typeof permissionLookupSchema>;

export const legacyPermissionsSchema = z.readonly(
  z.array(
    z.enum(["can_open_inspector", "can_report", "can_get_registration_date"]),
  ),
);

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
export function mapLegacyPermissionsToPermissionLookup(
  permissions: z.infer<typeof legacyPermissionsSchema>,
): PermissionLookup {
  return {
    ...(permissions.includes("can_open_inspector")
      ? { canOpenInspector: true }
      : {}),

    ...(permissions.includes("can_report") ? { canReportAccount: true } : {}),

    ...(permissions.includes("can_get_registration_date")
      ? { canGetRegDate: true }
      : {}),
  };
}
