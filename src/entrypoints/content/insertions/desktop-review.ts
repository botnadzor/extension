import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import { positiveVkIdSchema, vkIdSchema } from "@/shared/@model/primitives";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import { extractVkDomainFromAuthorLink } from "./shared/comment-location";
import {
  extractCommenterNameBySelector,
  getCommenterAvatarUrlWithFallback,
} from "./shared/comment-meta";
import type { ReviewLocation } from "./shared/types";
import { renderCommentUi } from "./shared/ui-comment";

function extractReviewLocation(root: HTMLElement): ReviewLocation | undefined {
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
  const reviewVkId = positiveVkIdSchema.parse(reviewNumber);

  return {
    wallVkId,
    reviewVkId,
  };
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="review"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      '[data-testid="review-avatar-link"]',
    );

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

    const spacer = authorLink.nextElementSibling;
    const commentContent = spacer?.nextElementSibling;
    if (!(commentContent instanceof HTMLElement)) {
      return;
    }

    const nameElement = element.querySelector('[data-testid="review-name"]');
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

    const actionAnchor = element.querySelector('[data-testid="review-reply"]');

    if (!(actionAnchor instanceof HTMLElement)) {
      return;
    }

    const location = extractReviewLocation(element);
    if (!location) {
      logger.warn("Unable to parse review location for inspector");
    }

    const commenterName =
      extractCommenterNameBySelector(element, '[data-testid="review-name"]') ??
      vkDomain;

    const commenterAvatarUrl = getCommenterAvatarUrlWithFallback(element, [
      '[data-testid="review-avatar-link"] img',
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
          type: "review",
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
});
