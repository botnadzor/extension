import type { JsonObject } from "type-fest";

import type { InsertionConfig } from "@/shared/@model/insertion-configs";

import type {
  RenderFunction,
  UnmountFunction,
} from "./insertion-variant-typings";

export type BlankInsertionInstance = Readonly<{
  config: InsertionConfig;
  innerData: JsonObject;
  instanceId: string;
  rootElement: HTMLElement;
  version: number;
}>;

export type InsertionInstanceWithMarkupData = Readonly<
  BlankInsertionInstance & { markupData: JsonObject }
>;

export type InsertionInstanceWithServiceData = Readonly<
  InsertionInstanceWithMarkupData & { serviceData: JsonObject }
>;

export type MountedInsertionInstance = Readonly<
  InsertionInstanceWithServiceData & {
    render: RenderFunction<{
      innerData: JsonObject;
      markupData: JsonObject;
      serviceData: JsonObject;
    }>;
    unmount: UnmountFunction;
  }
>;

export type InsertionInstance =
  | BlankInsertionInstance
  | InsertionInstanceWithMarkupData
  | InsertionInstanceWithServiceData
  | MountedInsertionInstance;
