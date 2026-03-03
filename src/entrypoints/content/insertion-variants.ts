import type { InsertionVariant } from "@/shared/@model/insertion-configs";

import type { BaseInsertionVariantDefinition } from "./insertion-variant-typings";
import account from "./insertion-variants/account";
import comment from "./insertion-variants/comment";
import replyForm from "./insertion-variants/reply-form";
import review from "./insertion-variants/review";

export const insertionVariantLookup: Record<
  InsertionVariant,
  BaseInsertionVariantDefinition
> = {
  account,
  comment,
  replyForm,
  review,
};
