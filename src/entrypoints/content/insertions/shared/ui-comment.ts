import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import type { ContentId } from "@/shared/@primitives/misc";
import type { VkDomain } from "@/shared/@primitives/vk";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import {
  applyInlineAffiliationVars,
  clearInlineAffiliationVars,
  inlineAffiliationStripClassListTokens,
} from "./affiliation-highlight-style";
import { renderAccountAction } from "./ui-account-action";
import { renderInlineBadge } from "./ui-badge";

export type RenderCommentUiOptions = {
  vkDomain: VkDomain;
  accountAffiliation?: AccountAffiliation | undefined;
  frontendBaseUrl: string;
  contentId: ContentId;
  commentContent: HTMLElement;
  badgeAnchor: HTMLElement;
  actionAnchor: HTMLElement | undefined;
  registrationDateAnchor: HTMLElement;
  badgeClassName?: string;
  containerClassName?: string;
  actionsActionClassName?: string;
  iconClassName?: string;
  actionTooltipHoverClassName?: string;
  inspectorInstancePayload?: InspectorInstancePayload | undefined;
};

export function renderCommentUi({
  vkDomain,
  accountAffiliation,
  frontendBaseUrl,
  contentId,
  commentContent,
  badgeAnchor,
  actionAnchor,
  registrationDateAnchor,
  containerClassName,
  actionsActionClassName,
  iconClassName,
  actionTooltipHoverClassName,
  inspectorInstancePayload,
}: RenderCommentUiOptions): { destroy: () => void } {
  let badgeUI: ReturnType<typeof renderInlineBadge> | undefined;
  let actionUI: ReturnType<typeof renderAccountAction> | undefined;
  let extraClassListTokens: string[] = [];

  if (accountAffiliation && !accountAffiliation.hidden) {
    applyInlineAffiliationVars(commentContent, accountAffiliation.color);
    extraClassListTokens = cnl(
      ...inlineAffiliationStripClassListTokens,
      `
        bn:mt-[-2px] bn:mr-[-2px] bn:mb-[-5px] bn:px-[2px] bn:pt-[2px]
        bn:pb-[5px]
      `,
    );
    commentContent.classList.add(...extraClassListTokens);

    badgeUI = renderInlineBadge({
      mountAfter: badgeAnchor,
      tags: accountAffiliation.tags,
      className: cn("bn:px-[2px]"),
    });
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
      className: containerClassName,
      actionClassName: actionsActionClassName,
      iconClassName,
      showTooltip: true,
      tooltipHoverClassName: actionTooltipHoverClassName,
      inspectorInstancePayload,
    });

    actionAnchor.after(actionUI.element);
  }

  return {
    destroy() {
      if (accountAffiliation && !accountAffiliation.hidden) {
        clearInlineAffiliationVars(commentContent);
        commentContent.classList.remove(...extraClassListTokens);
      }

      badgeUI?.destroy();
      actionUI?.destroy();
    },
  };
}
