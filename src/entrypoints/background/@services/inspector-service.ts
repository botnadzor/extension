import { produce } from "immer";
import { z } from "zod/mini";

import {
  type InspectorInstanceConfig,
  inspectorInstanceConfigSchema,
  type InspectorInstancePayload,
  type InspectorTrigger,
  reportTextMaxLength,
  reportTextMinLength,
} from "@/shared/@model/inspector";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import {
  type ContentId,
  contentIdSchema,
  type TagSuggestion,
} from "@/shared/@primitives/misc";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { isPositiveVkId, type VkDomain } from "@/shared/@primitives/vk";

import type { DynamicApiEndpointOutcome } from "../@service-helpers/dynamic-api-endpoints";
import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";
import type { VkDomainResolver } from "../@service-helpers/vk-domain-resolver";
import type { AuthService } from "./auth-service";
import type { NotificationService } from "./notification-service";

export type ResultOfInspectAccount =
  DynamicApiEndpointOutcome<"inspectAccount">;

export type ResultOfReportAccount = DynamicApiEndpointOutcome<"reportAccount">;

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

  private accountInspectionLookup: Record<VkDomain, ResultOfInspectAccount> =
    {};
  private pendingAccountInspectionLookup: Record<
    VkDomain,
    Promise<ResultOfInspectAccount>
  > = {};
  private pollableAccountInspectionLookup: Record<
    VkDomain,
    Pollable<ResultOfInspectAccount>
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

    if (!authStatus.permissionLookup.inspectAccount) {
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
        triggeredAt: isoDateTimeSchema.parse(new Date()),
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

  async reinspectAccount(vkDomain: VkDomain): Promise<ResultOfInspectAccount> {
    const vkId = await this.vkDomainResolver.resolve(vkDomain);
    if (!vkId) {
      return {
        problem: true,
        type: "bn:ext:unforeseen-error",
        description: "Не получилось получить ID аккаунта",
      };
    }

    if (!isPositiveVkId(vkId)) {
      return {
        problem: true,
        type: "bn:ext:invalid-payload",
        description: "Инспектор не поддерживает проверку сообществ",
        fields: ["vkId"],
      };
    }

    if (this.pendingAccountInspectionLookup[vkDomain]) {
      return this.pendingAccountInspectionLookup[vkDomain];
    }

    const fetchPromise = this.authService.fetchFromDynamicApiWithAccessCode(
      "inspectAccount",
      { vkId },
    );

    this.pendingAccountInspectionLookup[vkDomain] = fetchPromise;

    const outcome = await fetchPromise;

    if (Object.hasOwn(this.pendingAccountInspectionLookup, vkDomain)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- vkDomain is present based on Object.hasOwn check
      delete this.pendingAccountInspectionLookup[vkDomain];
    }

    if (outcome.problem && outcome.type === "bn:ext:invalid-access-code") {
      void this.authService.checkAuth();
    }

    if (!outcome.problem) {
      if (outcome.remainingPermissionLookup) {
        this.authService.patchPermissionLookup(
          outcome.remainingPermissionLookup,
        );
      }

      if (outcome.remainingPointCount) {
        this.authService.patchPointCount(outcome.remainingPointCount);
      }
    }

    this.accountInspectionLookup[vkDomain] = outcome;
    this.pollableAccountInspectionLookup[vkDomain]?.setValue(outcome);

    return outcome;
  }

  async getAccountInspection(
    vkDomain: VkDomain,
  ): Promise<ResultOfInspectAccount> {
    return (
      this.pendingAccountInspectionLookup[vkDomain] ??
      this.accountInspectionLookup[vkDomain] ??
      this.reinspectAccount(vkDomain)
    );
  }

  async pollAccountInspection(
    lastPollVersion: PollVersion | undefined,
    vkDomain: VkDomain,
  ): Promise<PollResult<ResultOfInspectAccount>> {
    this.pollableAccountInspectionLookup[vkDomain] ??=
      new Pollable<ResultOfInspectAccount>(
        await this.getAccountInspection(vkDomain),
      );

    return this.pollableAccountInspectionLookup[vkDomain].poll(lastPollVersion);
  }

  async submitReport(payload: {
    tagSuggestion: TagSuggestion;
    text: string;
    trigger: InspectorTrigger;
    vkDomain: VkDomain;
  }): Promise<ResultOfReportAccount> {
    const { vkDomain, tagSuggestion, text, trigger } = payload;

    if (text.length < reportTextMinLength) {
      return {
        problem: true,
        type: "bn:ext:invalid-payload",
        description: `Минимальная длина текста: ${reportTextMinLength} символов`,
        fields: ["text"],
      };
    }

    if (text.length > reportTextMaxLength) {
      return {
        problem: true,
        type: "bn:ext:invalid-payload",
        description: `Максимальная длина текста: ${reportTextMaxLength} символов`,
        fields: ["text"],
      };
    }

    const vkId = await this.vkDomainResolver.resolve(vkDomain);
    if (!vkId) {
      return {
        problem: true,
        type: "bn:ext:unforeseen-error",
        description: "Не получилось получить ID аккаунта",
      };
    }

    const outcome = await this.authService.fetchFromDynamicApiWithAccessCode(
      "reportAccount",
      { tagSuggestion, text, trigger, vkId },
    );

    if (outcome.problem) {
      if (outcome.type === "bn:ext:invalid-access-code") {
        void this.authService.checkAuth();
      }

      return outcome;
    }

    if (outcome.remainingPermissionLookup) {
      this.authService.patchPermissionLookup(outcome.remainingPermissionLookup);
    }

    if (outcome.remainingPointCount !== undefined) {
      this.authService.patchPointCount(outcome.remainingPointCount);
    }

    return outcome;
  }
}
