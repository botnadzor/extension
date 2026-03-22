import { clamp } from "es-toolkit";
import * as React from "react";

import type { StaticListUpstreamInfo } from "@/shared/@model/static-list-helpers";
import {
  useStaticListMetadata,
  useStaticListsAutoUpdate,
} from "@/shared/@ui-helpers/data-hooks";
import { LogoLink } from "@/shared/@ui-primitives/logo";
import { formatDateTime } from "@/shared/formatting";

function Percentage({
  extractFrom,
}: {
  extractFrom: {
    summary: { itemCount: number };
    upstreamInfo: StaticListUpstreamInfo;
  };
}) {
  const loaded = extractFrom.summary.itemCount;
  const total = extractFrom.upstreamInfo.itemCount;
  const percentage =
    total > 0 && Number.isFinite(total)
      ? clamp(Math.round((loaded / total) * 100), 0, 99)
      : 0;

  return <span className="tabular-nums">{percentage}%</span>;
}

function AccountListMetadata() {
  const accountsMetadata = useStaticListMetadata("accounts");

  if (!accountsMetadata.remoteActive) {
    if (!accountsMetadata.remoteStaging) {
      return <>Список аккаунтов пока не начал загружаться</>;
    }

    return (
      <>
        Список аккаунтов обрабатывается:{" "}
        <Percentage extractFrom={accountsMetadata.remoteStaging} />
      </>
    );
  }

  if (accountsMetadata.remoteStaging) {
    return (
      <>
        Список аккаунтов обновляется:{" "}
        <Percentage extractFrom={accountsMetadata.remoteStaging} />
      </>
    );
  }

  return (
    <>
      Список аккаунтов от{" "}
      {formatDateTime(accountsMetadata.remoteActive.upstreamInfo.generatedAt)}
    </>
  );
}

export function Header() {
  useStaticListsAutoUpdate({
    listIds: ["accounts", "insertions", "tags"],
    // When a user triggers the popup, we can tolerate accounts, insertions and tags
    // being outdated for one day. This can save some CPU and network traffic. The delay
    // is not set in content script where we want to mark bots based on fresh data.
    toleranceInMinutes: 60 * 24,
  });

  useStaticListsAutoUpdate({
    listIds: ["announcements"],
  });

  return (
    <div className="flex items-center justify-between px-3 py-4">
      <div className="flex-0">
        <LogoLink />
      </div>
      <div className="flex-1 text-right text-sm font-light">
        <React.Suspense>
          <AccountListMetadata />
        </React.Suspense>
      </div>
    </div>
  );
}
