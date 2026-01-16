import { type HexColor, hexColorSchema } from "./primitives";
import type { TagListItem } from "./static-lists";

export type AccountAffiliation = {
  color: HexColor;
  tags: [TagListItem, ...TagListItem[]];
  /** true if user has chosen to not highlight these kinds of accounts */
  hidden?: boolean;
  /** true if the account has a link to a Botnadzor page */
  botnadzorPage?: true;
  /** true if the account has a link to a Botnadzor card */
  botnadzorCard?: true;
};

export const fallbackHexColor = hexColorSchema.parse("#888888");
