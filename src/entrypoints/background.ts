import { registerService } from "@webext-core/proxy-service";
import { isEqual } from "es-toolkit";

import { rootConfigSeed } from "@/shared/@model/root-config";
import type { PollVersion } from "@/shared/@pollable/core";
import { configureLogging, getBackgroundLogger } from "@/shared/logging";
import {
  affiliationServiceKey,
  authServiceKey,
  collectingServiceKey,
  frontendServiceKey,
  inspectorServiceKey,
  notificationServiceKey,
  popupServiceKey,
  regDateServiceKey,
  rootConfigServiceKey,
  staticListsServiceKey,
  userConfigServiceKey,
} from "@/shared/proxy-service-keys";
import { browser, defineBackground } from "#imports";

import { AliasManager } from "./background/@service-helpers/alias-manager";
import { VkDomainResolver } from "./background/@service-helpers/vk-domain-resolver";
import { AffiliationService } from "./background/@services/affiliation-service";
import { AuthService } from "./background/@services/auth-service";
import { CollectingService } from "./background/@services/collecting-service";
import { FrontendService } from "./background/@services/frontend-service";
import { InspectorService } from "./background/@services/inspector-service";
import { NotificationService } from "./background/@services/notification-service";
import { PopupService } from "./background/@services/popup-service";
import { RegDateService } from "./background/@services/reg-date-service";
import { RootConfigService } from "./background/@services/root-config-service";
import { StaticListsService } from "./background/@services/static-lists-service";
import { UserConfigService } from "./background/@services/user-config-service";

const logger = getBackgroundLogger();

async function orchestrateAliasManagers({
  aliasManagerForDynamicApi,
  aliasManagerForFrontend,
  aliasManagerForStaticApi,
  rootConfigService,
}: {
  aliasManagerForDynamicApi: AliasManager;
  aliasManagerForFrontend: AliasManager;
  aliasManagerForStaticApi: AliasManager;
  rootConfigService: RootConfigService;
}) {
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

  let pollVersion: PollVersion | undefined;
  for (;;) {
    const result = await rootConfigService.poll(pollVersion);
    pollVersion = result.version;
    const rootConfig = result.value;

    aliasManagerForDynamicApi.configure(
      rootConfig.remoteSystemLookup.dynamicApi.aliasLookup,
    );
    aliasManagerForFrontend.configure(
      rootConfig.remoteSystemLookup.frontend.aliasLookup,
    );
    aliasManagerForStaticApi.configure(
      rootConfig.remoteSystemLookup.staticApi.aliasLookup,
    );

    logger.debug(
      "Alias managers were reconfigured because root config changed",
    );
  }
}

async function populateInitialStaticListsIfNeeded({
  rootConfigService,
  staticListsService,
}: {
  rootConfigService: RootConfigService;
  staticListsService: StaticListsService;
}) {
  let pollVersion: PollVersion | undefined;
  for (;;) {
    const result = await rootConfigService.poll(pollVersion);
    pollVersion = result.version;
    const rootConfig = result.value;

    if (isEqual(rootConfig, rootConfigSeed)) {
      logger.debug(
        "Root config is the same as the seed, skipping static lists population",
      );
      continue;
    }

    staticListsService.updateIfNeeded();
  }
}

export default defineBackground(() => {
  configureLogging();

  logger.debug("Starting background entrypoint {runtimeId}", {
    runtimeId: browser.runtime.id,
  });

  const aliasManagerForDynamicApi = new AliasManager(
    "dynamicApi",
    rootConfigSeed.remoteSystemLookup.dynamicApi.aliasLookup,
  );

  const aliasManagerForFrontend = new AliasManager(
    "frontend",
    rootConfigSeed.remoteSystemLookup.frontend.aliasLookup,
  );

  const aliasManagerForStaticApi = new AliasManager(
    "staticApi",
    rootConfigSeed.remoteSystemLookup.staticApi.aliasLookup,
  );

  const authService = new AuthService({
    aliasManagerForDynamicApi,
  });

  const frontendService = new FrontendService({
    aliasManagerForFrontend,
  });

  const notificationService = new NotificationService();

  const popupService = new PopupService();

  const rootConfigService = new RootConfigService({
    aliasManagerForStaticApi,
  });

  const staticListsService = new StaticListsService({
    aliasManagerForStaticApi,
    rootConfigService,
  });

  const userConfigService = new UserConfigService();

  const vkDomainResolver = new VkDomainResolver({
    staticListsService,
  });

  const affiliationService = new AffiliationService({
    staticListsService,
    userConfigService,
  });

  const collectingService = new CollectingService({
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
  registerService(collectingServiceKey, collectingService);
  registerService(frontendServiceKey, frontendService);
  registerService(inspectorServiceKey, inspectorService);
  registerService(notificationServiceKey, notificationService);
  registerService(popupServiceKey, popupService);
  registerService(regDateServiceKey, regDateService);
  registerService(rootConfigServiceKey, rootConfigService);
  registerService(staticListsServiceKey, staticListsService);
  registerService(userConfigServiceKey, userConfigService);

  void orchestrateAliasManagers({
    aliasManagerForDynamicApi,
    aliasManagerForFrontend,
    aliasManagerForStaticApi,
    rootConfigService,
  });

  void populateInitialStaticListsIfNeeded({
    rootConfigService,
    staticListsService,
  });

  browser.runtime.onSuspend.addListener(() => {
    void collectingService.persistRegisteredCommentsIfNeeded();
  });
});
