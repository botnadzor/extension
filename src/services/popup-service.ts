import { type PopupTab, popupTabs } from "@/lib/primitive-values";
import { browser } from "#imports";

import { Pollable, type PollResult, type PollVersion } from "./shared/pollable";

export class PopupService {
  private pollableActiveTab: Pollable<PopupTab>;

  constructor() {
    this.pollableActiveTab = new Pollable<PopupTab>(popupTabs[0]);
  }

  getActiveTab(): PopupTab {
    return this.pollableActiveTab.getValue();
  }

  pollActiveTab(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<PopupTab>> {
    return this.pollableActiveTab.poll(lastPollVersion);
  }

  setActiveTab(tab: PopupTab): void {
    this.pollableActiveTab.setValue(tab);
  }

  open({ tab }: { tab: PopupTab }): Promise<void> {
    this.setActiveTab(tab);
    return browser.action.openPopup();
  }
}
