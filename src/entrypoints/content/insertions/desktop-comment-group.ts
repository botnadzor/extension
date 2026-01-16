import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/@model/primitives";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import type { CommentLocation } from "./shared/types";
import { renderCommentUi } from "./shared/ui-comment";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }
  const directMatch = /^\/([^/?#]+)/.exec(href);
  const directDomain = vkDomainSchema.safeParse(directMatch?.[1]).data;

  return directDomain;
}

function extractLocationFromHref(href: string): CommentLocation | undefined {
  const wallRegexp =
    /(?:https?:\/\/vk\.com)?\/(?:wall|video|photo)(-?\d+)_(\d+)/;
  const wallMatch = wallRegexp.exec(href);
  if (!wallMatch) {
    return;
  }

  const wallVkId = vkIdSchema.parse(Number(wallMatch[1]));
  const postVkId = vkIdSchema.parse(Number(wallMatch[2]));

  const replyMatch = /[?&]reply=(\d+)/.exec(href);
  const commentVkId = replyMatch
    ? vkIdSchema.parse(Number(replyMatch[1]))
    : postVkId;

  return { wallVkId, postVkId, commentVkId };
}

function extractLocationFromOnclick(
  onclick: string,
): CommentLocation | undefined {
  const wallLike = /replyClick\('wall(-?\d+)_(\d+)'\s*,\s*(\d+)/.exec(onclick);

  if (!wallLike) {
    return;
  }

  const ownerNumber = Number(wallLike[1]);
  const postNumber = Number(wallLike[2]);
  const commentNumber = Number(wallLike[3]);

  if (
    !Number.isFinite(ownerNumber) ||
    !Number.isFinite(postNumber) ||
    !Number.isFinite(commentNumber)
  ) {
    return;
  }

  return {
    wallVkId: vkIdSchema.parse(ownerNumber),
    postVkId: vkIdSchema.parse(postNumber),
    commentVkId: vkIdSchema.parse(commentNumber),
  };
}

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const dateLink = root.querySelector<HTMLAnchorElement>(
    ".group_activity_content_date a[href*='reply=']",
  );

  const href = dateLink?.getAttribute("href");
  if (href) {
    const fromHref = extractLocationFromHref(href);
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
    const fromOnclick = extractLocationFromOnclick(onclick);
    if (fromOnclick) {
      return fromOnclick;
    }
  }

  return;
}

function extractCommenterName(root: HTMLElement): string | undefined {
  const link = root.querySelector<HTMLElement>(
    ".group_activity_content_owner_name",
  );

  const raw = link?.textContent;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function extractCommenterAvatarUrl(root: HTMLElement): string | undefined {
  const img = root.querySelector<HTMLImageElement>(
    ".group_activity_content_owner img",
  );

  const src = img?.getAttribute("src");
  const trimmed = src?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

    const vkDomain = extractVkDomain(authorLink);
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

    const commenterAvatarUrl =
      extractCommenterAvatarUrl(element) ??
      "https://vk.com/images/camera_200.png";

    let inspectorInstancePayload: InspectorInstancePayload | undefined;
    if (location) {
      inspectorInstancePayload = {
        wallVkId: location.wallVkId,
        postVkId: location.postVkId,
        commentVkId: location.commentVkId,
        commenterVkDomain: vkDomain,
        commenterName,
        commenterAvatarUrl,
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
        bn:ml-[8px]
        bn:box-content bn:translate-y-[3px] bn:opacity-100
      `),
      actionsActionClassName: cn("bn:ml-2"),
      actionTooltipHoverClassName: cn("bn:group-hover/link:opacity-60"),
      inspectorInstancePayload,
    });
    return () => {
      ui.destroy();
    };
  },
});
