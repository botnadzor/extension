import type { Logger } from "@logtape/logtape";

import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ActionBarPlacementSchema } from "@/shared/@model/insertion-configs/shared/primitives";
import type {
  InspectorInstancePayload,
  InspectorTrigger,
} from "@/shared/@model/inspector";
import type { ContentId } from "@/shared/@primitives/misc";
import {
  type AccountIdentifier,
  stringifyAccountIdentifier,
  vkDomainSchema,
} from "@/shared/@primitives/vk";
import { omitUndefined } from "@/shared/omit-undefined";
import { cn, cnt } from "@/shared/tailwindcss-helpers";
import { generateCardUrl, generateUrl } from "@/shared/url-helpers";

import type { DerivedPageInfo } from "../../../derived-page-info";
import type { AvailableServiceLookup } from "../../../insertion-variant-typings";
import { createInsertionUi, type InsertionUi } from "./helpers";
import { createIconElement, type IconId } from "./icons";
import type { RegDateInfo } from "./reg-date";
import { createTooltipUi, type TooltipDirection } from "./tooltip";

function handleAnyButtonClick(event: Event | MouseEvent) {
  // If placed inside <a>, prevent navigation (We should aim to avoid nested links, but they sometimes wrap the entire insertion)
  event.preventDefault();

  // Ensure the click event is not propagated to the parent element
  event.stopPropagation();
}

function handleAnyLinkClick(event: Event | MouseEvent) {
  // Ensure the click event is not propagated to the parent element
  event.stopPropagation();
}

export function createActionUi<TagName extends "a" | "button">({
  className,
  derivedPageInfo,
  tagName,
  tooltipDirection,
}: {
  className?: string | undefined;
  derivedPageInfo?: DerivedPageInfo | undefined;
  tagName: TagName;
  tooltipDirection: TooltipDirection;
}): InsertionUi<
  {
    ariaLabel: string;
    icon: IconId;
    iconClassName?: string;
    tooltip: boolean;
  },
  HTMLElementTagNameMap[TagName]
> {
  const element = document.createElement(tagName);

  if (tagName === "button") {
    element.setAttribute("type", "button"); // default is type="submit"
    element.addEventListener("click", handleAnyButtonClick);
  } else {
    element.addEventListener("click", handleAnyLinkClick);
  }

  element.className = cn(
    `
      bn:group/action
      bn:relative bn:box-border bn:inline-flex bn:h-[18px] bn:cursor-pointer
      bn:items-center bn:justify-center bn:rounded-[3px] bn:border-none
      bn:bg-(--bn-inline-action-background-color) bn:p-[0px] bn:text-link
      bn:transition-opacity bn:duration-200 bn:ease-in-out
      bn:focus-visible:opacity-100!
      bn:pointer-fine:opacity-0
      bn:pointer-fine:hover:opacity-100!
    `,

    // In nested insertions, multiple ancestors may have data-bn-insertion-instance-id.
    // These selectors intentionally react only to the nearest such ancestor for this
    // action button, so hovering/focusing an outer insertion does not reveal inner action bars.
    `
      bn:pointer-fine:[[data-bn-insertion-instance-id]:has(:focus-visible):not(:has([data-bn-insertion-instance-id]:has(:focus-visible)_&))_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:hover:not(:has([data-bn-insertion-instance-id]_&))_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:hover:not(:has([data-bn-insertion-instance-id]_&))_&]:duration-0
    `,
    // Extra fallback handles non-nested insertions where nearest-ancestor matching may not kick in.
    `
      bn:pointer-fine:[[data-bn-insertion-instance-id]:not(:has([data-bn-insertion-instance-id])):has(:focus-visible)_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:not(:has([data-bn-insertion-instance-id])):hover_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:not(:has([data-bn-insertion-instance-id])):hover_&]:duration-0
    `,

    // Slightly wider buttons to ease touch interaction + adjust for global
    derivedPageInfo?.websiteVariant === "mobileVkWebsite"
      ? "bn:w-[24px]"
      : "bn:w-[22px]",

    // Adjust for global outline styles
    derivedPageInfo?.websiteVariant === "mobileVkWebsite"
      ? "bn:outline-offset-1"
      : `
        bn:focus-visible:animate-vk-like-outline-expansion
        bn:focus-visible:rounded-none bn:focus-visible:outline-2!
        bn:focus-visible:outline-outline!
      `,
    className,
  );

  const tooltipUi = createTooltipUi({ direction: tooltipDirection });
  element.append(tooltipUi.element);

  if (tagName === "a") {
    element.setAttribute("rel", "noopener noreferrer");
    element.setAttribute("target", "_blank");
  }

  let previousAriaLabel: string | undefined;
  let previousIconClassName: string | undefined;
  let previousIconElement: SVGElement | undefined;
  let previousIconId: IconId | undefined;

  return {
    element,
    render: ({ ariaLabel, icon, iconClassName, tooltip }) => {
      if (ariaLabel !== previousAriaLabel) {
        previousAriaLabel = ariaLabel;
        element.setAttribute("aria-label", ariaLabel);
      }

      if (icon !== previousIconId || iconClassName !== previousIconClassName) {
        previousIconElement?.remove();

        const iconElement = createIconElement({
          iconId: icon,
          className: cn("bn:block bn:size-[16px] bn:shrink-0", iconClassName),
        });
        element.append(iconElement);

        previousIconClassName = iconClassName;
        previousIconElement = iconElement;
        previousIconId = icon;
      }

      tooltipUi.render({ text: tooltip ? ariaLabel : "" });
    },
    unmount: () => {
      element.remove();
    },
  };
}

function createBnPageAction({
  derivedPageInfo,
  tooltipDirection,
}: {
  derivedPageInfo: DerivedPageInfo;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountAffiliation?: AccountAffiliation;
  accountIdentifier: AccountIdentifier;
  frontendBaseUrl: string;
}> {
  const actionUi = createActionUi({
    derivedPageInfo,
    tagName: "a",
    tooltipDirection,
  });

  return {
    element: actionUi.element,

    render: ({ accountAffiliation, accountIdentifier, frontendBaseUrl }) => {
      actionUi.render({
        ariaLabel: "Комментарии",
        icon: "squareMenu",
        tooltip: true,
      });

      if (accountAffiliation?.botnadzorPage) {
        actionUi.element.hidden = false;
        actionUi.element.setAttribute(
          "href",
          generateUrl(
            frontendBaseUrl,
            `/account/${stringifyAccountIdentifier(accountIdentifier)}`,
          ),
        );
      } else {
        actionUi.element.hidden = true;
        actionUi.element.removeAttribute("href");
      }
    },

    unmount: () => {
      actionUi.unmount();
    },
  };
}

function createBnCardAction({
  derivedPageInfo,
  tooltipDirection,
}: {
  derivedPageInfo: DerivedPageInfo;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountAffiliation?: AccountAffiliation;
  accountIdentifier: AccountIdentifier;
  frontendBaseUrl: string;
}> {
  const actionUi = createActionUi({
    derivedPageInfo,
    tagName: "a",
    tooltipDirection,
  });

  return {
    element: actionUi.element,

    render: ({ accountAffiliation, accountIdentifier, frontendBaseUrl }) => {
      actionUi.render({
        ariaLabel: "Карточка",
        icon: "squareUser",
        tooltip: true,
      });

      if (accountAffiliation?.botnadzorCard) {
        actionUi.element.hidden = false;
        actionUi.element.setAttribute(
          "href",
          generateCardUrl({
            frontendBaseUrl,
            vkDomain: stringifyAccountIdentifier(accountIdentifier),
          }),
        );
      } else {
        actionUi.element.hidden = true;
        actionUi.element.removeAttribute("href");
      }
    },

    unmount: () => {
      actionUi.unmount();
    },
  };
}

function createInspectorButton({
  contentId,
  derivedPageInfo,
  serviceLookup,
  tooltipDirection,
}: {
  contentId: ContentId;
  derivedPageInfo: DerivedPageInfo;
  serviceLookup: AvailableServiceLookup;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountIdentifier: AccountIdentifier;
  accountName: string;
  accountAvatarUrl: string;
  inspectorTrigger?: InspectorTrigger;
}> {
  const actionUi = createActionUi({
    derivedPageInfo,
    tagName: "button",
    tooltipDirection,
  });

  let eventPayload: InspectorInstancePayload | undefined;

  function handleClick() {
    if (eventPayload) {
      void serviceLookup.inspectorService.trigger(contentId, eventPayload);
    }
  }

  actionUi.element.addEventListener("click", handleClick);

  return {
    element: actionUi.element,

    render: ({
      accountAvatarUrl,
      accountIdentifier,
      accountName,
      inspectorTrigger,
    }) => {
      // Inspector is only available for user accounts
      if (
        !inspectorTrigger ||
        (accountIdentifier.kind === "vkId" && accountIdentifier.prefix !== "id")
      ) {
        actionUi.element.hidden = true;
        return;
      }

      actionUi.element.hidden = false;

      actionUi.render({
        ariaLabel: "Инспектор",
        icon: "userSearch",
        tooltip: true,
      });

      eventPayload = {
        accountInfo: {
          avatarUrl: accountAvatarUrl,
          name: accountName,
          vkDomain: stringifyAccountIdentifier(accountIdentifier),
        },
        trigger: inspectorTrigger,
      };
    },

    unmount: () => {
      actionUi.unmount();
    },
  };
}

function createRegDateAction({
  contentId,
  derivedPageInfo,
  onRegDateInfoChange,
  serviceLookup,
  tooltipDirection,
}: {
  contentId: ContentId;
  derivedPageInfo: DerivedPageInfo;
  onRegDateInfoChange: (regDateInfo: RegDateInfo | undefined) => void;
  serviceLookup: AvailableServiceLookup;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountIdentifier: AccountIdentifier;
  regDateInfo?: RegDateInfo;
}> {
  const actionUi = createActionUi({
    derivedPageInfo,
    tagName: "button",
    tooltipDirection,
  });

  let lastAccountIdentifier: AccountIdentifier | undefined;
  let lastRegDateInfo: RegDateInfo | undefined;

  const fetchingCnTokens = cnt("bn:cursor-default", "bn:text-muted-foreground");

  function handleClick() {
    const accountIdentifier = lastAccountIdentifier;
    const regDateInfo = lastRegDateInfo;

    if (!accountIdentifier) {
      return;
    }

    if (regDateInfo?.status === "fetched") {
      onRegDateInfoChange(undefined);
      return;
    }

    if (regDateInfo?.status === "fetching") {
      return;
    }

    const vkDomainResult = vkDomainSchema.safeParse(
      accountIdentifier.kind === "vkId"
        ? `id${accountIdentifier.value}`
        : accountIdentifier.value,
    );
    if (!vkDomainResult.success) {
      return;
    }

    onRegDateInfoChange({ status: "fetching" });

    void serviceLookup.regDateService
      .obtain(vkDomainResult.data)
      .then((regDate) => {
        if (!regDate.problem) {
          onRegDateInfoChange({ status: "fetched", value: regDate.value });
          return;
        }

        onRegDateInfoChange(undefined);

        void serviceLookup.notificationService.trigger(contentId, {
          message: regDate.description,
          type:
            regDate.type === "bn:ext:invalid-access-code"
              ? "regDateUnauthorized"
              : regDate.type === "bn:ext:missing-permission"
                ? "regDateMissingPermission"
                : "regDateUnavailable",
        });
      });
  }

  actionUi.element.addEventListener("click", handleClick);

  return {
    element: actionUi.element,

    render: ({ accountIdentifier, regDateInfo }) => {
      lastAccountIdentifier = accountIdentifier;
      lastRegDateInfo = regDateInfo;

      // Reg date button is only available for user accounts
      if (
        accountIdentifier.kind === "vkId" &&
        accountIdentifier.prefix !== "id"
      ) {
        actionUi.element.hidden = true;
        return;
      }

      const isFetching = regDateInfo?.status === "fetching";
      const isFetched = regDateInfo?.status === "fetched";

      actionUi.element.hidden = false;

      if (isFetched) {
        actionUi.render({
          ariaLabel: "Скрыть дату регистрации",
          icon: "calendarOff",
          tooltip: true,
        });
        actionUi.element.classList.remove(...fetchingCnTokens);
      } else if (isFetching) {
        actionUi.render({
          ariaLabel: "Загрузка даты регистрации",
          icon: "loaderCircle",
          iconClassName: "bn:animate-spin",
          tooltip: false,
        });
        actionUi.element.classList.add(...fetchingCnTokens);
      } else {
        actionUi.render({
          ariaLabel: "Дата регистрации",
          icon: "calendarDays",
          tooltip: true,
        });
        actionUi.element.classList.remove(...fetchingCnTokens);
      }
    },

    unmount: () => {
      actionUi.unmount();
    },
  };
}

const notRoundedLeftCnTokens = cnt("bn:not-focus-visible:rounded-l-none");
const notRoundedRightCnTokens = cnt("bn:not-focus-visible:rounded-r-none");

export function createUiWithActionBar({
  contentId,
  derivedPageInfo,
  placement,
  rootElement,
  serviceLookup,
  onRegDateInfoChange,
}: {
  contentId: ContentId;
  derivedPageInfo: DerivedPageInfo;
  instanceLogger: Logger;
  placement: ActionBarPlacementSchema;
  rootElement: HTMLElement;
  serviceLookup: AvailableServiceLookup;
  onRegDateInfoChange: (regDateInfo: RegDateInfo | undefined) => void;
}):
  | InsertionUi<{
      accountAffiliation?: AccountAffiliation;
      accountAvatarUrl: string;
      accountIdentifier: AccountIdentifier;
      accountName: string;
      frontendBaseUrl: string;
      inspectorTrigger?: InspectorTrigger;
      regDateInfo?: RegDateInfo;
    }>
  | undefined {
  const { element, pickedPlacement } = createInsertionUi({
    className: cn("bn:pointer-events-auto bn:relative bn:inline-flex"),
    dxLabel: "actionBar",
    placement,
    rootElement,
    tagName: "div",
  });

  if (!element) {
    return;
  }

  const tooltipDirection = pickedPlacement.tooltipDirection ?? "down";

  const bnPageAction = createBnPageAction({
    derivedPageInfo,
    tooltipDirection,
  });

  const bnCardAction = createBnCardAction({
    derivedPageInfo,
    tooltipDirection,
  });

  const inspectorAction = createInspectorButton({
    contentId,
    derivedPageInfo,
    serviceLookup,
    tooltipDirection,
  });

  const regDateAction = createRegDateAction({
    contentId,
    derivedPageInfo,
    onRegDateInfoChange,
    serviceLookup,
    tooltipDirection,
  });

  const actionElements = [
    bnPageAction.element,
    bnCardAction.element,
    inspectorAction.element,
    regDateAction.element,
  ];

  element.append(...actionElements);

  function updateActionRounding() {
    const visibleElements = actionElements.filter((el) => !el.hidden);

    for (const visibleElement of actionElements) {
      if (visibleElements.at(0) === visibleElement) {
        visibleElement.classList.remove(...notRoundedLeftCnTokens);
      } else {
        visibleElement.classList.add(...notRoundedLeftCnTokens);
      }

      if (visibleElements.at(-1) === visibleElement) {
        visibleElement.classList.remove(...notRoundedRightCnTokens);
      } else {
        visibleElement.classList.add(...notRoundedRightCnTokens);
      }
    }
  }

  return {
    element,
    render: ({
      accountAffiliation,
      accountIdentifier,
      accountName,
      accountAvatarUrl,
      inspectorTrigger,
      regDateInfo,
      frontendBaseUrl,
    }) => {
      bnPageAction.render(
        omitUndefined({
          accountAffiliation,
          accountIdentifier,
          frontendBaseUrl,
        }),
      );

      bnCardAction.render(
        omitUndefined({
          accountAffiliation,
          accountIdentifier,
          frontendBaseUrl,
        }),
      );

      inspectorAction.render(
        omitUndefined({
          accountIdentifier,
          accountName,
          accountAvatarUrl,
          inspectorTrigger,
        }),
      );

      regDateAction.render(
        omitUndefined({
          accountIdentifier,
          regDateInfo,
        }),
      );

      updateActionRounding();

      element.hidden =
        bnPageAction.element.hidden &&
        bnCardAction.element.hidden &&
        inspectorAction.element.hidden &&
        regDateAction.element.hidden;
    },
    unmount: () => {
      bnPageAction.unmount();
      bnCardAction.unmount();
      inspectorAction.unmount();
      regDateAction.unmount();

      element.remove();
    },
  };
}
