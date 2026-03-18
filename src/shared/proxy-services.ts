import { createProxyService } from "@webext-core/proxy-service";

import {
  affiliationServiceKey,
  authServiceKey,
  collectingServiceKey,
  dxConfigServiceKey,
  extensionVersionServiceKey,
  frontendServiceKey,
  inspectorServiceKey,
  loggingServiceKey,
  notificationServiceKey,
  popupServiceKey,
  regDateServiceKey,
  staticListsServiceKey,
  userConfigServiceKey,
} from "./proxy-service-keys";

export const affiliationService = createProxyService(affiliationServiceKey);
export const authService = createProxyService(authServiceKey);
export const collectingService = createProxyService(collectingServiceKey);
export const dxConfigService = createProxyService(dxConfigServiceKey);
export const extensionVersionService = createProxyService(
  extensionVersionServiceKey,
);
export const frontendService = createProxyService(frontendServiceKey);
export const inspectorService = createProxyService(inspectorServiceKey);
export const loggingService = createProxyService(loggingServiceKey);
export const notificationService = createProxyService(notificationServiceKey);
export const popupService = createProxyService(popupServiceKey);
export const regDateService = createProxyService(regDateServiceKey);
export const staticListsService = createProxyService(staticListsServiceKey);
export const userConfigService = createProxyService(userConfigServiceKey);
