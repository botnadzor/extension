import { delay } from "es-toolkit";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  defaultDxConfig,
  type DxConfig,
  dxConfigSchema,
} from "@/shared/@model/dx-config";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { getAppConfig } from "#imports";

import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";

const logger = getBackgroundLogger(["dx-config-service"]);

const dxConfigStore = defineStoreWithSchema("sync:dx-config", dxConfigSchema);

export class DxConfigService {
  private disposed = false;
  private pollableDxConfig: Pollable<DxConfig | undefined>;

  private readonly storeWriteThrottleInMs = 1000;

  constructor() {
    this.pollableDxConfig = new Pollable<DxConfig | undefined>(undefined);

    if (getAppConfig().dxFeaturesEnabled) {
      void this.startSyncingDxConfigWithStore();
    } else {
      // Always return default DX config when DX features are disabled
      this.pollableDxConfig.setValue(defaultDxConfig);
    }
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async startSyncingDxConfigWithStore() {
    this.pollableDxConfig.setValue(
      (await dxConfigStore.getValue()) ?? defaultDxConfig,
    );

    let result = await this.poll(undefined);

    while (!this.disposed) {
      await delay(this.storeWriteThrottleInMs);
      result = await this.poll(result.version);
      await dxConfigStore.setValue(result.value);
      logger.debug("Wrote DX config to store");
    }
  }

  async poll(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<DxConfig>> {
    let result: PollResult<DxConfig> | PollResult<undefined> | undefined;

    do {
      result = await this.pollableDxConfig.poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }

  async get(): Promise<DxConfig> {
    const result = await this.poll(undefined);
    return result.value;
  }

  set(newValue: DxConfig): void {
    if (!getAppConfig().dxFeaturesEnabled) {
      logger.warn("DX features are disabled, skipping DX config update");
      return;
    }

    this.pollableDxConfig.setValue(newValue);
  }
}
