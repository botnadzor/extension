import { cn } from "@/shared/tailwindcss-helpers";

import { createIconElement, type IconId } from "./icons";
import { iconTitles, renderTooltip, type TooltipDirection } from "./ui-tooltip";

type BaseIconSpec = {
  id: IconId;
  title?: string;
};

type LinkIconSpec = BaseIconSpec & {
  id: IconId;
  kind: "link";
  title?: string;
  href: string;
};

export type ButtonIconSpec = BaseIconSpec & {
  id: IconId;
  kind: "button";
  title?: string;
  onClick?: (e: MouseEvent) => void;
};

export type IconSpec = LinkIconSpec | ButtonIconSpec;

export type TooltipConfig = {
  direction?: TooltipDirection;
};

type Options = {
  icons: readonly IconSpec[];
  containerClassName?: string;
  actionClassName?: string;
  iconClassName?: string;
  showTooltip?: boolean | TooltipConfig;
  tooltipClassName?: string;
  tooltipHoverClassName?: string;
};

function isLinkIcon(spec: IconSpec): spec is LinkIconSpec {
  return spec.kind === "link";
}

function isButtonIcon(spec: IconSpec): spec is ButtonIconSpec {
  return spec.kind === "button";
}

export function renderActionButton({
  icons,
  containerClassName,
  actionClassName,
  iconClassName,
  showTooltip,
  tooltipClassName,
  tooltipHoverClassName,
}: Options): {
  element: HTMLElement;
  destroy: () => void;
} {
  const box = document.createElement("div");
  box.className = cn("bn:inline-flex bn:items-center", containerClassName);

  const cleanup: Array<() => void> = [];

  for (const spec of icons) {
    let el: HTMLAnchorElement | HTMLButtonElement;

    if (isLinkIcon(spec)) {
      const a = document.createElement("a");
      a.href = spec.href;
      a.target = "_blank";
      el = a;
    } else {
      const button = document.createElement("button");
      button.type = "button";
      el = button;
    }

    const baseActionClasses = `
      bn:group/link
      bn:relative bn:inline-flex bn:cursor-pointer bn:items-center
      bn:justify-center
      bn:border-none bn:bg-transparent
      bn:p-0 bn:leading-none bn:align-middle
    `;

    const buttonNudgeClasses = isButtonIcon(spec) ? "bn:pb-[1px]" : "";

    el.className = cn(baseActionClasses, buttonNudgeClasses, actionClassName);

    const svg = createIconElement({
      iconId: spec.id,
      className: cn("bn:block bn:shrink-0", iconClassName),
    });

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    el.append(svg);

    const tooltipText = spec.title ?? iconTitles[spec.id];

    const tooltipEnabled =
      typeof showTooltip === "object" ? true : Boolean(showTooltip);
    const tooltipDirection =
      typeof showTooltip === "object" ? showTooltip.direction : undefined;

    if (
      tooltipEnabled &&
      typeof tooltipText === "string" &&
      tooltipText.trim() !== ""
    ) {
      el.append(
        renderTooltip({
          text: tooltipText,
          direction: tooltipDirection,
          hoverOpacityClassName: tooltipHoverClassName,
          ...(tooltipClassName && { className: tooltipClassName }),
        }),
      );
    }

    if (isButtonIcon(spec) && typeof spec.onClick === "function") {
      const onClick = spec.onClick;
      function handleClick(event: Event) {
        if (!(event instanceof MouseEvent)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();

        onClick(event);
      }

      el.addEventListener("click", handleClick);
      cleanup.push(() => {
        el.removeEventListener("click", handleClick);
      });
    }
    box.append(el);
  }

  return {
    element: box,
    destroy() {
      for (const fn of cleanup) {
        fn();
      }
      box.remove();
    },
  };
}
