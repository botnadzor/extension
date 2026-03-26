import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { AccountIdentifier } from "@/shared/@primitives/vk";

export type AccountInsertionMarkupData = {
  accountAvatarUrl: string;
  accountIdentifier: AccountIdentifier;
  accountName: string;
};

export type AccountInsertionServiceData = {
  accountAffiliation?: AccountAffiliation;
  frontendBaseUrl: string;
};
