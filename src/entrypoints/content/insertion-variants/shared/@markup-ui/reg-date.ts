import type { Logger } from "@logtape/logtape";

import type { ElementPlacementSchema } from "@/shared/@model/insertion-configs/shared/primitives";
import type { IsoDate, IsoDateTime } from "@/shared/@primitives/temporal";
import { formatDateWithOptionalTime } from "@/shared/formatting";
import { cn } from "@/shared/tailwindcss-helpers";

import { createInsertionUi, type InsertionUi } from "./helpers";

export type RegDateInfo =
  | { status: "fetching" }
  | { status: "fetched"; value: IsoDate | IsoDateTime };

export function mountUiWithRegDate({
  placement,
  rootElement,
}: {
  instanceLogger: Logger;
  placement: ElementPlacementSchema;
  rootElement: HTMLElement;
}): InsertionUi<{ regDate?: RegDateInfo }> | undefined {
  const { element } = createInsertionUi({
    className: cn(
      "bn:relative bn:text-[length:inherit] bn:text-muted-foreground",
    ),
    dxLabel: "regDate",
    placement,
    rootElement,
    tagName: "div",
  });

  if (!element) {
    return;
  }

  return {
    element,

    render: ({ regDate }) => {
      element.hidden = regDate?.status !== "fetched";

      element.textContent =
        regDate?.status === "fetched"
          ? `Регистрация ${formatDateWithOptionalTime(regDate.value)}`
          : "";
    },
    unmount: () => {
      element.remove();
    },
  };
}
