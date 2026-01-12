import { z } from "zod/mini";

import type { VkDomain, VkId } from "@/lib/primitive-values";

import {
  legacyPermissionsSchema,
  mapLegacyPermissionsToPermissionLookup,
  permissionLookupSchema,
} from "../../../lib/permissions";
import { convertLegacyErrorToDynamicApiError } from "./helpers";
import type { DynamicApiEndpointDefinition } from "./types";

// cspell:ignore Стрельцова лайкнули altapress ботоферма лайкнутые

const legacyMarkTitleSchema = z.pipe(
  z.nullable(z.string()),
  // eslint-disable-next-line unicorn/no-null -- null may occur in legacy response shape
  z.transform((value) => (value === "" ? null : value)),
);

const nullableUrlSchema = z.union([
  z.null(),
  z.pipe(
    z.string(),
    z.pipe(
      // eslint-disable-next-line unicorn/no-null -- null may occur in legacy response shape
      z.transform((value: string) => (value === "" ? null : value)),
      z.union([z.null(), z.url()]),
    ),
  ),
]);

const legacyCommentSchema = z.readonly(
  z.object({
    count: z.exactOptional(z.nullable(z.number())), // e.g 547
    name: z.string(), // e.g "АСТ-54"
    color: z.nullable(z.string()), // e.g "rgba(253, 167, 223, 0.6)"
    link: z.url(), // e.g "https://vk.com/club31101527"
    photo: nullableUrlSchema, // e.g. "https://sun9-23.userapi.com/s/v1/ig2/A2eBnT_ucMlAPFnfMWL72CpaRMJgeo8LINkbyDeGB7sL4nIgtcfwYgybnjPa_Vb1pXdgVfmL3Dea__ofaRp6Tv3U.jpg?quality=95&crop=36,76,320,320&as=32x32,48x48,72x72,108x108,160x160,240x240&ava=1&cs=200x200"
    mark: z.exactOptional(z.nullable(z.xor([z.string(), z.number()]))),
  }),
);

const legacyLikeLinkSchema = z.readonly(
  z.object({
    url: z.string(), // e.g "https://vk.com/wall-20351570_215747?reply=215779&thread=215762",
    title: z.string(), // e.g "Мария Стрельцова",
    src: nullableUrlSchema, // ава группы где лайкнули коммент
    data: z.string(), // e.g "1. altapress"
  }),
);

const legacyLikePhotoSchema = z.readonly(
  z.object({
    src: nullableUrlSchema, // e.g "https://sun9-40.userapi.com/s/v1/ig2/eyrzB6Zrsy6k23zXQLkzTpCoXTVhTTQJzTTzEAHFf5Re3PuxnxHk-K3Yhl4QoQ1oz8ZXNbJsSzhDz8AjvyQYYIZJ.jpg?quality=95&crop=0,0,1080,1080&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&ava=1&cs=200x200",
    title: z.string(), // e.g "altapress - 1"
  }),
);

const legacyLikeToBotSchema = z.readonly(
  z.object({
    bot_id: z.number(), // e.g 853104620
    bot_name: z.nullable(z.string()), // e.g "Мария Стрельцова"
    mark: z.nullable(z.string()), // e.g "Алтайский край"
    mark_color: z.nullable(z.string()), // e.g "linear-gradient(to right, #fd79a8, #5d5d5d)"
    mark_title: legacyMarkTitleSchema, // e.g "Маркировка: Бот/Накрутка\nРегиональная ботоферма: Алтайский край",
    photos: z.array(legacyLikePhotoSchema), // иконки групп
    links: z.array(legacyLikeLinkSchema), // ссылки на лайкнутые комментарии
  }),
);

const legacyResponseSchema = z.xor([
  z.readonly(
    z.object({
      error: z.nullable(z.string()),
    }),
  ),
  z.readonly(
    z.object({
      points_left: z.exactOptional(z.number()),
      permission_left: z.exactOptional(legacyPermissionsSchema),
      name: z.nullable(z.string()),
      mark: z.nullable(z.string()),
      mark_color: z.nullable(z.string()),
      mark_title: z.nullable(z.string()),
      comments_advanced: z.nullable(z.array(legacyCommentSchema)),
      comments: z.nullable(z.array(legacyCommentSchema)),
      likes: z.nullable(z.array(legacyLikeToBotSchema)),
      reviews: z.nullable(z.array(legacyCommentSchema)),
    }),
  ),
]);

export const responseSchema = z.readonly(
  z.object({
    name: z.exactOptional(z.string()),
    mark: z.exactOptional(z.string()),
    markColor: z.exactOptional(z.string()),
    markTitle: z.exactOptional(z.string()),
    remainingPermissionLookup: z.exactOptional(permissionLookupSchema),
    remainingPoints: z.exactOptional(z.number()),

    // TODO: cleanup schema shapes
    comments: z.exactOptional(z.array(legacyCommentSchema)),
    commentsAdvanced: z.exactOptional(z.array(legacyCommentSchema)),
    likes: z.exactOptional(z.array(legacyLikeToBotSchema)),
    reviews: z.exactOptional(z.array(legacyCommentSchema)),
  }),
);

export const inspectorEndpointDefinition: DynamicApiEndpointDefinition<
  { vkDomainOrId: VkDomain | VkId },
  typeof responseSchema,
  typeof legacyResponseSchema
> = {
  generateUrlSuffix: ({ vkDomainOrId }) => `/inspector/${vkDomainOrId}`,
  responseBodySchema: responseSchema,

  legacyResponseBodySchema: legacyResponseSchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("error" in legacyResponse) {
      return convertLegacyErrorToDynamicApiError(legacyResponse.error);
    }

    return {
      success: true,
      data: {
        ...(legacyResponse.name ? { name: legacyResponse.name } : {}),

        ...(legacyResponse.mark ? { mark: legacyResponse.mark } : {}),

        ...(legacyResponse.permission_left
          ? {
              remainingPermissionLookup: mapLegacyPermissionsToPermissionLookup(
                legacyResponse.permission_left,
              ),
            }
          : {}),

        ...(legacyResponse.points_left
          ? { remainingPoints: legacyResponse.points_left }
          : {}),

        ...(legacyResponse.mark_color
          ? { markColor: legacyResponse.mark_color }
          : {}),

        ...(legacyResponse.mark_title
          ? { markTitle: legacyResponse.mark_title }
          : {}),

        ...(legacyResponse.comments
          ? { comments: legacyResponse.comments }
          : {}),

        ...(legacyResponse.comments_advanced
          ? { commentsAdvanced: legacyResponse.comments_advanced }
          : {}),

        ...(legacyResponse.likes ? { likes: legacyResponse.likes } : {}),
        ...(legacyResponse.reviews ? { reviews: legacyResponse.reviews } : {}),
      },
    };
  },
  generateLegacyUrlSuffix: ({ vkDomainOrId }) =>
    `/?t=info&id=${vkDomainOrId}&format=json`,
};
