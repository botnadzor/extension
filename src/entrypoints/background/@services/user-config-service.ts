import { delay } from "es-toolkit";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  defaultUserConfig,
  type UserConfig,
  userConfigSchema,
} from "@/shared/@model/user-config";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";

import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";

const logger = getBackgroundLogger(["user-config-service"]);

const userConfigStore = defineStoreWithSchema(
  "sync:user-config",
  userConfigSchema,
);

export class UserConfigService {
  private disposed = false;
  private pollableUserConfig: Pollable<UserConfig | undefined>;

  private readonly storeWriteThrottleInMs = 1000;

  constructor() {
    this.pollableUserConfig = new Pollable<UserConfig | undefined>(undefined);
    void this.startSyncingUserConfigWithStore();
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async startSyncingUserConfigWithStore() {
    this.pollableUserConfig.setValue(
      (await userConfigStore.getValue()) ?? defaultUserConfig,
    );

    let result = await this.poll(undefined);

    while (!this.disposed) {
      await delay(this.storeWriteThrottleInMs);
      result = await this.poll(result.version);
      await userConfigStore.setValue(result.value);
      logger.debug("Wrote user config to store");
    }
  }

  async poll(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<UserConfig>> {
    let result: PollResult<UserConfig> | PollResult<undefined> | undefined;

    do {
      result = await this.pollableUserConfig.poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }

  async get(): Promise<UserConfig> {
    const result = await this.poll(undefined);
    return result.value;
  }

  set(newValue: UserConfig): void {
    this.pollableUserConfig.setValue(newValue);
  }
}
