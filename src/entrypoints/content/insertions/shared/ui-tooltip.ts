import { cn } from "@/shared/tailwindcss-helpers";

import type { IconId } from "./icons";

export const iconTitles: Partial<Record<IconId, string>> = {
  squareMenu: "Комментарии",
  squareUser: "Карточка",
  userSearch: "Инспектор",
  calendarDays: "Дата регистрации",
  userPlus: "Вы отвечаете боту, добавить его в карточку?",
};

export type TooltipDirection = "up" | "down";

export type TooltipRenderOptions = {
  text: string;
  direction?: TooltipDirection | undefined;
  className?: string;
  hoverOpacityClassName?: string | undefined;
  arrowClassName?: string;
};

export function renderTooltip({
  text,
  direction = "up",
  className,
  hoverOpacityClassName,
  arrowClassName,
}: TooltipRenderOptions): HTMLDivElement {
  const tip = document.createElement("div");
  tip.textContent = text;

  tip.dataset["bnTooltip"] = "1";

  const isDown = direction === "down";

  tip.className = cn(
    `
      bn:absolute
      ${isDown ? "bn:top-full bn:mt-2" : "bn:bottom-full bn:mb-2"}
      bn:left-1/2 bn:z-50 bn:-translate-x-1/2 bn:rounded-sm bn:bg-black bn:px-2
      bn:py-1 bn:text-xs bn:whitespace-nowrap bn:text-white bn:opacity-0
    `,
    hoverOpacityClassName ?? "bn:group-hover/link:opacity-80",
    className,
  );

  const arrow = document.createElement("div");

  const arrowClass = cn(
    `
      bn:absolute
      ${isDown ? "bn:bottom-full" : "bn:top-full"}
      bn:left-1/2 bn:-translate-x-1/2 bn:border-4
      bn:border-transparent
      ${isDown ? "bn:border-b-black" : "bn:border-t-black"}
    `,
    arrowClassName,
  );

  arrow.className = cn(arrowClass, arrowClassName);
  tip.append(arrow);

  return tip;
}
