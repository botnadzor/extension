import { z } from "zod/mini";

import { permissionLookupSchema } from "@/shared/@model/auth";
import {
  accessCodeSchema,
  positiveVkIdSchema,
} from "@/shared/@model/primitives";

import { base } from "./base";
import {
  problemSchemaForInvalidAccessCode,
  problemSchemaForInvalidPayload,
  problemSchemaForMissingPermission,
  problemSchemaForNotFound,
  problemSchemaForRateLimited,
  problemSchemaForUnforeseenError,
} from "./problems";

const classicMarkTitleSchema = z.pipe(
  z.nullable(z.string()),
  // eslint-disable-next-line unicorn/no-null -- null may occur in legacy response shape
  z.transform((value) => (value === "" ? null : value)),
);

const classicNullableUrlSchema = z.union([
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

const classicCommentSchema = z.readonly(
  z.object({
    count: z.exactOptional(z.nullable(z.number())), // e.g 547
    name: z.string(), // e.g "АСТ-54"
    color: z.nullable(z.string()), // e.g "rgba(253, 167, 223, 0.6)"
    link: z.url(), // e.g "https://vk.com/club31101527"
    photo: classicNullableUrlSchema, // e.g. "https://sun9-23.userapi.com/s/v1/ig2/A2eBnT_ucMlAPFnfMWL72CpaRMJgeo8LINkbyDeGB7sL4nIgtcfwYgybnjPa_Vb1pXdgVfmL3Dea__ofaRp6Tv3U.jpg?quality=95&crop=36,76,320,320&as=32x32,48x48,72x72,108x108,160x160,240x240&ava=1&cs=200x200"
    mark: z.exactOptional(z.nullable(z.xor([z.string(), z.number()]))),
  }),
);

const classicLikeLinkSchema = z.readonly(
  z.object({
    url: z.string(), // e.g "https://vk.com/wall-20351570_215747?reply=215779&thread=215762",
    title: z.string(), // e.g "Иван Иванов",
    src: classicNullableUrlSchema, // аватарка группы, где лайкнули коммент
    data: z.string(), // e.g "1. group_slug"
  }),
);

const classicLikePhotoSchema = z.readonly(
  z.object({
    src: classicNullableUrlSchema, // e.g "https://sun9-40.userapi.com/s/v1/ig2/eyrzB6Zrsy6k23zXQLkzTpCoXTVhTTQJzTTzEAHFf5Re3PuxnxHk-K3Yhl4QoQ1oz8ZXNbJsSzhDz8AjvyQYYIZJ.jpg?quality=95&crop=0,0,1080,1080&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&ava=1&cs=200x200",
    title: z.string(), // e.g "group_slug - 1"
  }),
);

const classicLikeToBotSchema = z.readonly(
  z.object({
    bot_id: z.number(), // e.g 853104620
    bot_name: z.nullable(z.string()), // e.g "Иван Иванов"
    mark: z.nullable(z.string()), // e.g "Алтайский край"
    mark_color: z.nullable(z.string()), // e.g "linear-gradient(to right, #fd79a8, #5d5d5d)"
    mark_title: classicMarkTitleSchema, // e.g "Маркировка: Бот/Накрутка\nРегиональная ботоферма: Алтайский край",
    photos: z.array(classicLikePhotoSchema), // иконки групп
    links: z.array(classicLikeLinkSchema), // ссылки на лайкнутые комментарии
  }),
);

export const contractForInspectAccount = base
  .route({
    path: "/inspect-account",
  })
  .input(
    z.object({
      body: z.object({
        accessCode: accessCodeSchema,

        vkId: positiveVkIdSchema,
      }),
    }),
  )
  .output(
    z.object({
      body: z.union([
        z.object({
          problem: z.exactOptional(z.literal(false)),

          // Same data shape as in v 1.x (to be revisited later)
          classic: z.object({
            name: z.nullable(z.string()),
            mark: z.nullable(z.string()),
            mark_color: z.nullable(z.string()),
            mark_title: z.nullable(z.string()),
            comments_advanced: z.nullable(z.array(classicCommentSchema)),
            comments: z.nullable(z.array(classicCommentSchema)),
            likes: z.nullable(z.array(classicLikeToBotSchema)),
            reviews: z.nullable(z.array(classicCommentSchema)),
          }),
          remainingPermissionLookup: z.exactOptional(permissionLookupSchema),
          remainingPointCount: z.exactOptional(z.number()),
        }),
        problemSchemaForInvalidAccessCode,
        problemSchemaForInvalidPayload,
        problemSchemaForMissingPermission,
        problemSchemaForNotFound,
        problemSchemaForRateLimited,
        problemSchemaForUnforeseenError,
      ]),
    }),
  );
