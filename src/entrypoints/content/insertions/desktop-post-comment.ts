import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/@model/primitives";
import {
  affiliationService,
  commentCollectingService,
  frontendService,
} from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

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
  if (directDomain) {
    return directDomain;
  }

  const videoMatch = /^(?:https?:\/\/[^/]+)?\/video\/@?([^/?#]+)/.exec(href);
  const videoDomain = vkDomainSchema.safeParse(videoMatch?.[1]).data;

  if (videoDomain) {
    return videoDomain;
  }

  return;
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

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const permalink =
    root.querySelector<HTMLAnchorElement>("a[href*='reply=']") ??
    root.querySelector<HTMLAnchorElement>(
      "a[href*='/wall'], a[href*='/video'], a[href*='/photo']",
    );

  const href = permalink?.getAttribute("href");
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

  const postRoot = root.closest<HTMLElement>(".reply._post") ?? root;

  const idSource = postRoot.dataset["postId"] ?? postRoot.getAttribute("id");
  if (!idSource) {
    return;
  }

  const idMatch =
    /post(-?\d+)_(\d+)$/.exec(idSource) ?? /(-?\d+)_(\d+)$/.exec(idSource);

  if (!idMatch) {
    return;
  }

  const ownerNumber = Number(idMatch[1]);
  const commentNumber = Number(idMatch[2]);
  if (!Number.isFinite(ownerNumber) || !Number.isFinite(commentNumber)) {
    return;
  }

  const wallVkId = vkIdSchema.parse(ownerNumber);
  const postVkId = vkIdSchema.parse(commentNumber);
  const commentVkId = vkIdSchema.parse(commentNumber);

  return { wallVkId, postVkId, commentVkId };
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

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply._post",

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(".reply_author .author");

    if (!authorLink || !(authorLink instanceof HTMLAnchorElement)) {
      // Deleted comment
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      logger.warn("Unable to determine author's VK domain");
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const commentContent = element.querySelector(".reply_content");
    if (!(commentContent instanceof HTMLElement)) {
      return;
    }

    const badgeAnchor =
      element.querySelector<HTMLElement>(
        ".reply_author .image_status__status",
      ) ?? element.querySelector<HTMLElement>(".reply_author .author");

    if (!badgeAnchor) {
      return;
    }

    const registrationDateAnchor = authorLink.parentElement;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      return;
    }

    const showMoreLink = element.querySelector<HTMLAnchorElement>(
      "a.wall_reply_more_redesign_2024",
    );

    if (showMoreLink && accountAffiliation) {
      showMoreLink.style.setProperty("background", "none");
      showMoreLink.style.setProperty("background-image", "none");
    }

    commentContent.classList.add(...cnl("bn:group"));

    const shareWrap = element.querySelector<HTMLElement>(
      ".reply_link_wrap.share_link_wrap",
    );
    const linkWrap = element.querySelector<HTMLElement>(".reply_link_wrap");
    const actionAnchor = shareWrap ?? linkWrap ?? undefined;

    const isPhotoLayout = shareWrap === null && linkWrap !== null;
    const actionsContainerClassName =
      isPhotoLayout && accountAffiliation
        ? cn(`
          bn:float-left bn:-translate-x-[8px] bn:translate-y-[4px] bn:pb-[6px]
          bn:opacity-0
          bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
        `)
        : cn(`
          bn:translate-x-[5px] bn:opacity-0
          bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
        `);

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

    const ui = renderCommentUi({
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      commentContent,
      badgeAnchor,
      actionAnchor,
      registrationDateAnchor,
      containerClassName: cn(
        `
          bn:translate-x-1 bn:opacity-0
          bn:group-hover:pointer-events-auto bn:group-hover:opacity-100
        `,
        actionsContainerClassName,
      ),
      actionsActionClassName: cn("bn:ml-2"),
      iconClassName: cn("bn:opacity-50"),
      actionTooltipHoverClassName: cn("bn:group-hover/link:opacity-60"),
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

    return () => {
      commentContent.classList.remove(...cnl("bn:group"));

      if (showMoreLink) {
        showMoreLink.style.removeProperty("background");
        showMoreLink.style.removeProperty("background-image");
      }

      ui.destroy();
    };
  },
});
