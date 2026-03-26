import type { AccountInsertionConfig } from "@/shared/@model/insertion-configs/account";
import { omitUndefined } from "@/shared/omit-undefined";

import { defineInsertionVariant } from "../insertion-variant-typings";
import { extractAccountAvatarUrlFromMarkup } from "./shared/@markup-data/account-avatar";
import { extractAccountIdentifierFromMarkup } from "./shared/@markup-data/account-identifier";
import { extractAccountNameFromMarkup } from "./shared/@markup-data/account-name";
import { createUiWithActionBar as mountUiWithActionBar } from "./shared/@markup-ui/action-bar";
import { mountUiWithAffiliationBadge } from "./shared/@markup-ui/affiliation-badge";
import { mountUiWithAffiliationHighlight } from "./shared/@markup-ui/affiliation-highlight";
import {
  mountUiWithRegDate,
  type RegDateInfo,
} from "./shared/@markup-ui/reg-date";
import type {
  AccountInsertionMarkupData as AccountMarkupData,
  AccountInsertionServiceData as AccountServiceData,
} from "./shared/account-insertion-payload";
import { warnAboutUndefinedFields } from "./shared/helpers-for-logger";
import { applyMarkupEdits } from "./shared/markup-edits";

export type AccountInnerData = {
  regDateInfo?: RegDateInfo;
};

export default defineInsertionVariant<
  AccountInsertionConfig,
  AccountInnerData,
  AccountMarkupData,
  AccountServiceData
>({
  defaultInnerData: {},

  getMarkupData: async ({ config, instanceLogger, rootElement }) => {
    const accountAvatarUrl = extractAccountAvatarUrlFromMarkup(
      rootElement,
      config.markup.data.accountAvatar,
    );

    const accountIdentifierPromise = extractAccountIdentifierFromMarkup(
      rootElement,
      config.markup.data.accountIdentifier,
      instanceLogger,
    );

    const accountNamePromise = extractAccountNameFromMarkup(
      rootElement,
      config.markup.data.accountName,
      instanceLogger,
    );

    const [accountIdentifier, accountName] = await Promise.all([
      accountIdentifierPromise,
      accountNamePromise,
    ]);

    if (!accountIdentifier || !accountName) {
      warnAboutUndefinedFields(
        instanceLogger,
        "Unable to proceed, markup data is undefined for",
        { accountIdentifier, accountName },
      );

      return;
    }

    warnAboutUndefinedFields(
      instanceLogger,
      "Could not extract markup data for",
      {
        accountAvatarUrl,
      },
    );

    return {
      accountAvatarUrl,
      accountIdentifier,
      accountName,
    };
  },

  getServiceData: async ({
    markupData,
    serviceLookup: { affiliationService, frontendService },
  }) => {
    const [accountAffiliation, frontendBaseUrl] = await Promise.all([
      affiliationService.checkAccount(markupData.accountIdentifier),
      frontendService.getBaseUrl(),
    ]);

    return omitUndefined({
      accountAffiliation,
      frontendBaseUrl,
    });
  },

  mount: ({
    config,
    contentId,
    derivedPageInfo,
    instanceLogger,
    rootElement,
    serviceLookup,
    updateInnerData,
  }) => {
    const cleanupMarkupEdits = applyMarkupEdits(
      rootElement,
      config.markup.edits,
    );

    const actionBarUi = mountUiWithActionBar({
      contentId,
      derivedPageInfo,
      instanceLogger,
      placement: config.markup.ui.actionBar,
      rootElement,
      serviceLookup,
      onRegDateInfoChange: (regDateInfo) => {
        updateInnerData((draft) => {
          if (regDateInfo) {
            draft.regDateInfo = regDateInfo;
          } else {
            delete draft.regDateInfo;
          }
        });
      },
    });

    const affiliationBadgeUi = mountUiWithAffiliationBadge({
      rootElement,
      placement: config.markup.ui.affiliationBadge,
    });

    const affiliationHighlightUi = mountUiWithAffiliationHighlight({
      instanceLogger,
      placement: config.markup.ui.affiliationHighlight,
      rootElement,
    });

    const regDateUi = mountUiWithRegDate({
      instanceLogger,
      placement: config.markup.ui.regDate,
      rootElement,
    });

    return {
      render: ({ innerData, markupData, serviceData }) => {
        actionBarUi?.render(
          omitUndefined({
            accountAffiliation: serviceData.accountAffiliation,
            accountAvatarUrl: markupData.accountAvatarUrl,
            accountIdentifier: markupData.accountIdentifier,
            accountName: markupData.accountName,
            frontendBaseUrl: serviceData.frontendBaseUrl,
            regDateInfo: innerData.regDateInfo,
          }),
        );

        affiliationBadgeUi?.render(
          omitUndefined({
            accountAffiliation: serviceData.accountAffiliation,
            accountIdentifier: markupData.accountIdentifier,
            frontendBaseUrl: serviceData.frontendBaseUrl,
          }),
        );

        affiliationHighlightUi?.render(
          omitUndefined({
            accountAffiliation: serviceData.accountAffiliation,
            accountIdentifier: markupData.accountIdentifier,
            frontendBaseUrl: serviceData.frontendBaseUrl,
          }),
        );

        regDateUi?.render(
          omitUndefined({
            regDate: innerData.regDateInfo,
          }),
        );
      },

      unmount: () => {
        actionBarUi?.unmount();
        affiliationBadgeUi?.unmount();
        affiliationHighlightUi?.unmount();
        regDateUi?.unmount();

        cleanupMarkupEdits();
      },
    };
  },
});
