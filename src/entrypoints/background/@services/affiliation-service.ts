import { getBackgroundLogger } from "@/shared/@logging/core";
import {
  type AccountAffiliation,
  fallbackHexColor,
} from "@/shared/@model/account-affiliation";
import type { TagListItem } from "@/shared/@model/static-lists";
import {
  type InterpretedVkDomain,
  interpretVkDomain,
  type VkDomain,
} from "@/shared/@primitives/vk";

import type { StaticListsService } from "./static-lists-service";
import type { UserConfigService } from "./user-config-service";

const logger = getBackgroundLogger(["affiliation-service"]);

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
    vkDomain: VkDomain | InterpretedVkDomain,
  ): Promise<AccountAffiliation | undefined> {
    const interpretedVkDomain =
      typeof vkDomain === "string" ? interpretVkDomain(vkDomain) : vkDomain;

    if (
      interpretedVkDomain.kind === "invalid" ||
      (interpretedVkDomain.kind === "vkId" &&
        interpretedVkDomain.prefix !== "id")
    ) {
      return;
    }

    const account =
      interpretedVkDomain.kind === "vkId"
        ? await this.staticListsService.findItem(
            "accounts",
            "vkId",
            interpretedVkDomain.value,
          )
        : await this.staticListsService.findItem(
            "accounts",
            "vkNickname",
            interpretedVkDomain.value,
          );

    if (!account) {
      return undefined;
    }

    const tags: TagListItem[] | undefined = [];

    for (const tagId of account.tagIds) {
      const tag = await this.staticListsService.findItem("tags", "id", tagId);

      if (tag) {
        tags.push(tag);
      }
    }

    const [firstTag, ...otherTags] = tags;
    if (!firstTag) {
      logger.error("No tags found for account {interpretedVkDomain}", {
        interpretedVkDomain,
      });
      return undefined;
    }

    const userConfig = await this.userConfigService.get();

    const color =
      userConfig.tagOverrideLookup[firstTag.id]?.colorForHighlight ??
      tags.find((tag) => tag.color)?.color ??
      fallbackHexColor;

    const colorForHighlight =
      userConfig.tagOverrideLookup[firstTag.id]?.colorForHighlight ??
      tags.find((tag) => tag.colorForHighlight)?.colorForHighlight ??
      fallbackHexColor;

    const hidden = userConfig.tagOverrideLookup[firstTag.id]?.hidden;

    const botnadzorPage = tags.some((tag) => tag.botnadzorPage);
    const botnadzorCard = tags.some((tag) => tag.botnadzorCard);

    return {
      color,
      colorForHighlight,
      tags: [firstTag, ...otherTags],
      ...(hidden && { hidden: true }),
      ...(botnadzorPage && { botnadzorPage: true }),
      ...(botnadzorCard && { botnadzorCard: true }),
    };
  }
}
