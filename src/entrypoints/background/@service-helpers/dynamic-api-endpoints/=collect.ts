import { z } from "zod/mini";

import { accessCodeSchema } from "@/shared/@primitives/misc";
import {
  positiveVkIdSchema,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/@primitives/vk";

import { base } from "./base";
import {
  problemSchemaForInvalidAccessCode,
  problemSchemaForInvalidPayload,
  problemSchemaForUnforeseenError,
} from "./problems";

export const contractForCollect = base
  .route({
    path: "/collect",
  })
  .input(
    z.object({
      body: z.object({
        accessCode: accessCodeSchema,

        groupedComments: z.array(
          z.object({
            wallVkId: vkIdSchema,
            postVkId: positiveVkIdSchema,
            commentCount: z.exactOptional(z.int().check(z.nonnegative())),
            comments: z.array(
              z.object({
                commentVkId: positiveVkIdSchema,
                commenterVkIdOrNickname: z.union([
                  positiveVkIdSchema,
                  vkDomainSchema,
                ]),
              }),
            ),
          }),
        ),
      }),
    }),
  )
  .output(
    z.object({
      body: z.union([
        z.object({
          problem: z.exactOptional(z.literal(false)),
        }),
        problemSchemaForInvalidAccessCode,
        problemSchemaForInvalidPayload,
        problemSchemaForUnforeseenError,
      ]),
    }),
  );
