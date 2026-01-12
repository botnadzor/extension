import type { ContentId, VkDomain } from "@/lib/primitive-values";
import { cn, cnl } from "@/lib/utils";
import type { AccountAffiliation } from "@/services/affiliation-service";
import type { InspectorInstancePayload } from "@/services/inspector-service";

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
    commentContent.style.setProperty(
      "--bn-inline-affiliation-color",
      accountAffiliation.color,
    );

    commentContent.style.setProperty(
      "--bn-inline-affiliation-border",
      "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
    );

    extraClassListTokens = cnl(
      `
        bn:mt-[-2px] bn:mr-[-2px] bn:mb-[-5px] bn:border-l-3
        bn:border-l-(--bn-inline-affiliation-border)
        bn:bg-(--bn-inline-affiliation-color) bn:px-[2px] bn:pt-[2px]
        bn:pb-[5px]
        bn:dark:border-l-(--bn-inline-affiliation-border)/50
        bn:dark:bg-(--bn-inline-affiliation-color)/20
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
      className: cn(containerClassName),
      actionClassName: cn(actionsActionClassName),
      iconClassName: cn(iconClassName),
      showTooltip: true,
      tooltipHoverClassName: cn(actionTooltipHoverClassName),
      inspectorInstancePayload,
    });

    actionAnchor.after(actionUI.element);
  }

  return {
    destroy() {
      if (accountAffiliation && !accountAffiliation.hidden) {
        commentContent.style.removeProperty("--bn-inline-affiliation-color");
        commentContent.style.removeProperty("--bn-inline-affiliation-border");
        commentContent.classList.remove(...extraClassListTokens);
      }

      badgeUI?.destroy();
      actionUI?.destroy();
    },
  };
}
