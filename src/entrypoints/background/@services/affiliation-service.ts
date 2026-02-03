import { delay, random } from "es-toolkit";

import {
  type AccountAffiliation,
  fallbackHexColor,
} from "@/shared/@model/account-affiliation";
import {
  hexColorSchema,
  tagIdSchema,
  vkIdSchema,
  vkNicknameSchema,
} from "@/shared/@model/primitives";
import type { TagListItem } from "@/shared/@model/static-lists";
import { getAppConfig } from "@/shared/app-config";
import { getBackgroundLogger } from "@/shared/logging";

import type { StaticListsService } from "./static-lists-service";
import type { UserConfigService } from "./user-config-service";

const logger = getBackgroundLogger(["affiliation-service"]);

const extraTagsLookup = {
  nicknamePresent: [
    {
      color: hexColorSchema.parse("#ccccff"),
      type: "accountCategory",
      id: tagIdSchema.parse("d1000001"),
      name: "Есть никнейм",
    },
  ],
  idIsOdd: [
    {
      color: hexColorSchema.parse("#ccffff"),
      type: "accountCategory",
      id: tagIdSchema.parse("d1000002"),
      name: "ID нечётный",
    },
  ],
} satisfies Record<string, TagListItem[]>;

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
  private readonly userConfigService: UserConfigService;

  constructor({
    staticListsService,
    userConfigService,
  }: {
    staticListsService: StaticListsService;
    userConfigService: UserConfigService;
  }) {
    this.staticListsService = staticListsService;
    this.userConfigService = userConfigService;
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

    const userConfig = await this.userConfigService.get();

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
