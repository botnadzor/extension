import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import type {
  ContentId,
  IsoDate,
  IsoDateTime,
  VkDomain,
} from "@/shared/@model/primitives";
import { formatDateWithOptionalTime } from "@/shared/formatting";
import {
  inspectorService,
  notificationService,
  regDateService,
} from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";
import { generateCardUrl, generateUrl } from "@/shared/url-helpers";

import {
  type IconSpec,
  renderActionButton,
  type TooltipConfig,
} from "./ui-action-buttons";

type DesignVariant = "desktop" | "mobile";

function disableRegDateButton(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest("button");
  button?.classList.add(...cnl("bn:opacity-50"));
  button?.setAttribute("disabled", "true");
}

function enableRegDateButton(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest("button");
  button?.classList.remove(...cnl("bn:opacity-50"));
  button?.removeAttribute("disabled");
}

function hideRegDateButton(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest("button");

  button?.classList.add(...cnl("bn:hidden"));
  button?.classList.remove(...cnl("bn:inline-flex"));
}

function injectRegDateText(
  event: MouseEvent,
  regDate: IsoDate | IsoDateTime,
  registrationDateAnchor: HTMLElement,
): void {
  const formattedDate = formatDateWithOptionalTime(regDate).split(" ")[0];
  const injectionTextContent = `Дата регистрации: ${formattedDate}`;

  const paragraph = document.createElement("p");
  paragraph.className = cn("bn:mt-1 bn:mb-0 bn:text-muted-foreground");
  paragraph.textContent = injectionTextContent;
  registrationDateAnchor.after(paragraph);
}

async function handleRegDateResult(
  result: Awaited<ReturnType<typeof regDateService.obtain>>,
  event: MouseEvent,
  contentId: ContentId,
  registrationDateAnchor: HTMLElement,
): Promise<void> {
  if (!result.problem) {
    injectRegDateText(event, result.value, registrationDateAnchor);
    hideRegDateButton(event);
    void notificationService.trigger(contentId, undefined);

    return;
  }

  enableRegDateButton(event);

  await notificationService.trigger(contentId, {
    message: result.description,
    type:
      result.type === "bn:ext:invalid-access-code"
        ? "regDateUnauthorized"
        : result.type === "bn:ext:missing-permission"
          ? "regDateMissingPermission"
          : "regDateUnavailable",
  });
}

async function handleRegDateClick(
  event: MouseEvent,
  vkDomain: VkDomain,
  contentId: ContentId,
  registrationDateAnchor: HTMLElement | undefined,
): Promise<void> {
  if (!registrationDateAnchor) {
    return;
  }

  disableRegDateButton(event);

  const result = await regDateService.obtain(vkDomain);

  // TODO: either hide the button on success or change its action. The button repeats the
  // action if previous call was an error. Otherwise, the button can hide the resulting reg date text.
  await handleRegDateResult(result, event, contentId, registrationDateAnchor);
}

type RenderAccountActionOptions = {
  design: DesignVariant;
  vkDomain: VkDomain;
  accountAffiliation?: AccountAffiliation | undefined;
  frontendBaseUrl: string;
  contentId: ContentId;
  className?: string | undefined;
  actionClassName?: string | undefined;
  registrationDateAnchor: HTMLElement;
  iconClassName?: string | undefined;
  showTooltip: boolean | TooltipConfig;
  tooltipClassName?: string | undefined;
  tooltipHoverClassName?: string | undefined;
  inspectorInstancePayload?: InspectorInstancePayload | undefined;
  badgeAnchor: HTMLElement;
};

export function renderAccountAction({
  design,
  vkDomain,
  accountAffiliation,
  frontendBaseUrl,
  contentId,
  className,
  actionClassName,
  registrationDateAnchor,
  iconClassName,
  showTooltip,
  tooltipClassName,
  tooltipHoverClassName,
  inspectorInstancePayload,
}: RenderAccountActionOptions): {
  element: HTMLElement;
  destroy: () => void;
} {
  const icons: IconSpec[] = [];

  if (accountAffiliation?.botnadzorPage) {
    const accountUrl = generateUrl(frontendBaseUrl, `/account/${vkDomain}`);
    icons.push({
      id: "squareMenu",
      kind: "link",
      href: accountUrl,
      title: "Комментарии",
    });
  }

  if (accountAffiliation?.botnadzorCard) {
    icons.push({
      id: "squareUser",
      kind: "link",
      href: generateCardUrl({ frontendBaseUrl, vkDomain }),
      title: "Карточка",
    });
  }

  if (inspectorInstancePayload) {
    icons.push({
      id: "userSearch",
      kind: "button",
      title: "Инспектор",
      onClick: () => {
        void inspectorService.trigger(contentId, inspectorInstancePayload);
      },
    });
  }

  icons.push({
    id: "calendarDays",
    kind: "button",
    title: "Дата регистрации",
    onClick: (event) => {
      void handleRegDateClick(
        event,
        vkDomain,
        contentId,
        registrationDateAnchor,
      );
    },
  });

  const desktopDefaults = {
    containerClassName: className,
    actionClassName: cn(
      "bn:size-4 bn:leading-none bn:text-text-link",
      actionClassName,
    ),
    iconClassName: cn("bn:size-4", iconClassName),
    showTooltip,
  };

  const mobileDefaults = {
    containerClassName: className,
    actionClassName: cn("bn:size-4 bn:text-text-link", actionClassName),
    iconClassName: cn("bn:size-4", iconClassName),
    showTooltip,
  };

  const designConfig = design === "desktop" ? desktopDefaults : mobileDefaults;

  return renderActionButton({
    icons,
    ...designConfig,
    ...(tooltipClassName && { tooltipClassName }),
    ...(tooltipHoverClassName && { tooltipHoverClassName }),
  });
}
