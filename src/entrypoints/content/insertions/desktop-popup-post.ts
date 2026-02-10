import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import type { VkDomain } from "@/shared/@primitives/vk";
import {
  affiliationService,
  collectingService,
  frontendService,
} from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  extractCommentLocationFromHref,
  extractCommentLocationFromReplyClick,
  extractVkDomainFromAuthorLink,
} from "./shared/comment-location";
import {
  extractCommenterNameBySelector,
  extractPostCommentCountFromDataset,
  getCommenterAvatarUrlWithFallback,
} from "./shared/comment-meta";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";

export function extractVkDomain(
  authorLink: HTMLAnchorElement,
): VkDomain | undefined {
  return extractVkDomainFromAuthorLink(authorLink);
}

export function extractVkDomainLocation(
  href: string,
): CommentLocation | undefined {
  return extractCommentLocationFromHref(href);
}

function extractLocationFromOnclick(
  onclick: string,
): CommentLocation | undefined {
  return extractCommentLocationFromReplyClick(onclick);
}

export function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const linkWithReply =
    root.querySelector<HTMLAnchorElement>("a[href*='reply=']");
  const href = linkWithReply?.getAttribute("href");
  if (href) {
    const fromHref = extractVkDomainLocation(href);
    if (fromHref) {
      return fromHref;
    }
  }

  const onclickHost =
    (root.hasAttribute("onclick") ? root : undefined) ??
    root.querySelector<HTMLElement>("[onclick*='replyClick']");

  const onclick = onclickHost?.getAttribute("onclick");
  if (onclick) {
    const fromOnclick = extractLocationFromOnclick(onclick);
    if (fromOnclick) {
      return fromOnclick;
    }
  }

  return;
}

function extractCommenterName(root: HTMLElement): string | undefined {
  return extractCommenterNameBySelector(root, ".reply_author .author");
}

function extractPostCommentCount(root: HTMLElement): number | undefined {
  return extractPostCommentCountFromDataset(root, {
    postRootSelector: ".reply._post",
    commentButtonSelector: ".PostBottomAction.comment._comment._reply_wrap",
    datasetKey: "count",
  });
}

const markAttribute = "data-bn-post-popup-actions";

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".tt_w.wall_tt.fw_reply_tt",

  init: async ({ element, logger, contentId }) => {
    if (element.hasAttribute(markAttribute)) {
      return;
    }
    element.setAttribute(markAttribute, "1");

    const content = element.querySelector(".content");
    if (!(content instanceof HTMLElement)) {
      return;
    }

    const replyRoot = content.querySelector(".reply");
    if (!(replyRoot instanceof HTMLElement)) {
      return;
    }

    const footer = replyRoot.querySelector(".reply_footer");
    if (!(footer instanceof HTMLElement)) {
      return;
    }

    const authorLink = replyRoot.querySelector(
      '.reply_author a.author[href^="/"]',
    );
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor = authorLink.parentElement;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      logger.warn("Registration date anchor not found desktop-popup-post");
      return;
    }

    const badgeAnchor = authorLink;

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      logger.warn(`Unable to determine vkDomain from ${authorLink.href}`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const location = extractCommentLocation(element);
    if (!location) {
      logger.warn("Unable to parse comment permalink for inspector");
    }

    let commenterName = extractCommenterName(element);

    if (!commenterName) {
      const raw = authorLink.textContent;
      commenterName = raw && raw.trim().length > 0 ? raw.trim() : vkDomain;
    }

    const commenterAvatarUrl = getCommenterAvatarUrlWithFallback(element, [
      ".reply_image img",
      ".reply_author img",
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

    const actionUI = renderAccountAction({
      design: "desktop",
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      badgeAnchor,
      registrationDateAnchor,
      className: cn(`
        bn:translate-x-1 bn:opacity-0
        bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
      `),
      actionClassName: cn("bn:ml-2 bn:opacity-50"),
      showTooltip: true,
      inspectorInstancePayload,
    });

    if (location) {
      const postCommentCount = extractPostCommentCount(element);
      void collectingService.collectCommentIfNeeded({
        wallVkId: location.wallVkId,
        postVkId: location.postVkId,
        commentVkId: location.commentVkId,
        commenterVkDomain: vkDomain,
        postCommentCount,
      });
    }

    footer.append(actionUI.element);
    return () => {
      element.removeAttribute(markAttribute);
      actionUI.destroy();
    };
  },
});
