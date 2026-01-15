import type { IsoDate, IsoTime } from "../primitive-values";

export type SucceededRegDateInfo = {
  success: true;
  checkedAt: IsoTime;
  value: IsoDate | IsoTime;
};

export type FailedRegDateInfo = {
  success: false;
  checkedAt: IsoTime;
  reason:
    | "methodQuotaExceeded"
    | "missingPermission"
    | "noAliasToUse"
    | "notFound"
    | "notYetKnown"
    | "tooManyRequests"
    | "unauthorized"
    | "unexpectedError";
};

export type RegDateInfo = SucceededRegDateInfo | FailedRegDateInfo;
