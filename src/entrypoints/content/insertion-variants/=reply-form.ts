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

function waitForImgInsertion(
  target: Node,
  timeoutMs: number,
  callback: () => void,
): () => void {
  let done = false;
  // eslint-disable-next-line prefer-const -- must be `let` to allow reference in settle()
  let observer: MutationObserver;
  // eslint-disable-next-line prefer-const -- must be `let` to allow reference in settle()
  let timeoutId: ReturnType<typeof setTimeout>;

  function settle() {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timeoutId);
    observer.disconnect();
    callback();
  }

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLImageElement ||
          (node instanceof HTMLElement && node.querySelector("img"))
        ) {
          settle();

          return;
        }
      }
    }
  });

  observer.observe(target, { childList: true, subtree: true });
  timeoutId = setTimeout(settle, timeoutMs);

  return () => {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timeoutId);
    observer.disconnect();
  };
}

// VK's paste handler may convert spaces to &nbsp; (\u00A0).
// Normalize both so substring search matches regardless.
function normalizeSpaces(s: string): string {
  return s.replaceAll("\u00A0", " ");
}

function removeSubstringFromContentEditable(
  element: HTMLElement,
  substring: string,
): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let accumulated = "";
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) {
      textNodes.push(node);
      accumulated += node.data;
    }
  }

  const startIndex = normalizeSpaces(accumulated).indexOf(
    normalizeSpaces(substring),
  );
  if (startIndex === -1) {
    return;
  }

  // Walk text nodes again to find and remove the substring span.
  let offset = 0;
  let remaining = substring.length;
  for (const node of textNodes) {
    const nodeLength = node.data.length;
    const nodeEnd = offset + nodeLength;

    if (remaining > 0 && nodeEnd > startIndex) {
      const removeStart = Math.max(0, startIndex - offset);
      const removeEnd = Math.min(nodeLength, removeStart + remaining);
      remaining -= removeEnd - removeStart;
      node.data = node.data.slice(0, removeStart) + node.data.slice(removeEnd);

      if (node.data === "") {
        node.remove();
      }
    }

    offset = nodeEnd;
  }

  // Notify VK's React state about the DOM change.
  element.dispatchEvent(new InputEvent("input", { bubbles: true }));
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
    let attaching = false;
    let abortAttaching: (() => void) | undefined;

    /*
     * Card attachment strategy
     * ------------------------
     *
     * VK detects URLs pasted into the contenteditable and auto-attaches an OG
     * image card. We exploit this by programmatically pasting the card URL,
     * observing rootElement for <img> insertion (VK adds a preview image
     * once its API response arrives), then using execCommand('undo') to remove
     * the URL text from the input. VK verifies the URL is still in the CE
     * after its API response, so we must keep it until the attachment appears.
     * The undo goes through the browser's native editing pipeline, so VK's
     * React state stays in sync (unlike direct DOM manipulation). The
     * attachment is decoupled from the text content and persists after the
     * undo. During the wait, the CE text is hidden via transparent color +
     * height lock to prevent visual flash / layout shift, and the button
     * shows a loading spinner.
     */
    function handleButtonClick() {
      if (!lastAccountIdentifier || !lastFrontendBaseUrl) {
        return;
      }

      if (attaching) {
        return;
      }

      const cardUrl = generateCardUrl({
        frontendBaseUrl: lastFrontendBaseUrl,
        vkDomain: stringifyAccountIdentifier(lastAccountIdentifier),
      });

      const contentEditable = rootElement.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      );
      if (!contentEditable) {
        return;
      }

      attaching = true;

      // Show loading state on the button
      button.render({
        ariaLabel: "Карточка добавляется...",
        icon: "loaderCircle",
        iconClassName: cn("bn:animate-spin bn:cursor-default"),
        tooltip: false,
      });

      // Hide the URL text visually while keeping the CE functional for VK's
      // paste handler. Lock height to prevent layout shift from the long URL.
      // Disable pointer events to prevent user interaction during the cycle.
      const savedColor = contentEditable.style.color;
      const savedHeight = contentEditable.style.height;
      const savedMaxHeight = contentEditable.style.maxHeight;
      const savedOverflow = contentEditable.style.overflow;
      const savedPointerEvents = contentEditable.style.pointerEvents;
      const currentHeight = contentEditable.getBoundingClientRect().height;
      contentEditable.style.color = "transparent";
      contentEditable.style.height = `${currentHeight}px`;
      contentEditable.style.maxHeight = `${currentHeight}px`;
      contentEditable.style.overflow = "hidden";
      contentEditable.style.pointerEvents = "none";

      // Paste the card link to trigger VK's URL attachment mechanism.
      const pastedContent = ` ${cardUrl} `;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", pastedContent);
      contentEditable.focus();
      contentEditable.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        }),
      );

      function restoreContentEditableStyles() {
        if (!contentEditable) {
          return;
        }
        contentEditable.style.color = savedColor;
        contentEditable.style.height = savedHeight;
        contentEditable.style.maxHeight = savedMaxHeight;
        contentEditable.style.overflow = savedOverflow;
        contentEditable.style.pointerEvents = savedPointerEvents;
      }

      // Wait for VK to create the attachment (indicated by a new <img> in
      // rootElement), then undo the pasted URL text. VK verifies the URL is
      // still in the CE after its API response, so we must keep it until the
      // attachment appears. Max wait: 10s.
      const cancelImgWait = waitForImgInsertion(rootElement, 10_000, () => {
        contentEditable.focus();
        document.execCommand("undo");
        restoreContentEditableStyles();

        // Restore button state (not hiding the button in case if we need to re-try)
        attaching = false;
        abortAttaching = undefined;
        button.render({
          ariaLabel: "Вы отвечаете боту, добавить его карточку?",
          icon: "userPlus",
          tooltip: true,
        });
      });

      abortAttaching = () => {
        cancelImgWait();

        // Remove the pasted URL from the CE text. We can't use
        // execCommand('undo') here because VK may have pushed additional
        // edits onto the undo stack (e.g. name swap on reply target change).
        removeSubstringFromContentEditable(contentEditable, pastedContent);

        restoreContentEditableStyles();
        attaching = false;
        abortAttaching = undefined;
      };
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

        // If a card attachment is in progress, abort it — the reply target
        // changed, so the undo stack no longer matches our pasted URL.
        abortAttaching?.();

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
