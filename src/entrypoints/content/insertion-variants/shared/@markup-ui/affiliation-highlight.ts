import type { Logger } from "@logtape/logtape";

import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ElementPlacementSchema } from "@/shared/@model/insertion-configs/shared/primitives";
import { cn } from "@/shared/tailwindcss-helpers";

import { createInsertionUi, type InsertionUi } from "./helpers";

export function mountUiWithAffiliationHighlight({
  placement,
  rootElement,
}: {
  instanceLogger: Logger;
  placement: ElementPlacementSchema;
  rootElement: HTMLElement;
}): InsertionUi<{ accountAffiliation?: AccountAffiliation }> | undefined {
  const { element } = createInsertionUi({
    className: cn(`
      bn:absolute bn:inset-[0px] bn:inline-block bn:border-l-[3px]
      bn:border-l-(--bn-inline-affiliation-border)
      bn:bg-(--bn-inline-affiliation-color)
      bn:dark:border-l-(--bn-inline-affiliation-border)/50
      bn:dark:bg-(--bn-inline-affiliation-color)/20
    `),
    dxLabel: "highlight",
    placement,
    rootElement,
    tagName: "div",
  });

  if (!element) {
    return;
  }

  return {
    element,

    render: ({ accountAffiliation }) => {
      if (accountAffiliation) {
        element.hidden = false;

        element.style.setProperty(
          "--bn-inline-affiliation-color",
          accountAffiliation.colorForHighlight,
        );

        element.style.setProperty(
          "--bn-inline-affiliation-border",
          "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
        );
      } else {
        element.hidden = true;

        element.style.removeProperty("--bn-inline-affiliation-color");

        element.style.removeProperty("--bn-inline-affiliation-border");
        return;
      }
    },

    unmount: () => {
      element.remove();
    },
  };
}
