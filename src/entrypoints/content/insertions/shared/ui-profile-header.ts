import type { Logger } from "@logtape/logtape";

import {
  type ContentId,
  type VkDomain,
  vkDomainSchema,
} from "@/lib/primitive-values";
import { affiliationService } from "@/lib/proxy-services";
import { cn, cnl } from "@/lib/utils";
import type { AccountAffiliation } from "@/services/affiliation-service";

import { renderAccountAction } from "./ui-account-action";
import { renderInlineBadge } from "./ui-badge";

export type ProfileHeaderProps = {
  element: Element;
  logger?: Logger;
  nameSelector: string;
};

export type ProfileHeaderResult = {
  accountAffiliation: AccountAffiliation | undefined;
  vkDomain: VkDomain;
  nameElement: HTMLElement;
};

export async function getProfileHeader({
  element,
  logger,
  nameSelector,
}: ProfileHeaderProps): Promise<ProfileHeaderResult | undefined> {
  const vkDomainMatch = /^\/([^/?#]+)/.exec(location.pathname);
  const vkDomain = vkDomainSchema.safeParse(vkDomainMatch?.[1]).data;

  if (!vkDomain) {
    logger?.warn("Unable to determine profile VK domain");
    return;
  }

  const accountAffiliation = await affiliationService.checkAccount(vkDomain);

  const nameElement = element.querySelector<HTMLElement>(nameSelector);
  if (!(nameElement instanceof HTMLElement)) {
    return;
  }

  return { vkDomain, accountAffiliation, nameElement };
}

export function renderDesktopProfileHeaderUi({
  nameElement,
  vkDomain,
  accountAffiliation,
  frontendBaseUrl,
  contentId,
}: {
  nameElement: HTMLElement;
  vkDomain: VkDomain;
  accountAffiliation: AccountAffiliation | undefined;
  frontendBaseUrl: string;
  contentId: ContentId;
}): { destroy: () => void } {
  const badgeUI = accountAffiliation
    ? renderInlineBadge({
        mountAfter: nameElement,
        tags: accountAffiliation.tags,
        textColor: cn("bn:text-white"),
        background: accountAffiliation.color,
        className: cn("bn:mr-[10px] bn:rounded-[3px] bn:px-[6px] bn:py-[3px]"),
      })
    : undefined;

  const actionUI = renderAccountAction({
    design: "desktop",
    vkDomain,
    accountAffiliation,
    frontendBaseUrl,
    contentId,
    badgeAnchor: nameElement,
    registrationDateAnchor: nameElement,
    className: cn("bn:opacity-100"),
    actionClassName: cn("bn:mr-1 bn:text-text-link"),
    showTooltip: { direction: "down" },
    tooltipHoverClassName: cn("bn:group-hover/link:opacity-80"),
  });

  const row = document.createElement("div");
  row.classList.add(...cnl("bn:inline-flex bn:items-center bn:gap-2"));

  if (badgeUI) {
    row.append(badgeUI.element);
  }

  row.append(actionUI.element);
  nameElement.after(row);

  return {
    destroy() {
      row.classList.remove(...cnl("bn:inline-flex bn:items-center bn:gap-2"));
      badgeUI?.destroy();
      actionUI.destroy();
    },
  };
}

export function renderMobileProfileHeaderUI({
  nameElement,
  vkDomain,
  accountAffiliation,
  frontendBaseUrl,
  contentId,
}: {
  nameElement: HTMLElement;
  vkDomain: VkDomain;
  accountAffiliation: AccountAffiliation | undefined;
  frontendBaseUrl: string;
  contentId: ContentId;
}): { destroy: () => void } {
  nameElement.parentElement?.classList.add(...cnl("bn:text-center"));

  const badgeUI = accountAffiliation
    ? renderInlineBadge({
        mountAfter: nameElement,
        tags: accountAffiliation.tags,
        textColor: cn("bn:text-white"),
        background: accountAffiliation.color,
        className: cn("bn:mr-[10px] bn:rounded-[3px] bn:px-[6px] bn:py-[3px]"),
      })
    : undefined;

  const actionUI = renderAccountAction({
    design: "mobile",
    vkDomain,
    accountAffiliation,
    frontendBaseUrl,
    contentId,
    badgeAnchor: nameElement,
    registrationDateAnchor: nameElement,
    className: cn("bn:opacity-100"),
    actionClassName: cn("bn:mr-1 bn:mb-1 bn:text-text-link"),
    showTooltip: false,
  });

  badgeUI?.element.after(actionUI.element);

  return {
    destroy() {
      badgeUI?.destroy();
      actionUI.destroy();
    },
  };
}
