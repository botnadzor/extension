import { SquareMenuIcon, SquareUserIcon, UserSearchIcon } from "lucide-react";
import type * as React from "react";

import { getAffiliationLabel } from "@/entrypoints/content/insertion-variants/shared/@markup-ui/affiliation-label";
import type { ContentId } from "@/shared/@primitives/misc";
import {
  stringifyAccountIdentifier,
  type VkDomain,
} from "@/shared/@primitives/vk";
import { Button, buttonVariants } from "@/shared/@ui-primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/@ui-primitives/tooltip";
import { formatInt } from "@/shared/formatting";
import { inspectorService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";
import {
  defaultVkBaseUrl,
  generateCardUrl,
  generateUrl,
} from "@/shared/url-helpers";

import {
  type DerivedAccountRow,
  getPreferredPositiveVkId,
} from "./aggregation";

function getVkProfileUrl(
  accountIdentifier: DerivedAccountRow["accountIdentifier"],
) {
  return `${defaultVkBaseUrl}/${stringifyAccountIdentifier(accountIdentifier)}`;
}

function canOpenInspector(
  accountIdentifier: DerivedAccountRow["accountIdentifier"],
) {
  return accountIdentifier.kind !== "vkId" || accountIdentifier.prefix === "id";
}

function buildInspectorVkDomain(
  accountIdentifier: DerivedAccountRow["accountIdentifier"],
): VkDomain {
  return stringifyAccountIdentifier(accountIdentifier);
}

function ActionIconLink({
  ariaLabel,
  children,
  href,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            aria-label={ariaLabel}
            className={cn(buttonVariants({ variant: "ghost", size: "iconXs" }))}
            href={href}
            rel="noreferrer noopener"
            target="_blank"
          >
            {children}
          </a>
        }
      />
      <TooltipContent>{ariaLabel}</TooltipContent>
    </Tooltip>
  );
}

function ActionIconButton({
  ariaLabel,
  children,
  onClick,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="iconXs"
            onClick={onClick}
            aria-label={ariaLabel}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{ariaLabel}</TooltipContent>
    </Tooltip>
  );
}

export function AccountListTableRow({
  account,
  contentId,
  frontendBaseUrl,
  index,
}: {
  account: DerivedAccountRow;
  contentId: ContentId;
  frontendBaseUrl: string;
  index: number;
}) {
  const vkProfileUrl = getVkProfileUrl(account.accountIdentifier);

  const pageUrl = account.accountAffiliation?.botnadzorPage
    ? generateUrl(
        frontendBaseUrl,
        `/account/${stringifyAccountIdentifier(account.accountIdentifier)}`,
      )
    : undefined;

  const cardUrl = account.accountAffiliation?.botnadzorCard
    ? generateCardUrl({
        frontendBaseUrl,
        vkDomain: stringifyAccountIdentifier(account.accountIdentifier),
      })
    : undefined;

  const affiliationLabel = account.accountAffiliation
    ? getAffiliationLabel(account.accountAffiliation.tags)
    : undefined;
  const preferredVkId = getPreferredPositiveVkId(account);

  return (
    <>
      <div className="flex min-w-0 items-center justify-end text-muted-foreground">
        {index + 1}
      </div>

      <div className="relative min-w-0 overflow-hidden">
        <a
          className="
            group flex w-full max-w-full min-w-0 items-center gap-2 rounded-sm
            py-0.5 text-foreground u-ring
            @lg:ml-26
          "
          href={vkProfileUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {account.accountAvatarUrl ? (
            <img
              alt={account.accountName}
              className="size-7 shrink-0 rounded-full bg-border object-cover"
              src={account.accountAvatarUrl}
            />
          ) : (
            <div className="size-7 shrink-0 rounded-full bg-border" />
          )}
          <span
            className="
              min-w-0 flex-1 self-start truncate u-in-link text-sm/[1]
              u-no-ring-in-group
              @lg:self-center
            "
          >
            {account.accountName}
          </span>
        </a>

        <span
          className={`
            absolute right-0 bottom-0 left-9 min-w-0 truncate text-xs
            tabular-nums
            @lg:inset-0 @lg:flex @lg:w-24 @lg:items-center @lg:justify-end
          `}
        >
          {preferredVkId === undefined ? (
            account.accountIdentifier.kind === "vkNickname" ? (
              <span className="truncate text-muted-foreground">
                {account.accountIdentifier.value}
              </span>
            ) : (
              formatInt(account.accountIdentifier.value)
            )
          ) : (
            formatInt(preferredVkId)
          )}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-0.5 pr-3">
        {affiliationLabel && (
          <span
            className="
              me-1 inline-flex max-w-36 shrink truncate rounded-sm bg-gray-200
              px-1.5 py-0.5 text-xs whitespace-nowrap text-black
            "
            style={{ backgroundColor: account.accountAffiliation?.color }}
            title={affiliationLabel}
          >
            {affiliationLabel}
          </span>
        )}

        {pageUrl && (
          <ActionIconLink ariaLabel="Комментарии" href={pageUrl}>
            <SquareMenuIcon />
          </ActionIconLink>
        )}

        {cardUrl && (
          <ActionIconLink ariaLabel="Карточка" href={cardUrl}>
            <SquareUserIcon />
          </ActionIconLink>
        )}

        {canOpenInspector(account.accountIdentifier) && (
          <ActionIconButton
            ariaLabel="Инспектор"
            onClick={() => {
              void inspectorService.trigger(contentId, {
                accountInfo: {
                  avatarUrl: account.accountAvatarUrl ?? "",
                  name: account.accountName,
                  vkDomain: buildInspectorVkDomain(account.accountIdentifier),
                },
                trigger: { type: "account" },
              });
            }}
          >
            <UserSearchIcon />
          </ActionIconButton>
        )}
      </div>
    </>
  );
}
