import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import { vkIdSchema } from "@/shared/@model/primitives";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  applyInlineAffiliationVars,
  clearInlineAffiliationVars,
  inlineAffiliationOverlayBaseClasses,
} from "./shared/affiliation-highlight-style";
import { extractVkDomainFromAuthorLink } from "./shared/comment-location";
import {
  extractCommenterAvatarUrlBySelector,
  extractCommenterNameBySelector,
} from "./shared/comment-meta";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";

function extractVideoCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const href = window.location.href;
  const videoMatch = /video(-?\d+)_(\d+)/.exec(href);

  if (!videoMatch) {
    return;
  }

  const ownerNumber = Number(videoMatch[1]);
  const videoNumber = Number(videoMatch[2]);

  if (!Number.isFinite(ownerNumber) || !Number.isFinite(videoNumber)) {
    return;
  }

  const commentIdAttr = root.getAttribute("id");
  if (!commentIdAttr) {
    return;
  }

  const commentNumber = Number(commentIdAttr);
  if (!Number.isFinite(commentNumber)) {
    return;
  }

  return {
    wallVkId: vkIdSchema.parse(ownerNumber),
    postVkId: vkIdSchema.parse(videoNumber),
    commentVkId: vkIdSchema.parse(commentNumber),
  };
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="comment"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector('[data-testid="comment-avatar"]');

    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor = element.querySelector(
      "[class*=vkitCommentBase__title]",
    );
    if (!(registrationDateAnchor instanceof HTMLElement)) {
      return;
    }

    const vkDomain = extractVkDomainFromAuthorLink(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found for video comment`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    let badgeUI: ReturnType<typeof renderInlineBadge> | undefined;
    let actionUI: ReturnType<typeof renderAccountAction> | undefined;
    let overlay: HTMLDivElement | undefined;
    let addedClasses: string[] = [];

    const commentContent = authorLink.nextElementSibling;
    if (!(commentContent instanceof HTMLElement)) {
      logger.warn("Video comment content container not found");
      return;
    }

    const overflowSibling = element.querySelector<HTMLElement>(
      '[data-testid="comment-text"]',
    );

    const overflowHost = overflowSibling?.parentElement;

    let previousOverflow: string | undefined;

    if (overflowHost) {
      previousOverflow = overflowHost.style.overflow;
      overflowHost.style.overflow = "visible";
    }

    const badgeAnchor = element.querySelector<HTMLAnchorElement>(
      '[data-testid="comment-owner"]',
    );

    if (!badgeAnchor) {
      return;
    }

    const actionAnchor = element.querySelector<HTMLElement>(
      '[data-testid="comment-reply"]',
    );

    if (!actionAnchor) {
      return;
    }

    if (accountAffiliation) {
      addedClasses = cnl("bn:relative bn:z-0");
      commentContent.classList.add(...addedClasses);
      applyInlineAffiliationVars(commentContent, accountAffiliation.color);

      overlay = document.createElement("div");
      overlay.classList.add(
        ...inlineAffiliationOverlayBaseClasses,
        ...cnl("bn:ml-[6px]"),
      );

      commentContent.prepend(overlay);

      badgeUI = renderInlineBadge({
        mountAfter: badgeAnchor,
        tags: accountAffiliation.tags,
        className: cn("bn:px-[2px]"),
      });
    }

    element.classList.add(...cnl("bn:group"));

    const location = extractVideoCommentLocation(element);
    if (!location) {
      logger.warn("Unable to determine video comment location for inspector");
    }

    let commenterName =
      extractCommenterNameBySelector(
        element,
        '[data-testid="comment-owner"]',
      ) ?? vkDomain;
    if (!commenterName) {
      const raw = badgeAnchor.textContent;
      const fallback = raw && raw.trim().length > 0 ? raw.trim() : vkDomain;
      commenterName = fallback;
    }

    const commenterAvatarUrl =
      extractCommenterAvatarUrlBySelector(element, [
        '[data-testid="comment-avatar"] img',
        "img",
      ]) ?? "https://vk.com/images/camera_200.png";

    let inspectorInstancePayload: InspectorInstancePayload | undefined;
    if (location) {
      inspectorInstancePayload = {
        accountInfo: {
          vkDomain,
          name: commenterName,
          avatarUrl: commenterAvatarUrl,
        },
        trigger: {
          type: "comment",
          ...location,
        },
      };
    }

    if (actionAnchor instanceof HTMLElement) {
      actionUI = renderAccountAction({
        design: "desktop",
        vkDomain,
        accountAffiliation,
        frontendBaseUrl,
        contentId,
        registrationDateAnchor,
        badgeAnchor,
        className: cn(`
          bn:ml-[-10px] bn:translate-x-1 bn:opacity-0
          bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
        `),
        actionClassName: cn("bn:ml-2"),
        iconClassName: cn("bn:opacity-50"),
        showTooltip: true,
        inspectorInstancePayload,
      });

      actionAnchor.after(actionUI.element);
    }
    return () => {
      if (overlay) {
        overlay.remove();
      }

      if (addedClasses.length > 0) {
        commentContent.classList.remove(...addedClasses);
      }
      clearInlineAffiliationVars(commentContent);

      element.classList.remove(...cnl("bn:group"));

      badgeUI?.destroy();
      actionUI?.destroy();

      if (overflowHost) {
        if (previousOverflow && previousOverflow.length > 0) {
          overflowHost.style.overflow = previousOverflow;
        } else {
          overflowHost.style.removeProperty("overflow");
        }
      }
    };
  },
});
