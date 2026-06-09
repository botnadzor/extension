import { isEqual } from "es-toolkit";
import { produce, type Producer } from "immer";
import type { WritableDeep } from "type-fest";
import { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  type TriggeredNotification,
  type TriggeredNotificationPayload,
  triggeredNotificationSchema,
} from "@/shared/@model/notifications";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { type ContentId, contentIdSchema } from "@/shared/@primitives/misc";
import {
  type IsoDateTime,
  isoDateTimeSchema,
} from "@/shared/@primitives/temporal";

import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";

const globalNotificationsStateSchema = z.readonly(
  z.object({
    welcomeMessageShownAt: z.exactOptional(isoDateTimeSchema),
    welcomeMessageReadAt: z.exactOptional(isoDateTimeSchema),
    announcementReadAtByCreatedAt: z.readonly(
      z._default(z.record(z.string(), isoDateTimeSchema), {}),
    ),
  }),
);

type GlobalNotificationsState = z.infer<typeof globalNotificationsStateSchema>;

const logger = getBackgroundLogger(["notification-service"]);

const globalNotificationsStore = defineStoreWithSchema(
  "sync:global-notifications",
  globalNotificationsStateSchema,
);

const defaultGlobalNotificationsState: GlobalNotificationsState = {
  announcementReadAtByCreatedAt: {},
};

const triggeredNotificationsConfigSchema = z.readonly(
  z.object({
    notificationByContentId: z.readonly(
      z.record(contentIdSchema, triggeredNotificationSchema),
    ),
  }),
);

type TriggeredNotificationsConfig = z.infer<
  typeof triggeredNotificationsConfigSchema
>;

const triggeredNotificationsStore = defineStoreWithSchema(
  "session:triggered-notifications",
  triggeredNotificationsConfigSchema,
);

export class NotificationService {
  private pollableGlobalNotificationsState: Pollable<
    GlobalNotificationsState | undefined
  >;
  private pollableTriggeredNotificationByContentId: Record<
    ContentId,
    Pollable<TriggeredNotification | undefined>
  > = {};

  constructor() {
    this.pollableGlobalNotificationsState = new Pollable<
      GlobalNotificationsState | undefined
    >(undefined);
    void this.startLoadingGlobalNotificationsStateWithStore();

    void triggeredNotificationsStore.getValue().then((value) => {
      if (value) {
        for (const [rawContentId, notificationConfig] of Object.entries(
          value.notificationByContentId,
        )) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.keys returns a string array (limitation of TS)
          const contentId = rawContentId as ContentId;

          this.pollableTriggeredNotificationByContentId[contentId] ??=
            new Pollable<TriggeredNotification | undefined>(notificationConfig);

          this.pollableTriggeredNotificationByContentId[contentId].setValue(
            notificationConfig,
          );
        }
      }
    });
  }

  private async startLoadingGlobalNotificationsStateWithStore() {
    try {
      this.pollableGlobalNotificationsState.setValue(
        (await globalNotificationsStore.getValue()) ??
          defaultGlobalNotificationsState,
      );
    } catch (error) {
      logger.error("Failed to initialize global notifications state: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.pollableGlobalNotificationsState.setValue(
        defaultGlobalNotificationsState,
      );
    }
  }

  async pollTriggeredNotification(
    lastPollVersion: PollVersion | undefined,
    contentId: ContentId,
  ): Promise<PollResult<TriggeredNotification | undefined>> {
    this.pollableTriggeredNotificationByContentId[contentId] ??= new Pollable<
      TriggeredNotification | undefined
    >(undefined);

    return this.pollableTriggeredNotificationByContentId[contentId].poll(
      lastPollVersion,
    );
  }

  async trigger(
    contentId: ContentId,
    payload: TriggeredNotificationPayload | undefined,
  ): Promise<void> {
    const pollableTriggeredNotification =
      (this.pollableTriggeredNotificationByContentId[contentId] ??=
        new Pollable<TriggeredNotification | undefined>(undefined));

    if (!payload && pollableTriggeredNotification.getValue() === undefined) {
      return;
    }

    const newValue = payload
      ? { ...payload, triggeredAt: isoDateTimeSchema.parse(new Date()) }
      : undefined;

    pollableTriggeredNotification.setValue(newValue);

    const newStoreValue: WritableDeep<TriggeredNotificationsConfig> = {
      notificationByContentId: {},
    };

    for (const [
      currentRawContentId,
      pollableNotificationConfig,
    ] of Object.entries(this.pollableTriggeredNotificationByContentId)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.keys returns a string array (limitation of TS)
      const currentContentId = currentRawContentId as ContentId;

      const currentValue = pollableNotificationConfig.getValue();

      if (currentValue) {
        newStoreValue.notificationByContentId[currentContentId] = currentValue;
      }
    }

    await triggeredNotificationsStore.setValue(newStoreValue);
  }

  private updateGlobalNotificationsState(
    update: Producer<GlobalNotificationsState>,
  ): void {
    const oldState = this.pollableGlobalNotificationsState.getValue();
    if (!oldState) {
      logger.warn(
        "Skipping global notifications update before store initialization",
      );
      return;
    }

    const newState = produce(oldState, update);

    if (isEqual(newState, oldState)) {
      return;
    }

    this.pollableGlobalNotificationsState.setValue(newState);
    void globalNotificationsStore.setValue(newState);
  }

  markWelcomeAnnouncementAsShown(): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.welcomeMessageShownAt = isoDateTimeSchema.parse(new Date());
    });
  }

  markWelcomeAnnouncementAsRead(): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.welcomeMessageReadAt = isoDateTimeSchema.parse(new Date());
    });
  }

  markAnnouncementAsRead(createdAt: IsoDateTime): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.announcementReadAtByCreatedAt[createdAt] = isoDateTimeSchema.parse(
        new Date(),
      );
    });
  }

  async getGlobalNotificationsState(): Promise<GlobalNotificationsState> {
    const result = await this.pollGlobalNotificationsState(undefined);
    return result.value;
  }

  async pollGlobalNotificationsState(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<GlobalNotificationsState>> {
    let result:
      | PollResult<GlobalNotificationsState>
      | PollResult<undefined>
      | undefined;

    do {
      result = await this.pollableGlobalNotificationsState.poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }
}
