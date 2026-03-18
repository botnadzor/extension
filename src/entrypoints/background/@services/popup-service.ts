import type {
  AlwaysAvailableLowestLogLevel,
  LowestLogLevel,
} from "@/shared/@logging/setup";
import { type PopupTab, popupTabs } from "@/shared/@model/popup";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { browser } from "#imports";

const defaultDebugTabLowestLogLevel: AlwaysAvailableLowestLogLevel = "warning";

export class PopupService {
  private pollableActiveTab: Pollable<PopupTab>;
  private pollableDebugTabLowestLogLevel: Pollable<LowestLogLevel>;

  constructor() {
    this.pollableActiveTab = new Pollable<PopupTab>(popupTabs[0]);
    this.pollableDebugTabLowestLogLevel = new Pollable<LowestLogLevel>(
      defaultDebugTabLowestLogLevel,
    );
  }

  getActiveTab(): PopupTab {
    return this.pollableActiveTab.getValue();
  }

  pollActiveTab(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<PopupTab>> {
    return this.pollableActiveTab.poll(lastPollVersion);
  }

  getDebugTabLowestLogLevel(): LowestLogLevel {
    return this.pollableDebugTabLowestLogLevel.getValue();
  }

  pollDebugTabLowestLogLevel(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<LowestLogLevel>> {
    return this.pollableDebugTabLowestLogLevel.poll(lastPollVersion);
  }

  setActiveTab(tab: PopupTab): void {
    this.pollableActiveTab.setValue(tab);
  }

  setDebugTabLowestLogLevel(level: LowestLogLevel): void {
    this.pollableDebugTabLowestLogLevel.setValue(level);
  }

  open({ tab }: { tab?: PopupTab }): Promise<void> {
    if (tab) {
      this.setActiveTab(tab);
    }
    return browser.action.openPopup();
  }
}
