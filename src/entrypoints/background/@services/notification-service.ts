import { isEqual } from "es-toolkit";
import { produce, type Producer } from "immer";
import type { WritableDeep } from "type-fest";
import { z } from "zod/mini";

import {
  type TriggeredNotification,
  type TriggeredNotificationPayload,
  triggeredNotificationSchema,
} from "@/shared/@model/triggered-notification";
import { Pollable, type PollResult, type PollVersion } from "@/shared/pollable";
import {
  type ContentId,
  contentIdSchema,
  type IsoTime,
  isoTimeSchema,
} from "@/shared/primitive-values";

import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";

const globalNotificationsStateSchema = z.readonly(
  z.object({
    welcomeMessageShownAt: z.exactOptional(isoTimeSchema),
    welcomeMessageReadAt: z.exactOptional(isoTimeSchema),
    announcementReadAtByCreatedAt: z.readonly(
      z._default(z.record(z.string(), isoTimeSchema), {}),
    ),
  }),
);

type GlobalNotificationsState = z.infer<typeof globalNotificationsStateSchema>;

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
  private pollableGlobalNotificationsState: Pollable<GlobalNotificationsState>;
  private pollableTriggeredNotificationByContentId: Record<
    ContentId,
    Pollable<TriggeredNotification | undefined>
  > = {};

  constructor() {
    this.pollableGlobalNotificationsState = new Pollable(
      defaultGlobalNotificationsState,
    );

    void globalNotificationsStore.getValue().then((value) => {
      if (value) {
        this.pollableGlobalNotificationsState.setValue(value);
      }
    });

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
      ? { ...payload, triggeredAt: isoTimeSchema.parse(new Date()) }
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
    const newState = produce(oldState, update);

    if (isEqual(newState, oldState)) {
      return;
    }

    this.pollableGlobalNotificationsState.setValue(newState);
    void globalNotificationsStore.setValue(newState);
  }

  markWelcomeAnnouncementAsShown(): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.welcomeMessageShownAt = isoTimeSchema.parse(new Date());
    });
  }

  markWelcomeAnnouncementAsRead(): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.welcomeMessageReadAt = isoTimeSchema.parse(new Date());
    });
  }

  markAnnouncementAsRead(createdAt: IsoTime): void {
    this.updateGlobalNotificationsState((draft) => {
      draft.announcementReadAtByCreatedAt[createdAt] = isoTimeSchema.parse(
        new Date(),
      );
    });
  }

  async pollGlobalNotificationsState(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<GlobalNotificationsState>> {
    return this.pollableGlobalNotificationsState.poll(lastPollVersion);
  }
}
