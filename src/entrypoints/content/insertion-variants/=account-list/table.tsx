import * as React from "react";

import type { ContentId } from "@/shared/@primitives/misc";
import { ScrollArea } from "@/shared/@ui-primitives/scroll-area";

import type { DerivedAccountRow } from "./aggregation";
import { AccountListTableRow } from "./table-row";

export type TableOverlayStyle = {
  backgroundColor?: string;
  borderRadius?: string;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
};

export type TableOverlayRect = {
  height: number;
  left: number;
  style: TableOverlayStyle;
  top: number;
  width: number;
};

export function AccountListTable({
  accounts,
  autoloadEnabled,
  canRequestMoreAccounts,
  contentId,
  frontendBaseUrl,
  overlayRect,
  onRequestMoreAccounts,
}: {
  accounts: readonly DerivedAccountRow[];
  autoloadEnabled: boolean;
  canRequestMoreAccounts: boolean;
  contentId: ContentId;
  frontendBaseUrl: string;
  overlayRect: TableOverlayRect;
  onRequestMoreAccounts: () => void;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = React.useRef<HTMLDivElement>(null);
  const previousAccountsCountRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const currentViewportElement = viewportRef.current;
    const currentLoadMoreTriggerElement = loadMoreTriggerRef.current;

    if (
      !canRequestMoreAccounts ||
      !currentViewportElement ||
      !currentLoadMoreTriggerElement
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRequestMoreAccounts();
        }
      },
      {
        root: currentViewportElement,
        threshold: 0.1,
      },
    );
    observer.observe(currentLoadMoreTriggerElement);

    return () => {
      observer.disconnect();
    };
  }, [canRequestMoreAccounts, onRequestMoreAccounts]);

  React.useEffect(() => {
    const currentViewportElement = viewportRef.current;
    const previousAccountsCount = previousAccountsCountRef.current;

    previousAccountsCountRef.current = accounts.length;

    if (
      !currentViewportElement ||
      !autoloadEnabled ||
      previousAccountsCount === undefined ||
      accounts.length <= previousAccountsCount
    ) {
      return;
    }

    currentViewportElement.scrollTo({
      behavior: "smooth",
      top: currentViewportElement.scrollHeight,
    });
  }, [accounts.length, autoloadEnabled]);

  return (
    <div
      className="absolute z-20 bg-background"
      style={{
        backgroundColor: overlayRect.style.backgroundColor,
        borderRadius: overlayRect.style.borderRadius,
        height: `${overlayRect.height}px`,
        left: `${overlayRect.left}px`,
        top: `${overlayRect.top}px`,
        width: `${overlayRect.width}px`,

        paddingBottom: `${overlayRect.style.paddingBottom}px`,
        paddingLeft: `${overlayRect.style.paddingLeft}px`,
        paddingRight: `${overlayRect.style.paddingRight}px`,
        paddingTop: `${overlayRect.style.paddingTop}px`,
      }}
    >
      <ScrollArea
        className="h-full rounded-[inherit] bg-transparent"
        style={{
          backgroundColor: "inherit",
          borderRadius: "inherit",
        }}
        viewportRef={viewportRef}
      >
        <div
          className="
            @container grid max-w-full auto-rows-[32px]
            grid-cols-[minmax(28px,auto)_minmax(0,1fr)_auto] items-stretch
            gap-x-2 gap-y-1 overflow-x-hidden text-xs
          "
        >
          {accounts.map((account, index) => (
            <AccountListTableRow
              key={account.instanceId}
              account={account}
              contentId={contentId}
              frontendBaseUrl={frontendBaseUrl}
              index={index}
            />
          ))}
        </div>
        {canRequestMoreAccounts ? (
          <div aria-hidden={true} className="h-20" ref={loadMoreTriggerRef} />
        ) : undefined}
      </ScrollArea>
    </div>
  );
}
