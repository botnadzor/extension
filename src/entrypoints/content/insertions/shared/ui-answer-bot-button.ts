import type { VkDomain } from "@/shared/@primitives/vk";
import { cn } from "@/shared/tailwindcss-helpers";
import { generateCardUrl } from "@/shared/url-helpers";

import { renderActionButton } from "./ui-action-buttons";

export type RenderAnswerBotAction = {
  vkDomain: VkDomain;
  frontendBaseUrl: string;
  className?: string;
  actionClassName?: string;
  iconClassName?: string;
  showTooltip: boolean;
  tooltipClassName?: string;
  tooltipHoverClassName?: string;
  onClickHandlerTarget: HTMLElement;
};

async function pokeInputValue(text: string, input: HTMLElement): Promise<void> {
  function sleep(ms = 0): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", ` ${text} `);

  const event = new ClipboardEvent("paste", {
    clipboardData: dataTransfer,
  });
  input.dispatchEvent(event);

  await sleep();

  for (const node of input.childNodes) {
    if (node.nodeValue) {
      const cleanedValue = node.nodeValue.replace(text, "").replace("  ", "");
      node.nodeValue = cleanedValue;
    }
  }

  input.focus();

  await sleep();
}

export function renderAnswerBotAction({
  vkDomain,
  frontendBaseUrl,
  className,
  actionClassName,
  iconClassName,
  showTooltip,
  tooltipClassName,
  tooltipHoverClassName,
  onClickHandlerTarget,
}: RenderAnswerBotAction): {
  element: HTMLElement;
  destroy: () => void;
} {
  const cardUrl = generateCardUrl({ frontendBaseUrl, vkDomain });

  return renderActionButton({
    icons: [
      {
        id: "userPlus",
        kind: "button",
        title: "Вы отвечаете боту, добавить его в карточку?",
        onClick: () => {
          void pokeInputValue(cardUrl, onClickHandlerTarget);
        },
      },
    ],
    containerClassName: cn("bn:size-6 bn:opacity-100", className),
    actionClassName,
    iconClassName: cn(
      "bn:size-5 bn:stroke-[1.8] bn:text-[#994168]",
      iconClassName,
    ),
    showTooltip,
    tooltipClassName,
    tooltipHoverClassName,
  });
}
