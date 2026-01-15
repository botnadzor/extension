import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/primitive-values";
import {
  affiliationService,
  commentCollectingService,
  frontendService,
} from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";

export function extractVkDomain(
  authorLink: HTMLAnchorElement,
): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  const match = /^\/(.+)$/.exec(href);
  return vkDomainSchema.safeParse(match?.[1]).data;
}

export function extractLocationFromHref(
  href: string,
): CommentLocation | undefined {
  const wallRegexp = /(?:^|\/)(?:wall|video|photo)(-?\d+)_(\d+)/;
  const wallMatch = wallRegexp.exec(href);
  if (!wallMatch) {
    return;
  }

  const wallVkId = vkIdSchema.parse(Number(wallMatch[1]));
  const postVkId = vkIdSchema.parse(Number(wallMatch[2]));

  const replyRegexp = /[?&]reply=(\d+)/;
  const replyMatch = replyRegexp.exec(href);
  if (!replyMatch) {
    return;
  }

  const commentVkId = vkIdSchema.parse(Number(replyMatch[1]));

  return { wallVkId, postVkId, commentVkId };
}

function extractLocationFromOnclick(
  onclick: string,
): CommentLocation | undefined {
  const wallLike = /replyClick\('wall(-?\d+)_(\d+)'\s*,\s*(\d+)/.exec(onclick);
  if (wallLike) {
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

  const photoLike = /replyClick\('(-?\d+)_photo(\d+)'\s*,\s*(\d+)/.exec(
    onclick,
  );
  if (photoLike) {
    const ownerNumber = Number(photoLike[1]);
    const photoNumber = Number(photoLike[2]);
    const commentNumber = Number(photoLike[3]);

    if (
      !Number.isFinite(ownerNumber) ||
      !Number.isFinite(photoNumber) ||
      !Number.isFinite(commentNumber)
    ) {
      return;
    }

    return {
      wallVkId: vkIdSchema.parse(ownerNumber),
      postVkId: vkIdSchema.parse(photoNumber),
      commentVkId: vkIdSchema.parse(commentNumber),
    };
  }

  const plainLike = /replyClick\('(-?\d+)_(\d+)'\s*,\s*(\d+)/.exec(onclick);
  if (plainLike) {
    const ownerNumber = Number(plainLike[1]);
    const postNumber = Number(plainLike[2]);
    const commentNumber = Number(plainLike[3]);

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

  return;
}

export function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const linkWithReply =
    root.querySelector<HTMLAnchorElement>("a[href*='reply=']");
  const href = linkWithReply?.getAttribute("href");
  if (href) {
    const fromHref = extractLocationFromHref(href);
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
  const author = root.querySelector<HTMLElement>(".reply_author .author");
  if (!author) {
    return;
  }

  const raw = author.textContent;
  if (!raw) {
    return;
  }

  const text = raw.trim();
  if (text.length === 0) {
    return;
  }

  return text;
}

function extractCommenterAvatarUrl(root: HTMLElement): string | undefined {
  const img =
    root.querySelector<HTMLImageElement>(".reply_image img") ??
    root.querySelector<HTMLImageElement>(".reply_author img");

  const src = img?.getAttribute("src");
  if (!src) {
    return;
  }

  const trimmed = src.trim();
  if (trimmed.length === 0) {
    return;
  }

  return trimmed;
}

function extractPostCommentCount(root: HTMLElement): number | undefined {
  const postRoot = root.closest(".reply._post");

  if (!(postRoot instanceof HTMLElement)) {
    return;
  }

  const commentsButton = postRoot.querySelector<HTMLElement>(
    ".PostBottomAction.comment._comment._reply_wrap",
  );

  if (!commentsButton) {
    return;
  }

  const attr = commentsButton.dataset["count"];
  if (!attr) {
    return;
  }

  const trimmed = attr.trim();
  if (trimmed.length === 0) {
    return;
  }

  const digitsOnly = trimmed.replaceAll(/\D+/g, "");
  if (digitsOnly.length === 0) {
    return;
  }

  const value = Number(digitsOnly);
  if (!Number.isFinite(value)) {
    return;
  }

  return value;
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

    const content = element.querySelector<HTMLElement>(".content");
    if (!content) {
      return;
    }

    const replyRoot = content.querySelector<HTMLElement>(".reply");
    if (!replyRoot) {
      return;
    }

    const footer = replyRoot.querySelector<HTMLElement>(".reply_footer");
    if (!footer) {
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
      void commentCollectingService.registerIfNeeded({
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
