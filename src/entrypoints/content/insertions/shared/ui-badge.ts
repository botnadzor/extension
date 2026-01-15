import type { TagListItem } from "@/shared/static-lists/=tags";
import { cn } from "@/shared/tailwindcss-helpers";

export type InlineBadgeHandle = {
  element: HTMLSpanElement;
  destroy: () => void;
};

export type InlineBadgePayload = {
  mountAfter: Element;
  tags: [TagListItem, ...TagListItem[]];
  textColor?: string;
  background?: string;
  className?: string;
  mountMode?: "after" | "append";
  maxTags?: number;
};

export function renderInlineBadge({
  mountAfter,
  tags,
  textColor = cn("bn:text-muted-foreground"),
  background,
  className,
  mountMode = "after",
  maxTags = 1,
}: InlineBadgePayload): InlineBadgeHandle {
  const element = document.createElement("span");
  element.className = cn(
    "bn:inline-flex bn:items-center bn:justify-center bn:italic",
    textColor,
    className,
  );

  const displayTags = tags.slice(-maxTags);
  element.textContent = `(${displayTags.map((tag) => tag.name).join(", ")})`;

  if (background) {
    element.style.backgroundColor = background;
  }

  if (mountMode === "append") {
    mountAfter.append(element);
  } else {
    mountAfter.after(element);
  }

  return {
    element,
    destroy() {
      element.remove();
    },
  };
}
