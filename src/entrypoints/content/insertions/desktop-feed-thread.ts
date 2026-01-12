import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/lib/primitive-values";
import {
  affiliationService,
  commentCollectingService,
  frontendService,
} from "@/lib/proxy-services";
import { cn, cnl } from "@/lib/utils";
import type { InspectorInstancePayload } from "@/services/inspector-service";

import type { Insertion } from "../insertion-basics";
import type { CommentLocation } from "./shared/types";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  const match = /^\/(.+)$/.exec(href);
  return vkDomainSchema.safeParse(match?.[1]).data;
}

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const permalink = root.querySelector<HTMLAnchorElement>("a[href*='reply=']");
  if (!permalink) {
    return;
  }

  const href = permalink.getAttribute("href");
  if (!href) {
    return;
  }

  const match = /^\/(?:wall|video)(-?\d+)_(\d+)\?(?:[^#]*&)?reply=(\d+)/.exec(
    href,
  );

  if (!match) {
    return;
  }

  const wallIdNumber = Number(match[1]);
  const postIdNumber = Number(match[2]);
  const commentIdNumber = Number(match[3]);

  return {
    wallVkId: vkIdSchema.parse(wallIdNumber),
    postVkId: vkIdSchema.parse(postIdNumber),
    commentVkId: vkIdSchema.parse(commentIdNumber),
  };
}

function extractCommenterName(root: HTMLElement): string | undefined {
  const nameCandidate = root.querySelector<HTMLElement>(
    '[data-testid="comment-owner"]',
  );

  if (!nameCandidate) {
    return;
  }

  const raw = nameCandidate.textContent;
  if (!raw) {
    return;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return;
  }

  return trimmed;
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
  if (trimmed.length === 0) {
    return;
  }

  return trimmed;
}

function extractPostCommentCount(root: HTMLElement): number | undefined {
  const postRoot = root.closest('[data-testid="post"]');
  if (!(postRoot instanceof HTMLElement)) {
    return;
  }

  const commentsButton = postRoot.querySelector<HTMLElement>(
    '[data-testid="post_footer_action_comment"]',
  );

  if (!commentsButton) {
    return;
  }

  const aria = commentsButton.getAttribute("aria-label");
  if (!aria) {
    return;
  }

  const trimmed = aria.trim();
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

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="wall_comments_comment_in_thread"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector('[data-testid="comment-avatar"]');
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor = element.querySelector(
      "[class*=vkitCommentBase__title]",
    );

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      logger.warn("Registration date anchor not found at desktop-feed-thread");
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
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

    const badgeAnchor =
      commentContent.querySelector<HTMLAnchorElement>("a[href^='/']") ??
      authorLink;

    const actionAnchor = element.querySelector<HTMLElement>(
      '[data-testid="comment-share"]',
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
          bn:mr-[-2px] bn:mb-[-5px] bn:ml-[2px] bn:border-l-3
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

    const location = extractCommentLocation(element);
    if (!location) {
      logger.warn("Unable to parse comment permalink for inspector");
    }

    let commenterName = extractCommenterName(element);
    if (!commenterName) {
      const raw = authorLink.textContent;
      if (raw) {
        const trimmed = raw.trim();
        commenterName = trimmed.length > 0 ? trimmed : vkDomain;
      } else {
        commenterName = vkDomain;
      }
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

    commentContent.classList.add(...cnl("bn:group"));

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
      if (overlay) {
        overlay.remove();
      }

      if (addedClasses.length > 0) {
        commentContent.classList.remove(...addedClasses);
      }
      commentContent.classList.remove(...cnl("bn:group"));
      commentContent.style.removeProperty("--bn-inline-affiliation-color");
      commentContent.style.removeProperty("--bn-inline-affiliation-border");
      badgeUI?.destroy();
      actionUI?.destroy();
    };
  },
};

export default insertion;
