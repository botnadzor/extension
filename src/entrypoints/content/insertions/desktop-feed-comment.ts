import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import {
  affiliationService,
  collectingService,
  frontendService,
} from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  applyInlineAffiliationVars,
  clearInlineAffiliationVars,
  inlineAffiliationOverlayBaseClassListTokens,
} from "./shared/affiliation-highlight-style";
import {
  extractCommentLocationFromHref,
  extractVkDomainFromAuthorLink,
} from "./shared/comment-location";
import {
  extractCommenterNameBySelector,
  extractPostCommentCountFromAriaLabel,
  getCommenterAvatarUrlWithFallback,
} from "./shared/comment-meta";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const permalink = root.querySelector("a[href*='reply=']");
  if (!(permalink instanceof HTMLAnchorElement)) {
    return;
  }
  const href = permalink.getAttribute("href");
  if (!href) {
    return;
  }
  const fromHref = extractCommentLocationFromHref(href);
  if (fromHref) {
    return fromHref;
  }
  return;
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="wall_comments_comment_root"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector('[data-testid="comment-avatar"]');
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomainFromAuthorLink(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found`);
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
      logger.warn("Comment content container not found");
      return;
    }

    commentContent.classList.add(...cnl("bn:group"));

    const badgeAnchor =
      commentContent.querySelector("a[href^='/']") ?? authorLink;

    if (!(badgeAnchor instanceof HTMLAnchorElement)) {
      return;
    }
    const actionAnchor =
      element.querySelector('[data-testid="comment-share"]') ??
      element.querySelector('[data-testid="wall_comment_date"]') ??
      commentContent;

    if (!(actionAnchor instanceof HTMLElement)) {
      return;
    }

    if (accountAffiliation) {
      addedClasses = cnl("bn:relative bn:z-0");
      commentContent.classList.add(...addedClasses);

      applyInlineAffiliationVars(commentContent, accountAffiliation.color);

      overlay = document.createElement("div");
      const overlayClassListTokens = cnl(
        ...inlineAffiliationOverlayBaseClassListTokens,
        "bn:ml-[2px]",
      );

      overlay.classList.add(...overlayClassListTokens);
      commentContent.prepend(overlay);

      badgeUI = renderInlineBadge({
        mountAfter: badgeAnchor,
        tags: accountAffiliation.tags,
        className: cn("bn:px-[2px]"),
      });
    }

    const location = extractCommentLocation(element);
    if (!location) {
      logger.warn("Unable to parse comment permalink for inspector");
    }

    let commenterName =
      extractCommenterNameBySelector(
        element,
        '[data-testid="comment-owner"]',
      ) ?? vkDomain;
    if (!commenterName) {
      const raw = authorLink.textContent;
      if (raw) {
        const trimmed = raw.trim();
        commenterName = trimmed.length > 0 ? trimmed : vkDomain;
      } else {
        commenterName = vkDomain;
      }
    }

    const commenterAvatarUrl = getCommenterAvatarUrlWithFallback(element, [
      '[data-testid="comment-avatar"] img',
      "img",
    ]);

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

    const registrationDateAnchor = element.querySelector(
      "[class*=vkitCommentBase__title]",
    );

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      return;
    }

    if (actionAnchor instanceof HTMLElement) {
      actionUI = renderAccountAction({
        design: "desktop",
        vkDomain,
        accountAffiliation,
        frontendBaseUrl,
        contentId,
        badgeAnchor,
        registrationDateAnchor,
        className: cn(`
          bn:ml-[2px] bn:translate-x-1 bn:opacity-0
          bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
        `),
        actionClassName: cn("bn:ml-2"),
        iconClassName: cn("bn:opacity-50"),
        tooltipHoverClassName: cn("bn:group-hover/link:opacity-60"),
        showTooltip: true,
        inspectorInstancePayload,
      });

      actionAnchor.after(actionUI.element);
    }

    if (location) {
      const postCommentCount = extractPostCommentCountFromAriaLabel(element, {
        postRootSelector: '[data-testid="post"]',
        commentButtonSelector: '[data-testid="post_footer_action_comment"]',
      });
      void collectingService.collectCommentIfNeeded({
        wallVkId: location.wallVkId,
        postVkId: location.postVkId,
        commentVkId: location.commentVkId,
        commenterVkDomain: vkDomain,
        postCommentCount,
      });
    }

    return () => {
      if (overlay) {
        overlay.remove();
      }

      if (addedClasses.length > 0) {
        commentContent.classList.remove(...addedClasses);
      }
      commentContent.classList.remove(...cnl("bn:group"));
      clearInlineAffiliationVars(commentContent);
      badgeUI?.destroy();
      actionUI?.destroy();
    };
  },
});
