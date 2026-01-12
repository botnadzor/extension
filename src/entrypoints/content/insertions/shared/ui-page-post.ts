import {
  type ContentId,
  type VkDomain,
  vkDomainSchema,
} from "@/lib/primitive-values";
import { cn, cnl } from "@/lib/utils";
import type { AccountAffiliation } from "@/services/affiliation-service";

import { renderAccountAction } from "./ui-account-action";
import { renderInlineBadge } from "./ui-badge";

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
    const base = accountAffiliation.color;
    headerContainer.style.setProperty("--bn-page-post-affiliation-color", base);
    headerContainer.style.setProperty(
      "--bn-page-post-affiliation-border",
      "color-mix(in srgb, var(--bn-page-post-affiliation-color) 80%, rgba(250 0 0))",
    );

    extraClassListTokens = cnl(`
      bn:rounded-t-[10px] bn:border-l-3
      bn:border-l-(--bn-page-post-affiliation-border)
      bn:bg-(--bn-page-post-affiliation-color) bn:pt-[10px]! bn:pb-[5px]!
      bn:dark:border-l-(--bn-page-post-affiliation-border)/50
      bn:dark:bg-(--bn-page-post-affiliation-color)/20
    `);
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
      headerContainer.style.removeProperty("--bn-page-post-affiliation-color");
      headerContainer.style.removeProperty("--bn-page-post-affiliation-border");
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
