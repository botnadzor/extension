import { produce } from "immer";
import { z } from "zod/mini";

import {
  type InspectorInstanceConfig,
  inspectorInstanceConfigSchema,
  type InspectorInstancePayload,
} from "@/shared/@model/inspector";
import {
  type ContentId,
  contentIdSchema,
  isoTimeSchema,
  type VkDomain,
  type VkId,
} from "@/shared/@model/primitives";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";

import type { responseSchema } from "../@service-helpers/dynamic-api-endpoints/=inspector";
import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";
import type { VkDomainResolver } from "../@service-helpers/vk-domain-resolver";
import type { AuthService } from "./auth-service";
import type { NotificationService } from "./notification-service";

type AccountInspection =
  | {
      success: true;
      data: z.infer<typeof responseSchema>;
    }
  | {
      success: false;
      reason:
        | "methodQuotaExceeded"
        | "missingPermission"
        | "noAliasToUse"
        | "notFound"
        | "tooManyRequests"
        | "unauthorized"
        | "unexpectedError";
    };

const inspectorServiceConfigSchema = z.readonly(
  z.object({
    instanceByContentId: z.readonly(
      z.record(contentIdSchema, inspectorInstanceConfigSchema),
    ),
  }),
);
type InspectorServiceConfig = z.infer<typeof inspectorServiceConfigSchema>;

const defaultInspectorServiceConfig: InspectorServiceConfig = {
  instanceByContentId: {},
};

const inspectorStore = defineStoreWithSchema(
  "session:inspector",
  inspectorServiceConfigSchema,
);

export class InspectorService {
  private pollableInspectorInstanceByContentId: Record<
    ContentId,
    Pollable<InspectorInstanceConfig | undefined>
  > = {};
  private readonly authService: AuthService;
  private readonly notificationService: NotificationService;
  private readonly vkDomainResolver: VkDomainResolver;

  private accountInspectionLookup: Record<VkDomain | VkId, AccountInspection> =
    {};
  private pendingAccountInspectionLookup: Record<
    VkDomain | VkId,
    Promise<AccountInspection>
  > = {};
  private pollableAccountInspectionLookup: Record<
    VkDomain | VkId,
    Pollable<AccountInspection>
  > = {};

  constructor({
    authService,
    notificationService,
    vkDomainResolver,
  }: {
    authService: AuthService;
    notificationService: NotificationService;
    vkDomainResolver: VkDomainResolver;
  }) {
    this.authService = authService;
    this.notificationService = notificationService;
    this.vkDomainResolver = vkDomainResolver;
  }

  async getInstanceConfig(
    contentId: ContentId,
  ): Promise<InspectorInstanceConfig | undefined> {
    const storeValue = await inspectorStore.getValue();
    return storeValue?.instanceByContentId[contentId] ?? undefined;
  }

  async pollInstanceConfig(
    lastPollVersion: PollVersion | undefined,
    contentId: ContentId,
  ): Promise<PollResult<InspectorInstanceConfig | undefined>> {
    this.pollableInspectorInstanceByContentId[contentId] ??= new Pollable<
      InspectorInstanceConfig | undefined
    >(await this.getInstanceConfig(contentId));
    return this.pollableInspectorInstanceByContentId[contentId].poll(
      lastPollVersion,
    );
  }

  async setInstanceConfig(
    contentId: ContentId,
    config: InspectorInstanceConfig | undefined,
  ): Promise<void> {
    const storeValue = await inspectorStore.getValue();

    const newStoreValue = produce(
      storeValue ?? defaultInspectorServiceConfig,
      (draft) => {
        if (config) {
          draft.instanceByContentId[contentId] = config;
        } else if (Object.hasOwn(draft.instanceByContentId, contentId)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- contentId is present based on Object.hasOwn check
          delete draft.instanceByContentId[contentId];
        }
      },
    );

    await inspectorStore.setValue(newStoreValue);

    if (this.pollableInspectorInstanceByContentId[contentId]) {
      this.pollableInspectorInstanceByContentId[contentId].setValue(config);
    }
  }

  async trigger(
    contentId: ContentId,
    payload: InspectorInstancePayload | undefined,
  ): Promise<void> {
    if (!payload) {
      await this.setInstanceConfig(contentId, undefined);
      return;
    }

    const authStatus = this.authService.getAuthStatus();

    if (authStatus.state !== "valid") {
      await this.notificationService.trigger(contentId, {
        type: "inspectorUnauthorized",
      });
      return;
    }

    if (!authStatus.permissionLookup.canOpenInspector) {
      await this.notificationService.trigger(contentId, {
        type: "inspectorMissingPermission",
      });
      return;
    }

    await Promise.all([
      this.notificationService.trigger(contentId, undefined),

      this.setInstanceConfig(contentId, {
        ...payload,
        tab: "activity",
        triggeredAt: isoTimeSchema.parse(new Date()),
      }),
    ]);
  }

  async setTab(
    contentId: ContentId,
    tab: "activity" | "report",
  ): Promise<void> {
    const instanceConfig = await this.getInstanceConfig(contentId);
    if (!instanceConfig) {
      return;
    }
    await this.setInstanceConfig(contentId, {
      ...instanceConfig,
      tab,
    });
  }

  async reinspectAccount(
    vkDomainOrId: VkDomain | VkId,
  ): Promise<AccountInspection> {
    if (this.pendingAccountInspectionLookup[vkDomainOrId]) {
      return this.pendingAccountInspectionLookup[vkDomainOrId];
    }

    const fetchPromise = this.authService.robustlyFetchFromDynamicApi(
      "inspector",
      { vkDomainOrId },
    );

    this.pendingAccountInspectionLookup[vkDomainOrId] = fetchPromise;

    const fetchResult = await fetchPromise;

    if (Object.hasOwn(this.pendingAccountInspectionLookup, vkDomainOrId)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- vkDomain is present based on Object.hasOwn check
      delete this.pendingAccountInspectionLookup[vkDomainOrId];
    }

    if (!fetchResult.success && fetchResult.reason === "unauthorized") {
      void this.authService.checkAuth();
    }

    if (fetchResult.success) {
      if (fetchResult.data.remainingPermissionLookup) {
        this.authService.patchPermissionLookup(
          fetchResult.data.remainingPermissionLookup,
        );
      }

      if (fetchResult.data.remainingPoints) {
        this.authService.patchPointCount(fetchResult.data.remainingPoints);
      }
    }

    this.accountInspectionLookup[vkDomainOrId] = fetchResult;
    this.pollableAccountInspectionLookup[vkDomainOrId]?.setValue(fetchResult);

    return fetchResult;
  }

  async getAccountInspection(vkDomain: VkDomain): Promise<AccountInspection> {
    const vkDomainOrId =
      (await this.vkDomainResolver.resolve(vkDomain)) ?? vkDomain;

    return (
      this.pendingAccountInspectionLookup[vkDomainOrId] ??
      this.accountInspectionLookup[vkDomainOrId] ??
      this.reinspectAccount(vkDomainOrId)
    );
  }

  async pollAccountInspection(
    lastPollVersion: PollVersion | undefined,
    vkDomain: VkDomain,
  ): Promise<PollResult<AccountInspection>> {
    this.pollableAccountInspectionLookup[vkDomain] ??=
      new Pollable<AccountInspection>(
        await this.getAccountInspection(vkDomain),
      );

    return this.pollableAccountInspectionLookup[vkDomain].poll(lastPollVersion);
  }
}
