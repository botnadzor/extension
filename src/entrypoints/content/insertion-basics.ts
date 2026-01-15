import type { Logger } from "@logtape/logtape";

import type { ContentId } from "@/shared/primitive-values";

import type { WebsiteVariant } from "./derived-page-info";

export type InsertionCleanupFunction = () => void;

export type InsertionInitializer = (payload: {
  contentId: ContentId;
  element: HTMLElement;
  logger: Logger;
  archivedSnapshot: boolean;
}) =>
  | InsertionCleanupFunction
  | undefined
  | Promise<InsertionCleanupFunction | undefined>;

export type Insertion = {
  appliesTo: WebsiteVariant;
  appliesToArchivedSnapshotsOnly?: true;
  elementSelector: string;

  init: InsertionInitializer;
};

export type InsertionInstance = {
  insertion: Insertion;
  instanceId: string;
  element: HTMLElement;
  cleanup?: InsertionCleanupFunction;
};

export function defineInsertion(insertion: Insertion): Insertion {
  return insertion;
}
