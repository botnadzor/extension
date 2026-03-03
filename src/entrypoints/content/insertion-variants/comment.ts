import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import type { CommentInsertionConfig } from "@/shared/@model/insertion-configs/comment";
import type { StringDataSelector } from "@/shared/@model/insertion-configs/shared/primitives";
import {
  type AccountIdentifier,
  type PositiveVkId,
  positiveVkIdSchema,
  stringifyAccountIdentifier,
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

type CommentIdentifier = {
  postType: "photo" | "video" | "wall";
  wallVkId: VkId;
  postVkId: PositiveVkId;
  commentVkId: PositiveVkId;
};

type CommentMarkupData = {
  accountAvatarUrl: string;
  accountIdentifier: AccountIdentifier;
  accountName: string;
  commentIdentifier?: CommentIdentifier;
  postCommentCount?: number;
};

type CommentServiceData = {
  accountAffiliation?: AccountAffiliation;
  frontendBaseUrl: string;
};

export type CommentInnerData = {
  regDateInfo?: RegDateInfo;
};

/**
 * Supports values like:
 * - /wall-123_456?reply=789
 * - https://vk.com/photo-123_456?reply=789
 * - https://m.vk.ru/video123_456?reply=789
 * - ... replyClick('wall-123_456', 798 ...
 * - ... replyClick('123_456', 798 ...
 * - ... replyClick('-123_photo456', 798 ...
 */
async function extractCommentIdentifierFromMarkup(
  rootElement: HTMLElement,
  commentIdentifierSelector: StringDataSelector | undefined,
): Promise<CommentIdentifier | undefined> {
  return resolveStringDataSelector(
    rootElement,
    commentIdentifierSelector,
    (value) => {
      // Try URL format: /wall-123_456?reply=789 or https://vk.com/photo-123_456?reply=789
      const urlRegexp =
        /(?:https?:\/\/[^/]+)?\/(photo|video|wall)(-?\d+)_(\d+)/;
      const urlMatch = urlRegexp.exec(value);

      if (urlMatch) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type assertion corresponds to the regexp
        const postType = urlMatch[1] as "photo" | "video" | "wall";
        const wallVkIdResult = vkIdSchema.safeParse(Number(urlMatch[2]));
        const postVkIdResult = positiveVkIdSchema.safeParse(
          Number(urlMatch[3]),
        );

        if (!wallVkIdResult.success || !postVkIdResult.success) {
          return;
        }

        // Extract ?reply=789 parameter
        const replyMatch = /[?&]reply=(\d+)/.exec(value);
        const commentNumber = replyMatch
          ? Number(replyMatch[1])
          : Number(urlMatch[3]);

        const commentVkIdResult = positiveVkIdSchema.safeParse(commentNumber);
        if (!commentVkIdResult.success) {
          return;
        }

        return {
          postType,
          wallVkId: wallVkIdResult.data,
          postVkId: postVkIdResult.data,
          commentVkId: commentVkIdResult.data,
        };
      }

      // Try replyClick format: replyClick('wall-123_456', 789) or replyClick('-123_photo456', 789) or replyClick('-123_456', 789)
      const replyClickMatch =
        /replyClick\('(wall|photo|video)?(-?\d+)_(photo|video)?(\d+)'\s*,\s*(\d+)/.exec(
          value,
        );
      if (replyClickMatch) {
        // Detect post type from prefix (wall/photo/video before first number) or infix (photo/video between numbers)
        const prefixType = replyClickMatch[1]; // e.g., 'wall' in "wall-123_456"
        const infixType = replyClickMatch[3]; // e.g., 'photo' in "-123_photo456"

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type assertion corresponds to the regexp
        const postType = (prefixType ?? infixType ?? "wall") as
          | "wall"
          | "photo"
          | "video";

        const wallVkIdResult = vkIdSchema.safeParse(Number(replyClickMatch[2]));
        const postVkIdResult = positiveVkIdSchema.safeParse(
          Number(replyClickMatch[4]),
        );
        const commentVkIdResult = positiveVkIdSchema.safeParse(
          Number(replyClickMatch[5]),
        );

        if (
          !wallVkIdResult.success ||
          !postVkIdResult.success ||
          !commentVkIdResult.success
        ) {
          return;
        }

        return {
          postType,
          wallVkId: wallVkIdResult.data,
          postVkId: postVkIdResult.data,
          commentVkId: commentVkIdResult.data,
        };
      }

      return;
    },
  );
}

async function extractPostCommentCountFromMarkup(
  rootElement: HTMLElement,
  postCommentCountSelector: StringDataSelector | undefined,
): Promise<number | undefined> {
  return resolveStringDataSelector(
    rootElement,
    postCommentCountSelector,
    (value) => {
      const digitsOnly = value.replaceAll(/\D+/g, "");
      if (!digitsOnly) {
        return;
      }

      return Number(digitsOnly);
    },
  );
}

export default defineInsertionVariant<
  CommentInsertionConfig,
  CommentInnerData,
  CommentMarkupData,
  CommentServiceData
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

    const commentIdentifierPromise = extractCommentIdentifierFromMarkup(
      rootElement,
      config.markup.data.commentIdentifier || undefined,
    );

    const postCommentCountPromise = extractPostCommentCountFromMarkup(
      rootElement,
      config.markup.data.postCommentCount || undefined,
    );

    const [
      accountIdentifier,
      accountName,
      commentIdentifier,
      postCommentCount,
    ] = await Promise.all([
      accountIdentifierPromise,
      accountNamePromise,
      commentIdentifierPromise,
      postCommentCountPromise,
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
        commentIdentifier:
          config.markup.data.commentIdentifier === false
            ? "ignored"
            : commentIdentifier,
        postCommentCount:
          config.markup.data.postCommentCount === false
            ? "ignored"
            : postCommentCount,
      },
    );

    return omitUndefined({
      accountAvatarUrl,
      accountIdentifier,
      accountName,
      commentIdentifier,
      postCommentCount,
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
        if (markupData.commentIdentifier && !derivedPageInfo.archivedSnapshot) {
          void serviceLookup.collectingService.collectCommentIfNeeded({
            wallVkId: markupData.commentIdentifier.wallVkId,
            postVkId: markupData.commentIdentifier.postVkId,
            commentVkId: markupData.commentIdentifier.commentVkId,
            commenterVkDomain: stringifyAccountIdentifier(
              markupData.accountIdentifier,
            ),
            postCommentCount: undefined,
          });
        }

        actionBarUi?.render(
          omitUndefined({
            accountAffiliation: serviceData.accountAffiliation,
            accountAvatarUrl: markupData.accountAvatarUrl,
            accountIdentifier: markupData.accountIdentifier,
            accountName: markupData.accountName,
            frontendBaseUrl: serviceData.frontendBaseUrl,
            inspectorTrigger: markupData.commentIdentifier
              ? { type: "comment" as const, ...markupData.commentIdentifier }
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
