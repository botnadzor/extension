import { defineJobScheduler } from "@webext-core/job-scheduler";
import { registerService } from "@webext-core/proxy-service";

import { rootConfigSchema } from "@/shared/@model/root-config";
import { staticListIds } from "@/shared/@model/static-lists";
import { configureLogging, getBackgroundLogger } from "@/shared/logging";
import {
  affiliationServiceKey,
  authServiceKey,
  commentCollectingServiceKey,
  frontendServiceKey,
  inspectorServiceKey,
  notificationServiceKey,
  popupServiceKey,
  regDateServiceKey,
  staticListsServiceKey,
  userConfigServiceKey,
} from "@/shared/proxy-service-keys";
import { browser, defineBackground } from "#imports";

import { AliasManager } from "./background/@service-helpers/alias-manager";
import { fetchFromRemoteSystem } from "./background/@service-helpers/fetch-from-remote-system";
import { VkDomainResolver } from "./background/@service-helpers/vk-domain-resolver";
import { AffiliationService } from "./background/@services/affiliation-service";
import { AuthService } from "./background/@services/auth-service";
import { CommentCollectingService } from "./background/@services/comment-collecting-service";
import { FrontendService } from "./background/@services/frontend-service";
import { InspectorService } from "./background/@services/inspector-service";
import { NotificationService } from "./background/@services/notification-service";
import { PopupService } from "./background/@services/popup-service";
import { RegDateService } from "./background/@services/reg-date-service";
import { StaticListsService } from "./background/@services/static-lists-service";
import { UserConfigService } from "./background/@services/user-config-service";

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

  // TODO: account for possible parse errors
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

  const authService = new AuthService({
    aliasManagerForDynamicApi,
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

  const userConfigService = new UserConfigService();

  const vkDomainResolver = new VkDomainResolver({
    staticListsService,
  });

  const affiliationService = new AffiliationService({
    staticListsService,
    userConfigService,
  });

  const commentCollectingService = new CommentCollectingService({
    authService,
    staticListsService,
    userConfigService,
  });

  const inspectorService = new InspectorService({
    authService,
    notificationService,
    vkDomainResolver,
  });

  const regDateService = new RegDateService({
    authService,
    vkDomainResolver,
  });

  registerService(affiliationServiceKey, affiliationService);
  registerService(authServiceKey, authService);
  registerService(commentCollectingServiceKey, commentCollectingService);
  registerService(frontendServiceKey, frontendService);
  registerService(inspectorServiceKey, inspectorService);
  registerService(notificationServiceKey, notificationService);
  registerService(popupServiceKey, popupService);
  registerService(regDateServiceKey, regDateService);
  registerService(staticListsServiceKey, staticListsService);
  registerService(userConfigServiceKey, userConfigService);

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
