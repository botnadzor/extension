import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ElementPlacementSchema } from "@/shared/@model/insertion-configs/shared/primitives";
import type { TagListItem } from "@/shared/@model/static-lists";
import type { AccountIdentifier } from "@/shared/@primitives/vk";
import { cn } from "@/shared/tailwindcss-helpers";

import { createInsertionUi, type InsertionUi } from "./helpers";

function stringifyAffiliationTags(
  tags: [TagListItem, ...TagListItem[]],
): string {
  return `(${tags.at(-1)?.name})`;
}

export function mountUiWithAffiliationBadge({
  placement,
  rootElement,
}: {
  placement: ElementPlacementSchema;
  rootElement: HTMLElement;
}):
  | InsertionUi<{
      accountAffiliation?: AccountAffiliation;
      accountIdentifier: AccountIdentifier;
    }>
  | undefined {
  const { element } = createInsertionUi({
    className: cn(
      "bn:relative bn:text-[13px] bn:text-muted-foreground bn:italic",
    ),
    dxLabel: "affiliationBadge",
    placement,
    rootElement,
    tagName: "span",
  });

  if (!element) {
    return;
  }

  return {
    element,

    render: ({ accountAffiliation }) => {
      element.hidden = !accountAffiliation;

      if (!accountAffiliation) {
        element.textContent = "";
        element.style.removeProperty("--bn-inline-affiliation-color");
        return;
      }

      element.textContent = stringifyAffiliationTags(accountAffiliation.tags);

      element.style.setProperty(
        "--bn-inline-affiliation-color",
        accountAffiliation.colorForHighlight,
      );
    },

    unmount: () => {
      element.remove();
    },
  };
}
