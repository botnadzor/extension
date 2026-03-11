import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ReplyFormInsertionConfig } from "@/shared/@model/insertion-configs/reply-form";
import {
  type AccountIdentifier,
  stringifyAccountIdentifier,
} from "@/shared/@primitives/vk";
import { omitUndefined } from "@/shared/omit-undefined";
import { cn } from "@/shared/tailwindcss-helpers";
import { generateCardUrl } from "@/shared/url-helpers";

import { defineInsertionVariant } from "../insertion-variant-typings";
import { extractAccountIdentifierFromMarkup } from "./shared/@markup-data/account-identifier";
import { createActionUi } from "./shared/@markup-ui/action-bar";
import { createInsertionUi } from "./shared/@markup-ui/helpers";
import { applyMarkupEdits } from "./shared/markup-edits";

function getCaretCharOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return 0;
  }

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);

  return preCaretRange.toString().length;
}

function setCaretCharOffset(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  let remaining = offset;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;
      if (remaining <= textLength) {
        range.setStart(node, remaining);
        range.collapse(true);

        return true;
      }
      remaining -= textLength;

      return false;
    }

    for (const child of node.childNodes) {
      if (walk(child)) {
        return true;
      }
    }

    return false;
  }

  if (!walk(element)) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export type ReplyInnerData = Record<string, never>;

type ReplyMarkupData = {
  accountIdentifier?: AccountIdentifier;
};

type ReplyServiceData = {
  accountAffiliation?: AccountAffiliation;
  frontendBaseUrl?: string;
};

export default defineInsertionVariant<
  ReplyFormInsertionConfig,
  ReplyInnerData,
  ReplyMarkupData,
  ReplyServiceData
>({
  defaultInnerData: {},

  getMarkupData: async ({ config, instanceLogger, rootElement }) => {
    const accountIdentifierPromise = extractAccountIdentifierFromMarkup(
      rootElement,
      config.markup.data.accountIdentifier,
      instanceLogger,
    );

    const accountIdentifier = await accountIdentifierPromise;

    return omitUndefined({ accountIdentifier });
  },

  getServiceData: async ({
    markupData: { accountIdentifier },
    serviceLookup: { affiliationService, frontendService },
  }) => {
    if (!accountIdentifier) {
      return {};
    }

    return omitUndefined({
      accountAffiliation:
        await affiliationService.checkAccount(accountIdentifier),

      frontendBaseUrl: await frontendService.getBaseUrl(),
    });
  },

  mount: ({ config, revalidateMarkupData, rootElement }) => {
    const cleanupMarkupEdits = applyMarkupEdits(
      rootElement,
      config.markup.edits,
    );

    const observer = new MutationObserver(() => {
      revalidateMarkupData();
    });

    observer.observe(rootElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const bnCardAttachmentButtonContainer = createInsertionUi({
      dxLabel: "bnCardAttachmentButton",
      placement: config.markup.ui.bnCardAttachmentButton,
      rootElement,
      tagName: "div",
    });

    // TODO: Use one element instead of two (update createActionUi API)
    const button = createActionUi({
      className: cn(`
        bn:size-[20px] bn:border-none bn:bg-transparent bn:px-[0px]
        bn:text-[#994168] bn:opacity-80!
        bn:hover:opacity-100!
        bn:[&>svg]:size-[20px] bn:[&>svg]:stroke-[1.8]
      `),
      tagName: "button",
      tooltipDirection: "down",
    });

    bnCardAttachmentButtonContainer.element?.append(button.element);

    let lastAccountIdentifier: AccountIdentifier | undefined;
    let lastFrontendBaseUrl: string | undefined;

    function handleButtonClick() {
      if (!lastAccountIdentifier || !lastFrontendBaseUrl) {
        return;
      }

      const cardLink = generateCardUrl({
        frontendBaseUrl: lastFrontendBaseUrl,
        vkDomain: stringifyAccountIdentifier(lastAccountIdentifier),
      });

      const contentEditable = rootElement.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      );
      if (!contentEditable) {
        return;
      }

      const savedNodes = [...contentEditable.childNodes].map((node) =>
        node.cloneNode(true),
      );
      const savedOffset = getCaretCharOffset(contentEditable);

      const pastedContent = ` ${cardLink} `;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", pastedContent);
      contentEditable.focus();
      contentEditable.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dataTransfer }),
      );

      setTimeout(() => {
        contentEditable.replaceChildren(...savedNodes);
        contentEditable.focus();
        setCaretCharOffset(contentEditable, savedOffset);
      }, 100);
    }

    button.element.addEventListener("click", handleButtonClick);

    return {
      render: ({
        markupData: { accountIdentifier },
        serviceData: { accountAffiliation, frontendBaseUrl },
      }) => {
        if (!bnCardAttachmentButtonContainer.element) {
          return;
        }

        lastAccountIdentifier = accountIdentifier;
        lastFrontendBaseUrl = frontendBaseUrl;

        button.render({
          ariaLabel: "Вы отвечаете боту, добавить его карточку?",
          icon: "userPlus",
          tooltip: true,
        });

        bnCardAttachmentButtonContainer.element.hidden =
          accountAffiliation?.botnadzorCard ? false : true;
      },

      unmount: () => {
        bnCardAttachmentButtonContainer.element?.remove();
        observer.disconnect();
        cleanupMarkupEdits();
      },
    };
  },
});
