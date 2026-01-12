import { delay, random } from "es-toolkit";

import { getAppConfig } from "@/lib/app-config";
import { getBackgroundLogger } from "@/lib/logging";
import {
  type HexColor,
  hexColorSchema,
  tagIdSchema,
  vkIdSchema,
  vkNicknameSchema,
} from "@/lib/primitive-values";
import type { TagListItem } from "@/lib/static-lists/=tags";

import type { StaticListsService } from "./static-lists-service";
import type { UserService } from "./user-service";

const logger = getBackgroundLogger(["affiliation-service"]);

export type AccountAffiliation = {
  color: HexColor;
  tags: [TagListItem, ...TagListItem[]];
  /** true if user has chosen to not highlight these kinds of accounts */
  hidden?: boolean;
  /** true if the account has a link to a Botnadzor page */
  botnadzorPage?: true;
  /** true if the account has a link to a Botnadzor card */
  botnadzorCard?: true;
};

const extraTagsLookup = {
  nicknamePresent: [
    {
      color: hexColorSchema.parse("#ccccff"),
      type: "accountCategory",
      id: tagIdSchema.parse("devOnlyNicknamePresent"),
      name: "Есть никнейм",
    },
  ],
  idIsOdd: [
    {
      color: hexColorSchema.parse("#ccffff"),
      type: "accountCategory",
      id: tagIdSchema.parse("devOnlyOdd"),
      name: "ID нечётный",
    },
  ],
} satisfies Record<string, TagListItem[]>;

export const fallbackHexColor = hexColorSchema.parse("#888888");

async function generateExtraTags(
  vkDomain: string,
): Promise<TagListItem[] | undefined> {
  await delay(random(300, 500));

  if (/^id\d+$/.test(vkDomain)) {
    const id = Number.parseInt(vkDomain.slice(2));
    return id % 2 ? extraTagsLookup.idIsOdd : undefined;
  }

  return extraTagsLookup.nicknamePresent;
}

export class AffiliationService {
  private readonly staticListsService: StaticListsService;
  private readonly userService: UserService;

  constructor({
    staticListsService,
    userService,
  }: {
    staticListsService: StaticListsService;
    userService: UserService;
  }) {
    this.staticListsService = staticListsService;
    this.userService = userService;
  }

  async checkAccount(
    vkDomain: string,
  ): Promise<AccountAffiliation | undefined> {
    const [, vkIdAsString] = /^id(\d+)$/.exec(vkDomain) ?? [];

    const account = vkIdAsString
      ? await this.staticListsService.findItem(
          "accounts",
          "vkId",
          vkIdSchema.parse(Number(vkIdAsString)),
        )
      : await this.staticListsService.findItem(
          "accounts",
          "vkNickname",
          vkNicknameSchema.parse(vkDomain),
        );

    let tags: TagListItem[] | undefined = [];

    for (const tagId of account?.tagIds ?? []) {
      const tag = await this.staticListsService.findItem("tags", "id", tagId);

      if (tag) {
        tags.push(tag);
      }
    }

    if (!account && tags.length === 0 && getAppConfig().extraTags) {
      tags = await generateExtraTags(vkDomain);

      if (!tags) {
        return undefined;
      }
    }

    const [firstTag, ...otherTags] = tags;
    if (!firstTag) {
      logger.error("No tags found for account {vkDomain}", { vkDomain });
      return undefined;
    }

    const userConfig = await this.userService.getConfig();

    const color =
      userConfig.tagOverrideLookup[firstTag.id]?.color ??
      tags.find((tag) => tag.color)?.color ??
      fallbackHexColor;

    const hidden = userConfig.tagOverrideLookup[firstTag.id]?.hidden;

    const botnadzorPage = tags.some((tag) => tag.botnadzorPage);
    const botnadzorCard = tags.some((tag) => tag.botnadzorCard);

    return {
      color,
      tags: [firstTag, ...otherTags],
      ...(hidden && { hidden: true }),
      ...(botnadzorPage && { botnadzorPage: true }),
      ...(botnadzorCard && { botnadzorCard: true }),
    };
  }
}
