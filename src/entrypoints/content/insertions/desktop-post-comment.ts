import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import { vkIdSchema } from "@/shared/@model/primitives";
import {
  affiliationService,
  commentCollectingService,
  frontendService,
} from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  extractCommentLocationFromHref,
  extractCommentLocationFromReplyClick,
  extractVkDomainFromAuthorLink,
} from "./shared/comment-location";
import {
  extractCommenterAvatarUrlBySelector,
  extractCommenterNameBySelector,
  extractPostCommentCountFromDataset,
} from "./shared/comment-meta";
import type { CommentLocation } from "./shared/types";
import { renderCommentUi } from "./shared/ui-comment";

function extractCommentLocation(
  root: HTMLElement,
): CommentLocation | undefined {
  const permalink =
    root.querySelector("a[href*='reply=']") ??
    root.querySelector<HTMLAnchorElement>(
      "a[href*='/wall'], a[href*='/video'], a[href*='/photo']",
    );

  if (!(permalink instanceof HTMLAnchorElement)) {
    return;
  }

  const href = permalink.getAttribute("href");
  if (href) {
    const fromHref = extractCommentLocationFromHref(href);
    if (fromHref) {
      return fromHref;
    }
  }

  const onclickHost =
    (root.hasAttribute("onclick") ? root : undefined) ??
    root.querySelector<HTMLElement>("[onclick*='replyClick']");

  const onclick = onclickHost?.getAttribute("onclick");
  if (onclick) {
    const fromOnclick = extractCommentLocationFromReplyClick(onclick);
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

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply._post",

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(".reply_author .author");

    if (!authorLink || !(authorLink instanceof HTMLAnchorElement)) {
      // Deleted comment
      return;
    }

    const vkDomain = extractVkDomainFromAuthorLink(authorLink);
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

    let commenterName =
      extractCommenterNameBySelector(element, ".reply_author.author") ??
      vkDomain;

    if (!commenterName) {
      const raw = authorLink.textContent;
      commenterName = raw && raw.trim().length > 0 ? raw.trim() : vkDomain;
    }

    const commenterAvatarUrl =
      extractCommenterAvatarUrlBySelector(element, [
        ".reply_image img",
        ".reply_author img",
      ]) ?? "https://vk.com/images/camera_200.png";

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
      const postCommentCount = extractPostCommentCountFromDataset(element, {
        postRootSelector: ".reply._post",
        commentButtonSelector: ".PostBottomAction.comment._comment._reply_wrap",
        datasetKey: "count",
      });
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
