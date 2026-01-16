import { clamp } from "es-toolkit";
import * as React from "react";

import type { StaticListUpstreamInfo } from "@/shared/@model/static-list-helpers";
import { staticListDefinitionLookup } from "@/shared/@model/static-lists";
import { useStaticListMetadata } from "@/shared/@ui-helpers/data-hooks";
import { Logo } from "@/shared/@ui-primitives/logo";
import { formatTime } from "@/shared/formatting";

function Percentage({
  extractFrom,
}: {
  extractFrom: { summary: unknown; upstreamInfo: StaticListUpstreamInfo };
}) {
  // TODO: Apply summary schema inside useStaticListMetadata
  const summaryResult =
    staticListDefinitionLookup.accounts.summarySchema.safeParse(
      extractFrom.summary,
    );

  const loaded = summaryResult.data?.itemCount ?? 0;
  const total = extractFrom.upstreamInfo.itemCount;

  return (
    <span className="tabular-nums">
      {clamp(Math.round((loaded / total) * 100), 0, 99)}%
    </span>
  );
}

function AccountListMetadata() {
  const accountsMetadata = useStaticListMetadata("accounts");

  if (!accountsMetadata.active) {
    if (!accountsMetadata.next) {
      return <>Список аккаунтов пока не начал загружаться</>;
    }

    return (
      <>
        Список аккаунтов обрабатывается:{" "}
        <Percentage extractFrom={accountsMetadata.next} />
      </>
    );
  }

  if (accountsMetadata.next) {
    return (
      <>
        Список аккаунтов обновляется:{" "}
        <Percentage extractFrom={accountsMetadata.next} />
      </>
    );
  }

  return (
    <>
      Список аккаунтов от{" "}
      {formatTime(accountsMetadata.active.upstreamInfo.generatedAt)}
    </>
  );
}

export function Header() {
  return (
    <div className="flex items-center justify-between px-3 py-4">
      <div className="flex-0">
        <Logo />
      </div>
      <div className="flex-1 text-right text-sm font-light">
        <React.Suspense>
          <AccountListMetadata />
        </React.Suspense>
      </div>
    </div>
  );
}
