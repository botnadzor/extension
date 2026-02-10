import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ContentId } from "@/shared/@primitives/misc";
import type { VkDomain } from "@/shared/@primitives/vk";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import {
  applyPagePostAffiliationVars,
  clearPagePostAffiliationVars,
  pagePostHeaderHighlightClassListTokens,
} from "./affiliation-highlight-style";
import { renderAccountAction } from "./ui-account-action";
import { renderInlineBadge } from "./ui-badge";
import { extractVkDomainFromHref } from "./vk-identifies";

export function extractVkDomain(
  authorLink: HTMLAnchorElement,
): VkDomain | undefined {
  return extractVkDomainFromHref(authorLink.getAttribute("href"));
}

export type RenderPostUiOptions = {
  vkDomain: VkDomain;
  accountAffiliation?: AccountAffiliation | undefined;
  frontendBaseUrl: string;
  contentId: ContentId;
  headerContainer: HTMLElement;
  badgeAnchor: HTMLElement;
  actionAnchor?: HTMLElement;
};

export function renderPostUI({
  vkDomain,
  accountAffiliation,
  frontendBaseUrl,
  contentId,
  headerContainer,
  badgeAnchor,
  actionAnchor,
}: RenderPostUiOptions): { destroy: () => void } {
  headerContainer.classList.add(...cnl("bn:group"));

  let registrationDateAnchor = badgeAnchor.classList.contains(
    "PostHeaderTitle__authorBlock",
  )
    ? badgeAnchor.parentElement?.parentElement?.parentElement
    : badgeAnchor.parentElement;

  if (!(registrationDateAnchor instanceof HTMLElement)) {
    // Fall back in case of unexpected structure
    registrationDateAnchor = badgeAnchor;
  }

  const actionUI = renderAccountAction({
    design: "desktop",
    vkDomain,
    accountAffiliation,
    frontendBaseUrl,
    contentId,
    badgeAnchor,
    registrationDateAnchor,
    className: cn("bn:opacity-100"),
    actionClassName: cn("bn:ml-1 bn:rounded-md bn:text-text-link"),
    showTooltip: true,
  });

  let badgeUI: ReturnType<typeof renderInlineBadge> | undefined;
  let extraClassListTokens: string[] = [];
  let row: HTMLDivElement | undefined;

  if (accountAffiliation) {
    applyPagePostAffiliationVars(headerContainer, accountAffiliation.color);

    extraClassListTokens = [...pagePostHeaderHighlightClassListTokens];
    headerContainer.classList.add(...extraClassListTokens);

    badgeUI = renderInlineBadge({
      mountAfter: badgeAnchor,
      tags: accountAffiliation.tags,
      className: cn("bn:px-[2px]"),
    });

    row = document.createElement("div");
    row.classList.add(
      ...cnl(
        `
          bn:relative bn:z-20 bn:inline-flex bn:items-center
          bn:whitespace-nowrap
        `,
      ),
    );
    row.append(badgeUI.element, actionUI.element);

    const mountTarget = actionAnchor ?? badgeAnchor;
    mountTarget.after(row);

    const wrapParent = mountTarget.parentElement;
    if (wrapParent) {
      wrapParent.classList.add(
        ...cnl("bn:flex bn:flex-wrap bn:items-center bn:gap-1"),
      );
    }
  }

  return {
    destroy() {
      headerContainer.classList.remove(...cnl("bn:group"));
      clearPagePostAffiliationVars(headerContainer);
      headerContainer.classList.remove(...extraClassListTokens);

      const wrapParent = badgeAnchor.parentElement;
      wrapParent?.classList.remove(
        ...cnl("bn:flex bn:flex-wrap bn:items-center bn:gap-1"),
      );

      row?.remove();
      badgeUI?.destroy();
      actionUI.destroy();
    },
  };
}
