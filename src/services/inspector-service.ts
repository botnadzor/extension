import { produce } from "immer";
import { z } from "zod/mini";

import type { responseSchema } from "@/entrypoints/background/dynamic-api-endpoints/=inspector";
import type { VkDomainResolver } from "@/entrypoints/background/vk-domain-resolver";
import {
  type ContentId,
  contentIdSchema,
  isoTimeSchema,
  type VkDomain,
  vkDomainSchema,
  type VkId,
  vkIdSchema,
} from "@/lib/primitive-values";
import { defineStoreWithSchema } from "@/lib/store-with-schema";

import type { NotificationService } from "./notification-service";
import { Pollable, type PollResult, type PollVersion } from "./shared/pollable";
import type { UserService } from "./user-service";

const inspectorInstancePayloadSchema = z.object({
  wallVkId: vkIdSchema,
  postVkId: vkIdSchema,
  commentVkId: vkIdSchema,
  commenterVkDomain: vkDomainSchema,
  commenterName: z.string(),
  commenterAvatarUrl: z.url(),
});

export type InspectorInstancePayload = z.infer<
  typeof inspectorInstancePayloadSchema
>;

const inspectorTabSchema = z.enum(["activity", "report"]);
export type InspectorTab = z.infer<typeof inspectorTabSchema>;

const inspectorInstanceConfigSchema = z.readonly(
  z.extend(inspectorInstancePayloadSchema, {
    tab: inspectorTabSchema,
    triggeredAt: isoTimeSchema,
  }),
);

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

export type InspectorInstanceConfig = z.infer<
  typeof inspectorInstanceConfigSchema
>;

const inspectorServiceConfigSchema = z.readonly(
  z.object({
    instanceByContentId: z.readonly(
      z.record(contentIdSchema, inspectorInstanceConfigSchema),
    ),
  }),
);
export type InspectorServiceConfig = z.infer<
  typeof inspectorServiceConfigSchema
>;

const defaultInspectorServiceConfig: InspectorServiceConfig = {
  instanceByContentId: {},
};

export const inspectorStore = defineStoreWithSchema(
  "session:inspector",
  inspectorServiceConfigSchema,
);

export class InspectorService {
  private pollableInspectorInstanceByContentId: Record<
    ContentId,
    Pollable<InspectorInstanceConfig | undefined>
  > = {};
  private readonly notificationService: NotificationService;
  private readonly userService: UserService;
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
    notificationService,
    userService,
    vkDomainResolver,
  }: {
    notificationService: NotificationService;
    userService: UserService;
    vkDomainResolver: VkDomainResolver;
  }) {
    this.notificationService = notificationService;
    this.userService = userService;
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

    const authStatus = this.userService.getAuthStatus();

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

    const fetchPromise = this.userService.robustlyFetchFromDynamicApi(
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
      void this.userService.checkAuth();
    }

    if (fetchResult.success) {
      if (fetchResult.data.remainingPermissionLookup) {
        this.userService.patchPermissionLookup(
          fetchResult.data.remainingPermissionLookup,
        );
      }

      if (fetchResult.data.remainingPoints) {
        this.userService.patchPointCount(fetchResult.data.remainingPoints);
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
