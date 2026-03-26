import type { Logger } from "@logtape/logtape";

import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import {
  type AccountIdentifier,
  isPositiveVkId,
  type PositiveVkId,
  stringifyAccountIdentifier,
} from "@/shared/@primitives/vk";

export type DerivedAccountRow = {
  accountAffiliation?: AccountAffiliation;
  accountAvatarUrl?: string;
  accountIdentifier: AccountIdentifier;
  accountName: string;
  instanceId: string;
};

type ChartCategoryMatcher = (account: DerivedAccountRow) => boolean;

export type DerivedChartCategory = {
  color: string;
  id: string;
  label: string;
  total: number;
};

export type DerivedChartBucket = {
  counts: number[];
  million: number;
};

export type DerivedAccountChart = {
  buckets: DerivedChartBucket[];
  categories: DerivedChartCategory[];
};

function getDerivedAccountKey(
  account: Pick<DerivedAccountRow, "accountAffiliation" | "accountIdentifier">,
) {
  if (account.accountAffiliation?.resolvedVkId !== undefined) {
    return `resolvedVkId:${account.accountAffiliation.resolvedVkId}`;
  }

  return stringifyAccountIdentifier(account.accountIdentifier);
}

type ChartCategory = {
  color: string;
  id: string;
  label: string;
  matches: ChartCategoryMatcher;
};

const chartCategories: readonly ChartCategory[] = [
  {
    color: "var(--chart-1)",
    id: "hasCard",
    label: "Аккаунты с маркировкой",
    matches: (account) => Boolean(account.accountAffiliation),
  },
  {
    color: "var(--chart-2)",
    id: "other",
    label: "Остальные аккаунты",
    matches: () => true,
  },
];

function findCategoryIndex(account: DerivedAccountRow): number {
  return chartCategories.findIndex((category) => category.matches(account));
}

export function getPreferredPositiveVkId(
  account: Pick<DerivedAccountRow, "accountAffiliation" | "accountIdentifier">,
): PositiveVkId | undefined {
  const resolvedVkId = account.accountAffiliation?.resolvedVkId;
  if (resolvedVkId !== undefined && isPositiveVkId(resolvedVkId)) {
    return resolvedVkId;
  }

  if (
    account.accountIdentifier.kind !== "vkId" ||
    account.accountIdentifier.prefix !== "id" ||
    account.accountIdentifier.value <= 0
  ) {
    return;
  }

  return account.accountIdentifier.value;
}

function getPositiveVkIdMillion(
  account: DerivedAccountRow,
): number | undefined {
  const vkId = getPreferredPositiveVkId(account);
  if (vkId === undefined) {
    return;
  }

  return Math.floor(vkId / 1_000_000);
}

export function deriveAccountChart(
  accounts: readonly DerivedAccountRow[],
): DerivedAccountChart {
  const totals = Array.from<number>({ length: chartCategories.length }).fill(0);
  const bucketByMillion = new Map<number, DerivedChartBucket>();

  for (const account of accounts) {
    const million = getPositiveVkIdMillion(account);
    if (million === undefined) {
      continue;
    }

    const categoryIndex = findCategoryIndex(account);
    if (categoryIndex === -1) {
      continue;
    }

    totals[categoryIndex] = (totals[categoryIndex] ?? 0) + 1;

    const currentBucket = bucketByMillion.get(million) ?? {
      counts: Array.from<number>({ length: chartCategories.length }).fill(0),
      million,
    };
    currentBucket.counts[categoryIndex] =
      (currentBucket.counts[categoryIndex] ?? 0) + 1;
    bucketByMillion.set(million, currentBucket);
  }

  return {
    buckets: [...bucketByMillion.values()].toSorted(
      (left, right) => left.million - right.million,
    ),
    categories: chartCategories.map((category, index) => ({
      color: category.color,
      id: category.id,
      label: category.label,
      total: totals[index] ?? 0,
    })),
  };
}

export function mergeRememberedAccounts({
  currentAccounts,
  rememberedAccounts,
}: {
  currentAccounts: readonly DerivedAccountRow[];
  rememberedAccounts: readonly DerivedAccountRow[];
}): DerivedAccountRow[] {
  const mergedAccounts = [...rememberedAccounts];
  const indexByAccountKey = new Map<string, number>();

  for (const [index, account] of mergedAccounts.entries()) {
    indexByAccountKey.set(getDerivedAccountKey(account), index);
  }

  for (const account of currentAccounts) {
    const accountKey = getDerivedAccountKey(account);
    const existingIndex = indexByAccountKey.get(accountKey);

    if (existingIndex === undefined) {
      indexByAccountKey.set(accountKey, mergedAccounts.length);
      mergedAccounts.push(account);
      continue;
    }

    mergedAccounts[existingIndex] = account;
  }

  return mergedAccounts;
}

export function dedupeInstanceIds(
  instanceIds: readonly string[],
  instanceLogger: Logger,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const result: string[] = [];

  for (const instanceId of instanceIds) {
    if (seen.has(instanceId)) {
      duplicates.add(instanceId);
      continue;
    }

    seen.add(instanceId);
    result.push(instanceId);
  }

  if (duplicates.size > 0) {
    instanceLogger.warn(
      "Duplicate nested insertion ids discovered in account list: {instanceIds}",
      {
        instanceIds: [...duplicates],
      },
    );
  }

  return result;
}
