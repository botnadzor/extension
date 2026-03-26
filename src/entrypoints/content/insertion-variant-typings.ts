import type { Logger } from "@logtape/logtape";
import type { Draft } from "immer";
import type { JsonObject } from "type-fest";

import type { InsertionVariant } from "@/shared/@model/insertion-configs";
import type { ContentId } from "@/shared/@primitives/misc";
import type {
  affiliationService,
  collectingService,
  frontendService,
  inspectorService,
  notificationService,
  regDateService,
  userConfigService,
} from "@/shared/proxy-services";

import type { DerivedPageInfo } from "./derived-page-info";

/** Helps avoid direct service imports to potentially implement a caching layer in the future */
export type AvailableServiceLookup = {
  affiliationService: typeof affiliationService;
  collectingService: typeof collectingService;
  frontendService: typeof frontendService;
  inspectorService: typeof inspectorService;
  notificationService: typeof notificationService;
  regDateService: typeof regDateService;
  userConfigService: typeof userConfigService;
};

export type GetInsertionSnapshotResult =
  | Readonly<{
      success: true;
      snapshot: Readonly<{
        instanceId: string;
        markupData: JsonObject;
        serviceData: JsonObject;
        variant: InsertionVariant;
      }>;
    }>
  | Readonly<{
      success: false;
      reason: "notFound" | "notMounted" | "variantMismatch";
    }>;

export type AvailableInsertionLookup = {
  getInsertionSnapshot: (
    instanceId: string,
    expectedVariant: InsertionVariant,
  ) => GetInsertionSnapshotResult;
};

/** Callback to update instance state using an Immer recipe function. */
export type UpdateInnerData<State extends Readonly<JsonObject>> = (
  recipe: (draft: Draft<State>) => void,
) => void;

export type RenderFunction<RenderData extends Readonly<JsonObject>> = (
  renderData: RenderData,
) => void;

export type UnmountFunction = () => void;

/** Generic variant definition — each concrete variant specifies its own types. */
export type InsertionVariantDefinition<
  Config,
  InnerData extends Readonly<JsonObject>,
  MarkupData extends Readonly<JsonObject>,
  ServiceData extends Readonly<JsonObject>,
> = {
  defaultInnerData: InnerData;

  /**
   * Stage 1: Extract markup data from the root element using config selectors.
   * Returns `undefined` if data extraction has partially failed.
   */
  getMarkupData: (payload: {
    config: Config;
    derivedPageInfo: DerivedPageInfo;
    instanceLogger: Logger;
    rootElement: HTMLElement;
  }) => Promise<MarkupData | undefined> | MarkupData | undefined;

  /**
   * Stage 2: Fetch service data (affiliation, frontend URL, etc.)
   * based on the extracted markup data.
   */
  getServiceData: (payload: {
    config: Config;
    derivedPageInfo: DerivedPageInfo;
    innerData: InnerData;
    insertionLookup: AvailableInsertionLookup;
    instanceLogger: Logger;
    markupData: MarkupData;
    serviceLookup: AvailableServiceLookup;
  }) => Promise<ServiceData> | ServiceData;

  /**
   * Stage 3: Mount the insertion and return an unmount function.
   */
  mount: (payload: {
    config: Config;
    contentId: ContentId;
    derivedPageInfo: DerivedPageInfo;
    instanceLogger: Logger;
    rootElement: HTMLElement;
    serviceLookup: AvailableServiceLookup;
    revalidateMarkupData: () => void;
    updateInnerData: UpdateInnerData<InnerData>;
  }) => {
    render: RenderFunction<{
      innerData: InnerData;
      markupData: MarkupData;
      serviceData: ServiceData;
    }>;
    unmount: UnmountFunction;
  };
};

/** Type-erased variant definition used by the management loop. */
export type BaseInsertionVariantDefinition = InsertionVariantDefinition<
  unknown,
  JsonObject,
  JsonObject,
  JsonObject
>;

/**
 * Wraps a fully-typed variant definition into a type-erased
 * `BaseInsertionVariantDefinition` for the variant lookup.
 */
export function defineInsertionVariant<
  Config,
  InnerData extends JsonObject,
  MarkupData extends JsonObject,
  ServiceData extends JsonObject,
>(
  definition: InsertionVariantDefinition<
    Config,
    InnerData,
    MarkupData,
    ServiceData
  >,
): BaseInsertionVariantDefinition {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- erasing generic types to the base unknown interface for the variant lookup
  return definition as unknown as BaseInsertionVariantDefinition;
}
