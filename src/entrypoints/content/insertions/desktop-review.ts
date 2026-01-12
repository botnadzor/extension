import {
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/lib/primitive-values";
import { affiliationService, frontendService } from "@/lib/proxy-services";
import { cn } from "@/lib/utils";
import type { InspectorInstancePayload } from "@/services/inspector-service";

import type { Insertion } from "../insertion-basics";
import type { CommentLocation } from "./shared/types";
import { renderCommentUi } from "./shared/ui-comment";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  const match = /^\/(.+)$/.exec(href);
  return vkDomainSchema.safeParse(match?.[1]).data;
}

function extractReviewLocation(root: HTMLElement): CommentLocation | undefined {
  const idAttr = root.getAttribute("id");
  if (!idAttr) {
    return;
  }

  const match = /^review-(-?\d+)_(\d+)$/.exec(idAttr);
  if (!match) {
    return;
  }

  const ownerNumber = Number(match[1]);
  const reviewNumber = Number(match[2]);

  if (!Number.isFinite(ownerNumber) || !Number.isFinite(reviewNumber)) {
    return;
  }

  const wallVkId = vkIdSchema.parse(ownerNumber);
  const reviewVkId = vkIdSchema.parse(reviewNumber);

  return {
    wallVkId,
    postVkId: reviewVkId,
    commentVkId: reviewVkId,
  };
}

function extractReviewerName(root: HTMLElement): string | undefined {
  const nameNode = root.querySelector<HTMLElement>(
    '[data-testid="review-name"]',
  );

  const raw = nameNode?.textContent;
  if (!raw) {
    return;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function extractReviewerAvatarUrl(root: HTMLElement): string | undefined {
  const img = root.querySelector<HTMLImageElement>(
    '[data-testid="review-avatar-link"] img',
  );

  const src = img?.getAttribute("src");
  if (!src) {
    return;
  }

  const trimmed = src.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="review"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      '[data-testid="review-avatar-link"]',
    );

    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const spacer = authorLink.nextElementSibling;
    const commentContent = spacer?.nextElementSibling;
    if (!(commentContent instanceof HTMLElement)) {
      return;
    }

    const nameElement = element.querySelector<HTMLElement>(
      '[data-testid="review-name"]',
    );
    const badgeAnchor = nameElement?.closest("a");

    if (!(badgeAnchor instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor =
      badgeAnchor.parentElement?.parentElement?.parentElement?.parentElement ??
      undefined;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      return;
    }

    const actionAnchor = element.querySelector<HTMLElement>(
      '[data-testid="review-reply"]',
    );

    if (!actionAnchor) {
      return;
    }

    const location = extractReviewLocation(element);
    if (!location) {
      logger.warn("Unable to parse review location for inspector");
    }

    const commenterName = extractReviewerName(element) ?? vkDomain;

    const commenterAvatarUrl =
      extractReviewerAvatarUrl(element) ??
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
      registrationDateAnchor,
      badgeAnchor,
      actionAnchor,
      containerClassName: cn(
        "bn:translate-x-[5px] bn:gap-[5px] bn:opacity-100",
      ),
      actionsActionClassName: cn("bn:opacity-100"),
      inspectorInstancePayload,
    });

    return () => {
      ui.destroy();
    };
  },
};

export default insertion;
