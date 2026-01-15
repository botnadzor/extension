import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/primitive-values";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  const videoMatch = /^(?:https?:\/\/[^/]+)?\/video\/@?([^/?#]+)/.exec(href);
  const videoDomain = vkDomainSchema.safeParse(videoMatch?.[1]).data;

  if (videoDomain) {
    return videoDomain;
  }

  const directMatch = /^(?:https?:\/\/[^/]+)?\/([^/?#]+)/.exec(href);
  return vkDomainSchema.safeParse(directMatch?.[1]).data;
}

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

function extractCommenterName(root: HTMLElement): string | undefined {
  const nameCandidate = root.querySelector<HTMLElement>(
    '[data-testid="comment-owner"]',
  );

  const raw = nameCandidate?.textContent;
  if (!raw) {
    return;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractCommenterAvatarUrl(root: HTMLElement): string | undefined {
  const img =
    root.querySelector<HTMLImageElement>(
      '[data-testid="comment-avatar"] img',
    ) ?? root.querySelector<HTMLImageElement>("img");

  const src = img?.getAttribute("src");
  if (!src) {
    return;
  }

  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

    const vkDomain = extractVkDomain(authorLink);
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

      overlay = document.createElement("div");
      overlay.classList.add(
        ...cnl(`
          bn:pointer-events-none bn:absolute bn:inset-0 bn:-z-10 bn:mt-[-2px]
          bn:mr-[-2px] bn:mb-[-5px] bn:ml-[6px] bn:border-l-3
          bn:border-l-(--bn-inline-affiliation-border)
          bn:bg-(--bn-inline-affiliation-color) bn:px-[2px] bn:pt-[2px]
          bn:pb-[5px]
          bn:dark:border-l-(--bn-inline-affiliation-border)/50
          bn:dark:bg-(--bn-inline-affiliation-color)/20
        `),
      );
      commentContent.style.setProperty(
        "--bn-inline-affiliation-color",
        accountAffiliation.color,
      );

      commentContent.style.setProperty(
        "--bn-inline-affiliation-border",
        "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
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

    let commenterName = extractCommenterName(element);
    if (!commenterName) {
      const raw = badgeAnchor.textContent;
      const fallback = raw && raw.trim().length > 0 ? raw.trim() : vkDomain;
      commenterName = fallback;
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

      commentContent.style.removeProperty("--bn-inline-affiliation-color");
      commentContent.style.removeProperty("--bn-inline-affiliation-border");

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
