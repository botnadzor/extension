import { defineJobScheduler } from "@webext-core/job-scheduler";
import { registerService } from "@webext-core/proxy-service";

import { configureLogging, getBackgroundLogger } from "@/lib/logging";
import {
  affiliationServiceKey,
  commentCollectingServiceKey,
  frontendServiceKey,
  inspectorServiceKey,
  notificationServiceKey,
  popupServiceKey,
  regDateServiceKey,
  staticListsServiceKey,
  userServiceKey,
} from "@/lib/proxy-service-keys";
import { rootConfigSchema } from "@/lib/root-config";
import { staticListIds } from "@/lib/static-lists";
import { AffiliationService } from "@/services/affiliation-service";
import { CommentCollectingService } from "@/services/comment-collecting-service";
import { FrontendService } from "@/services/frontend-service";
import { InspectorService } from "@/services/inspector-service";
import { NotificationService } from "@/services/notification-service";
import { PopupService } from "@/services/popup-service";
import { RegDateService } from "@/services/reg-date-service";
import { StaticListsService } from "@/services/static-lists-service";
import { UserService } from "@/services/user-service";
import { browser, defineBackground } from "#imports";

import { AliasManager } from "./background/alias-manager";
import { fetchFromRemoteSystem } from "./background/fetch-from-remote-system";
import { VkDomainResolver } from "./background/vk-domain-resolver";

const logger = getBackgroundLogger();

async function populateStaticLists({
  aliasManagerForDynamicApi,
  aliasManagerForFrontend,
  aliasManagerForStaticApi,
  staticListsService,
}: {
  aliasManagerForDynamicApi: AliasManager;
  aliasManagerForFrontend: AliasManager;
  aliasManagerForStaticApi: AliasManager;
  staticListsService: StaticListsService;
}) {
  const fetchResult = await fetchFromRemoteSystem({
    aliasManager: aliasManagerForStaticApi,
    urlSuffix: "/root-config.json",
  });

  if (!fetchResult.success) {
    logger.error("Failed to fetch root config: {error}", {
      error: fetchResult.reason,
    });
    return;
  }

  const rootConfig = rootConfigSchema.parse(await fetchResult.response.json());

  aliasManagerForDynamicApi.configure(
    rootConfig.remoteSystemLookup.dynamicApi.aliasLookup,
  );
  aliasManagerForFrontend.configure(
    rootConfig.remoteSystemLookup.frontend.aliasLookup,
  );
  aliasManagerForStaticApi.configure(
    rootConfig.remoteSystemLookup.staticApi.aliasLookup,
  );

  logger.debug("Populating static lists with root config {rootConfig}", {
    rootConfig,
  });

  const results = await Promise.allSettled(
    staticListIds.map((listId) =>
      staticListsService.populateFromUrlIfOutdated(
        listId,
        rootConfig.remoteSystemLookup.staticApi.listLookup[listId],
      ),
    ),
  );

  logger.debug("Static lists were populated { results }", { results });
}

export default defineBackground(() => {
  configureLogging();

  logger.debug("Starting background entrypoint {runtimeId}", {
    runtimeId: browser.runtime.id,
  });

  const jobScheduler = defineJobScheduler();

  const aliasManagerForDynamicApi = new AliasManager("dynamicApi", {
    "https://botnadzor.org/script": { role: "primary" },
    "https://botnadzor-epe1uraet-botnadzors-projects.vercel.app/script": {},
    // TODO: replace above urls with these ones:
    // "https://botnadzor.org/api/extension/dynamic": { "role": ""},
    // "https://botnadzor-epe1uraet-botnadzors-projects.vercel.app/api/extension/dynamic": {},
  });

  const aliasManagerForFrontend = new AliasManager("frontend", {
    "https://botnadzor.org": { role: "primary" },
    "https://botnadzor-epe1uraet-botnadzors-projects.vercel.app": {},
  });

  const aliasManagerForStaticApi = new AliasManager("staticApi", {
    "https://api.botnadzor.org/extension/static": { role: "primary" },
    "https://botnadzor.github.io/extension-data": {},
    "https://raw.githubusercontent.com/botnadzor/extension-data/main": {},
  });

  const frontendService = new FrontendService({
    aliasManagerForFrontend,
  });

  const notificationService = new NotificationService();

  const popupService = new PopupService();

  const staticListsService = new StaticListsService({
    aliasManagerForStaticApi,
    jobScheduler,
  });

  const userService = new UserService({
    aliasManagerForDynamicApi,
  });

  const vkDomainResolver = new VkDomainResolver({
    staticListsService,
  });

  const affiliationService = new AffiliationService({
    staticListsService,
    userService,
  });

  const commentCollectingService = new CommentCollectingService({
    staticListsService,
    userService,
  });

  const inspectorService = new InspectorService({
    notificationService,
    userService,
    vkDomainResolver,
  });

  const regDateService = new RegDateService({
    userService,
    vkDomainResolver,
  });

  registerService(affiliationServiceKey, affiliationService);
  registerService(commentCollectingServiceKey, commentCollectingService);
  registerService(frontendServiceKey, frontendService);
  registerService(inspectorServiceKey, inspectorService);
  registerService(notificationServiceKey, notificationService);
  registerService(popupServiceKey, popupService);
  registerService(regDateServiceKey, regDateService);
  registerService(staticListsServiceKey, staticListsService);
  registerService(userServiceKey, userService);

  void populateStaticLists({
    aliasManagerForDynamicApi,
    aliasManagerForFrontend,
    aliasManagerForStaticApi,
    staticListsService,
  });

  browser.runtime.onSuspend.addListener(() => {
    void commentCollectingService.persistRegisteredComments();
  });

  void populateStaticLists({
    aliasManagerForDynamicApi,
    aliasManagerForFrontend,
    aliasManagerForStaticApi,
    staticListsService,
  });

  self.addEventListener("offline", () => {
    aliasManagerForDynamicApi.resetStatuses();
    aliasManagerForFrontend.resetStatuses();
    aliasManagerForStaticApi.resetStatuses();
  });

  self.addEventListener("online", () => {
    aliasManagerForDynamicApi.resetStatuses();
    aliasManagerForFrontend.resetStatuses();
    aliasManagerForStaticApi.resetStatuses();
  });
});
