import type { Logger } from "@logtape/logtape";

import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ElementPlacementSchema } from "@/shared/@model/insertion-configs/shared/primitives";
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

import type { AvailableServiceLookup } from "../../../insertion-variant-typings";
import { createInsertionUi, type InsertionUi } from "./helpers";
import { createIconElement, type IconId } from "./icons";
import type { RegDateInfo } from "./reg-date";
import { createTooltipUi, type TooltipDirection } from "./tooltip";

export function createActionUi<TagName extends "a" | "button">({
  className,
  tagName,
  tooltipDirection,
}: {
  className?: string | undefined;
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

  element.className = cn(
    `
      bn:group/action
      bn:relative bn:inline-flex bn:cursor-pointer bn:items-center
      bn:justify-center bn:rounded-[3px] bn:border-none
      bn:bg-(--bn-inline-action-background-color) bn:px-[3px] bn:text-link
      bn:transition-opacity bn:duration-200 bn:ease-in-out
      bn:focus-visible:animate-vk-like-outline-expansion
      bn:focus-visible:rounded-none bn:focus-visible:opacity-100!
      bn:focus-visible:outline-2! bn:focus-visible:outline-outline!
      bn:pointer-fine:opacity-0
      bn:pointer-fine:hover:opacity-100!
      bn:[[data-bn-insertion-instance-id]:has(:focus-visible)_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:hover_&]:opacity-70
      bn:pointer-fine:[[data-bn-insertion-instance-id]:hover_&]:duration-0
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
  tooltipDirection,
}: {
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountAffiliation?: AccountAffiliation;
  accountIdentifier: AccountIdentifier;
  frontendBaseUrl: string;
}> {
  const actionUi = createActionUi({
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
  tooltipDirection,
}: {
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountAffiliation?: AccountAffiliation;
  accountIdentifier: AccountIdentifier;
  frontendBaseUrl: string;
}> {
  const actionUi = createActionUi({
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
  serviceLookup,
  tooltipDirection,
}: {
  contentId: ContentId;
  serviceLookup: AvailableServiceLookup;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountIdentifier: AccountIdentifier;
  accountName: string;
  accountAvatarUrl: string;
  inspectorTrigger?: InspectorTrigger;
}> {
  const actionUi = createActionUi({
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
  onRegDateInfoChange,
  serviceLookup,
  tooltipDirection,
}: {
  contentId: ContentId;
  onRegDateInfoChange: (regDateInfo: RegDateInfo | undefined) => void;
  serviceLookup: AvailableServiceLookup;
  tooltipDirection: TooltipDirection;
}): InsertionUi<{
  accountIdentifier: AccountIdentifier;
  regDateInfo?: RegDateInfo;
}> {
  const actionUi = createActionUi({
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
  placement,
  rootElement,
  serviceLookup,
  tooltipDirection = "down",
  onRegDateInfoChange,
}: {
  contentId: ContentId;
  instanceLogger: Logger;
  placement: ElementPlacementSchema;
  rootElement: HTMLElement;
  serviceLookup: AvailableServiceLookup;
  tooltipDirection?: TooltipDirection | undefined;
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
  const { element } = createInsertionUi({
    className: cn("bn:pointer-events-auto bn:relative bn:inline-flex"),
    dxLabel: "actionBar",
    placement,
    rootElement,
    tagName: "div",
  });

  if (!element) {
    return;
  }

  const bnPageAction = createBnPageAction({
    tooltipDirection,
  });

  const bnCardAction = createBnCardAction({
    tooltipDirection,
  });

  const inspectorAction = createInspectorButton({
    contentId,
    serviceLookup,
    tooltipDirection,
  });

  const regDateAction = createRegDateAction({
    contentId,
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
