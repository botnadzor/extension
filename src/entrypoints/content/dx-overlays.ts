import type { DxConfig } from "@/shared/@model/dx-config";
import type { PollVersion } from "@/shared/@pollable/core";
import {
  backgroundAbortSignal,
  isBackgroundGone,
} from "@/shared/background-availability";
import { dxConfigService } from "@/shared/proxy-services";

function updateOverlayDataAttributes(config: DxConfig): void {
  if (config.insertionFraming) {
    document.documentElement.dataset["bnInsertionFraming"] ??= "true";
  } else {
    delete document.documentElement.dataset["bnInsertionFraming"];
  }

  if (config.insertionLabeling) {
    document.documentElement.dataset["bnInsertionLabeling"] = "true";
  } else {
    delete document.documentElement.dataset["bnInsertionLabeling"];
  }

  if (config.insertionsRemoved) {
    document.documentElement.dataset["bnInsertionsHidden"] = "true";
  } else {
    delete document.documentElement.dataset["bnInsertionsHidden"];
  }
}

export async function startManagingDxOverlays(): Promise<void> {
  let lastVersion: PollVersion | undefined = undefined;
  try {
    for (;;) {
      if (isBackgroundGone()) {
        break;
      }
      const result = await dxConfigService.poll(lastVersion);
      lastVersion = result.version;
      updateOverlayDataAttributes(result.value);
    }
  } catch (error: unknown) {
    if (!isBackgroundGone(error)) {
      // eslint-disable-next-line no-restricted-syntax -- service calls are only expected to throw when background is gone; re-throwing unknown defects
      throw error;
    }
  }

  backgroundAbortSignal.addEventListener("abort", () => {
    delete document.documentElement.dataset["bnInsertionFraming"];
    delete document.documentElement.dataset["bnInsertionLabeling"];
    delete document.documentElement.dataset["bnInsertionsHidden"];
  });
}
