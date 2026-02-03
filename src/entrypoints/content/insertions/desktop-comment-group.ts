import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  extractCommentLocationFromHref,
  extractCommentLocationFromReplyClick,
  extractVkDomainFromAuthorLink,
} from "./shared/comment-location";
import {
  extractCommenterNameBySelector,
  getCommenterAvatarUrlWithFallback,
} from "./shared/comment-meta";
import type { CommentLocation } from "./shared/types";
import { renderCommentUi } from "./shared/ui-comment";

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const dateLink = root.querySelector<HTMLAnchorElement>(
    ".group_activity_content_date a[href*='reply=']",
  );

  const href = dateLink?.getAttribute("href");
  if (href) {
    const fromHref = extractCommentLocationFromHref(href);
    if (fromHref) {
      return fromHref;
    }
  }

  const onclickHost = dateLink?.hasAttribute("onclick")
    ? dateLink
    : root.querySelector<HTMLElement>(
        ".group_activity_content_date [onclick*='showWiki']",
      );

  const onclick = onclickHost?.getAttribute("onclick");
  if (onclick) {
    const fromOnclick = extractCommentLocationFromReplyClick(onclick);
    if (fromOnclick) {
      return fromOnclick;
    }
  }

  return;
}

function extractCommenterName(root: HTMLElement): string | undefined {
  return extractCommenterNameBySelector(
    root,
    ".group_activity_content_owner_name",
  );
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".group_activity_reply_wrap",

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      "a.group_activity_content_owner_name",
    );

    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomainFromAuthorLink(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found`);
      return;
    }

    const commentContent = element.querySelector(".group_activity_content");

    if (!(commentContent instanceof HTMLElement)) {
      return;
    }

    const registrationDateAnchor = authorLink.parentElement;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      return;
    }

    const badgeAnchor = authorLink;

    const actionAnchor = element.querySelector(".ui_actions_menu_wrap");

    if (!(actionAnchor instanceof HTMLElement)) {
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const location = extractCommentLocation(element);
    if (!location) {
      logger.warn("Unable to parse group activity permalink for inspector");
    }

    let commenterName = extractCommenterName(element);
    if (!commenterName) {
      const raw = authorLink.textContent;
      commenterName = raw && raw.trim().length > 0 ? raw.trim() : vkDomain;
    }

    const commenterAvatarUrl = getCommenterAvatarUrlWithFallback(element, [
      ".group_activity_content_owner img",
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

    const ui = renderCommentUi({
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      commentContent,
      badgeAnchor,
      actionAnchor,
      registrationDateAnchor,
      containerClassName: cn(`
        bn:ml-2 bn:box-content bn:translate-y-[3px] bn:gap-[5px] bn:opacity-100
      `),
      actionTooltipHoverClassName: cn("bn:group-hover/link:opacity-60"),
      inspectorInstancePayload,
    });
    return () => {
      ui.destroy();
    };
  },
});
