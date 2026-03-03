import { cn } from "@/shared/tailwindcss-helpers";

import type { InsertionUi } from "./helpers";

export type TooltipDirection = "up" | "down";

export function createTooltipUi({
  direction = "up",
  className,
}: {
  direction?: TooltipDirection | undefined;
  className?: string;
}): InsertionUi<{ text: string }> {
  const element = document.createElement("div");
  element.dataset["bnElement"] = "tooltip";
  element.className = cn(
    `
      bn:pointer-events-none bn:absolute bn:left-1/2 bn:z-50 bn:-translate-x-1/2
      bn:rounded-[4px] bn:bg-tooltip bn:px-[8px] bn:py-[4px] bn:text-[13px]
      bn:whitespace-nowrap bn:text-tooltip-foreground bn:opacity-0
      bn:group-hover/action:opacity-90
      bn:group-focus-visible/action:opacity-90
    `,
    direction === "down"
      ? "bn:top-full bn:mt-[8px]"
      : "bn:bottom-full bn:mb-[8px]",
    className,
  );

  const textNode = document.createTextNode("");
  element.append(textNode);

  const arrowNode = document.createElement("div");
  arrowNode.className = cn(
    `
      bn:absolute bn:left-1/2 bn:-translate-x-1/2 bn:border-4
      bn:border-transparent
    `,
    direction === "down"
      ? "bn:bottom-full bn:border-b-tooltip"
      : "bn:top-full bn:border-t-tooltip",
  );

  element.append(arrowNode);

  let previousText: string | undefined;

  return {
    element,

    render: ({ text }) => {
      if (text !== previousText) {
        element.hidden = !text;
        textNode.textContent = text;
        previousText = text;
      }
    },

    unmount: () => {
      element.remove();
    },
  };
}
