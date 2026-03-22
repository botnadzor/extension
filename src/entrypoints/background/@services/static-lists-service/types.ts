import type { JsonValue } from "type-fest";

import type {
  StaticListEntryInterpretation,
  StaticListItemOrigin,
} from "@/shared/@model/static-list-helpers";
import type { IsoDateTime } from "@/shared/@primitives/temporal";

export type StoredRowIndexSlotName = "p" | `s${number}`;

export type StoredRowCachedIndexValues = Partial<
  Record<StoredRowIndexSlotName, IDBValidKey | undefined>
>;

export type StoredRowBase = {
  /** Raw JSONL source text, preserved verbatim for both remote and local rows. */
  t: string;
  /** Cached logical primary key extracted from the JSONL-form source, if any. */
  p?: IDBValidKey | undefined;
} & Partial<Record<`s${number}`, IDBValidKey | undefined>>;

export type StoredRemoteRow = StoredRowBase & {
  /** 1-based upstream JSONL line number, used as the physical remote row key. */
  r: number;
};

export type StoredLocalRow = StoredRowBase & {
  /** Stable local row id so malformed rows can still be edited or deleted precisely. */
  i: string;
  /** Last local write timestamp used for deterministic local ordering. */
  u: IsoDateTime;
};

export type StoredRow = StoredRemoteRow | StoredLocalRow;

export type InterpretedStoredRowResult = {
  rowKey: string | number;
  origin: StaticListItemOrigin;
  sourceText: string;
  sourceItem: JsonValue | undefined;
  logicalPrimaryKey: IDBValidKey | undefined;
  cachedIndexValues: StoredRowCachedIndexValues;
  interpretation: StaticListEntryInterpretation;
};

export type { StaticListPageEntry } from "@/shared/@model/static-list-helpers";
export type { StaticListPutLocalItemsOptions } from "@/shared/@model/static-list-helpers";
export type { StaticListPutLocalItemsResult as LocalWriteResult } from "@/shared/@model/static-list-helpers";
export type { StaticListRemoveLocalItemTarget as RemoveLocalItemTarget } from "@/shared/@model/static-list-helpers";
