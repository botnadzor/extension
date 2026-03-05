import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { ReviewInsertionConfig } from "@/shared/@model/insertion-configs/review";
import type { StringDataSelector } from "@/shared/@model/insertion-configs/shared/primitives";
import {
  type AccountIdentifier,
  type PositiveVkId,
  positiveVkIdSchema,
  type VkId,
  vkIdSchema,
} from "@/shared/@primitives/vk";
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
import { warnAboutUndefinedFields } from "./shared/helpers-for-logger";
import { applyMarkupEdits } from "./shared/markup-edits";
import { resolveStringDataSelector } from "./shared/selector-resolution";

type ReviewIdentifier = {
  wallVkId: VkId;
  reviewVkId: PositiveVkId;
};

export type ReviewInnerData = {
  regDateInfo?: RegDateInfo;
};

type ReviewMarkupData = {
  accountAvatarUrl: string;
  accountIdentifier: AccountIdentifier;
  accountName: string;
  reviewIdentifier?: ReviewIdentifier;
};

type ReviewServiceData = {
  accountAffiliation?: AccountAffiliation;
  frontendBaseUrl: string;
};

async function extractReviewIdentifierFromMarkup(
  rootElement: HTMLElement,
  reviewIdentifierSelector: StringDataSelector | undefined,
): Promise<ReviewIdentifier | undefined> {
  return resolveStringDataSelector(
    rootElement,
    reviewIdentifierSelector,
    (value) => {
      const match = /^review(-?\d+)_(\d+)$/.exec(value) ?? [];

      const wallVkIdResult = vkIdSchema.safeParse(Number(match[1]));
      const reviewVkIdResult = positiveVkIdSchema.safeParse(Number(match[2]));

      if (!wallVkIdResult.success || !reviewVkIdResult.success) {
        return;
      }

      return {
        wallVkId: wallVkIdResult.data,
        reviewVkId: reviewVkIdResult.data,
      };
    },
  );
}

export default defineInsertionVariant<
  ReviewInsertionConfig,
  ReviewInnerData,
  ReviewMarkupData,
  ReviewServiceData
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
    );

    const accountNamePromise = extractAccountNameFromMarkup(
      rootElement,
      config.markup.data.accountName,
    );

    const reviewIdentifierPromise = extractReviewIdentifierFromMarkup(
      rootElement,
      config.markup.data.reviewIdentifier || undefined,
    );

    const [accountIdentifier, accountName, reviewIdentifier] =
      await Promise.all([
        accountIdentifierPromise,
        accountNamePromise,
        reviewIdentifierPromise,
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
        reviewIdentifier:
          config.markup.data.reviewIdentifier === false
            ? "ignored"
            : reviewIdentifier,
      },
    );

    return omitUndefined({
      accountAvatarUrl,
      accountIdentifier,
      accountName,
      reviewIdentifier,
    });
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
            inspectorTrigger: markupData.reviewIdentifier
              ? { type: "review" as const, ...markupData.reviewIdentifier }
              : undefined,
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
