import type { TagListItem } from "@/shared/@model/static-lists";

export function getAffiliationLabel(
  tags: [TagListItem, ...TagListItem[]],
): string {
  return tags.at(-1)?.name ?? "";
}
