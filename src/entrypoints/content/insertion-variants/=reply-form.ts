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
import {
  resolveElementCountSelector,
  resolveElementPresenceSelector,
} from "./shared/selector-resolution";

const attachTimeoutMs = 8000;
const markupRevalidationDebounceMs = 100;

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
  attachedItemCount: number;
  newAttachmentButtonPresence: boolean;
};

type ReplyServiceData = {
  accountAffiliation?: AccountAffiliation;
  frontendBaseUrl?: string;
};

type AttachSession = {
  contentEditable: HTMLElement;
  initialAttachedItemCount: number;
  pastedContent: string;
  restoreContentEditableStyles: () => void;
  targetAccountIdentifierKey?: string;
  timeoutId: ReturnType<typeof setTimeout>;
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

    const attachedItemCount = resolveElementCountSelector(
      rootElement,
      config.markup.data.attachedItemCount,
      instanceLogger,
    );

    const newAttachmentButtonPresence = resolveElementPresenceSelector(
      rootElement,
      config.markup.data.newAttachmentButtonPresence,
      instanceLogger,
    );

    return omitUndefined({
      accountIdentifier,
      attachedItemCount,
      newAttachmentButtonPresence,
    });
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

    let revalidateMarkupDataTimeoutId:
      | ReturnType<typeof setTimeout>
      | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(revalidateMarkupDataTimeoutId);
      revalidateMarkupDataTimeoutId = setTimeout(() => {
        revalidateMarkupData();
      }, markupRevalidationDebounceMs);
    });

    observer.observe(rootElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    // createActionUi() does not support placement, so needs a wrapper element
    const bnCardAttachmentButtonWrapper = createInsertionUi({
      dxLabel: "bnCardAttachmentButton",
      placement: config.markup.ui.bnCardAttachmentButton,
      rootElement,
      tagName: "div",
    });

    const bnCardAttachmentButton = createActionUi({
      className: cn(`
        bn:size-[20px] bn:border-none bn:bg-transparent bn:px-[0px]
        bn:text-[#994168] bn:opacity-80!
        bn:hover:opacity-100!
        bn:[&>svg]:size-[20px] bn:[&>svg]:stroke-[1.8]
      `),
      tagName: "button",
      tooltipDirection: "down",
    });

    bnCardAttachmentButtonWrapper.element?.append(
      bnCardAttachmentButton.element,
    );

    let lastAccountIdentifier: AccountIdentifier | undefined;
    let lastAccountAffiliation: AccountAffiliation | undefined;
    let lastAttachedItemCount = 0;
    let lastFrontendBaseUrl: string | undefined;
    let lastNewAttachmentButtonPresence = false;
    let attachSession: AttachSession | undefined;

    function getAccountIdentifierKey(
      accountIdentifier: AccountIdentifier | undefined,
    ): string | undefined {
      return accountIdentifier
        ? stringifyAccountIdentifier(accountIdentifier)
        : undefined;
    }

    function renderBnCardAttachmentButton() {
      if (attachSession) {
        bnCardAttachmentButton.render({
          ariaLabel: "Карточка добавляется...",
          icon: "loaderCircle",
          iconClassName: cn("bn:animate-spin bn:cursor-default"),
          tooltip: false,
        });
      } else {
        bnCardAttachmentButton.render({
          ariaLabel: "Вы отвечаете боту, добавить его карточку?",
          icon: "userPlus",
          tooltip: true,
        });
      }

      if (bnCardAttachmentButtonWrapper.element) {
        bnCardAttachmentButtonWrapper.element.hidden = !(
          lastAccountAffiliation?.botnadzorCard &&
          lastNewAttachmentButtonPresence
        );
      }
    }

    function finishAttaching(mode: "abort" | "success" | "timeout") {
      const currentAttachSession = attachSession;
      if (!currentAttachSession) {
        return;
      }

      attachSession = undefined;
      clearTimeout(currentAttachSession.timeoutId);

      if (mode === "success") {
        currentAttachSession.contentEditable.focus();
        document.execCommand("undo");
      } else {
        // Avoid undo for abort/timeout because unrelated VK edits may have
        // already changed the native undo stack.
        removeSubstringFromContentEditable(
          currentAttachSession.contentEditable,
          currentAttachSession.pastedContent,
        );
      }

      currentAttachSession.restoreContentEditableStyles();
    }

    /*
     * Card attachment strategy
     * ------------------------
     *
     * VK detects URLs pasted into the contenteditable and auto-attaches an image
     * with card. We exploit this by programmatically pasting the card URL and
     * then waiting for the regular markup revalidation cycle to report either a
     * new attachment image or the disappearance of VK's native attach button.
     * Once either signal appears, we use execCommand('undo') to remove the URL
     * text from the input. VK verifies the URL is still in the CE after its API
     * response, so we must keep it until the attachment appears. The undo goes
     * through the browser's native editing pipeline, so VK's React state stays
     * in sync (unlike direct DOM manipulation). During the wait, the CE text is
     * hidden via transparent color + height lock to prevent visual flash /
     * layout shift, and the button shows a loading spinner.
     */
    function handleButtonClick() {
      if (
        !lastAccountIdentifier ||
        !lastFrontendBaseUrl ||
        !lastNewAttachmentButtonPresence
      ) {
        return;
      }

      if (attachSession) {
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
      const contentEditableElement = contentEditable;

      // Hide the URL text visually while keeping the CE functional for VK's
      // paste handler. Lock height to prevent layout shift from the long URL.
      // Disable pointer events to prevent user interaction during the cycle.
      const savedColor = contentEditableElement.style.color;
      const savedHeight = contentEditableElement.style.height;
      const savedMaxHeight = contentEditableElement.style.maxHeight;
      const savedOverflow = contentEditableElement.style.overflow;
      const savedPointerEvents = contentEditableElement.style.pointerEvents;
      const currentHeight =
        contentEditableElement.getBoundingClientRect().height;
      contentEditableElement.style.color = "transparent";
      contentEditableElement.style.height = `${currentHeight}px`;
      contentEditableElement.style.maxHeight = `${currentHeight}px`;
      contentEditableElement.style.overflow = "hidden";
      contentEditableElement.style.pointerEvents = "none";

      // Paste the card link to trigger VK's URL attachment mechanism.
      const pastedContent = ` ${cardUrl} `;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", pastedContent);
      contentEditableElement.focus();
      contentEditableElement.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        }),
      );

      function restoreContentEditableStyles() {
        contentEditableElement.style.color = savedColor;
        contentEditableElement.style.height = savedHeight;
        contentEditableElement.style.maxHeight = savedMaxHeight;
        contentEditableElement.style.overflow = savedOverflow;
        contentEditableElement.style.pointerEvents = savedPointerEvents;
      }

      const targetAccountIdentifierKey = getAccountIdentifierKey(
        lastAccountIdentifier,
      );
      attachSession = {
        contentEditable: contentEditableElement,
        initialAttachedItemCount: lastAttachedItemCount,
        pastedContent,
        restoreContentEditableStyles,
        ...(targetAccountIdentifierKey ? { targetAccountIdentifierKey } : {}),
        timeoutId: setTimeout(() => {
          finishAttaching("timeout");
          renderBnCardAttachmentButton();
        }, attachTimeoutMs),
      };

      renderBnCardAttachmentButton();
    }

    bnCardAttachmentButton.element.addEventListener("click", handleButtonClick);

    return {
      render: ({
        markupData: {
          accountIdentifier,
          attachedItemCount,
          newAttachmentButtonPresence,
        },
        serviceData: { accountAffiliation, frontendBaseUrl },
      }) => {
        if (!bnCardAttachmentButtonWrapper.element) {
          return;
        }

        if (
          attachSession &&
          attachSession.targetAccountIdentifierKey !==
            getAccountIdentifierKey(accountIdentifier)
        ) {
          finishAttaching("abort");
        }

        lastAccountIdentifier = accountIdentifier;
        lastAccountAffiliation = accountAffiliation;
        lastAttachedItemCount = attachedItemCount;
        lastFrontendBaseUrl = frontendBaseUrl;
        lastNewAttachmentButtonPresence = newAttachmentButtonPresence;

        if (
          attachSession &&
          (attachedItemCount > attachSession.initialAttachedItemCount ||
            !newAttachmentButtonPresence)
        ) {
          finishAttaching("success");
        }

        renderBnCardAttachmentButton();
      },

      unmount: () => {
        finishAttaching("abort");
        clearTimeout(revalidateMarkupDataTimeoutId);
        bnCardAttachmentButtonWrapper.element?.remove();
        observer.disconnect();
        cleanupMarkupEdits();
      },
    };
  },
});
