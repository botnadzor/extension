import { createProxyService } from "@webext-core/proxy-service";

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

export const affiliationService = createProxyService(affiliationServiceKey);
export const commentCollectingService = createProxyService(
  commentCollectingServiceKey,
);
export const frontendService = createProxyService(frontendServiceKey);
export const inspectorService = createProxyService(inspectorServiceKey);
export const notificationService = createProxyService(notificationServiceKey);
export const popupService = createProxyService(popupServiceKey);
export const regDateService = createProxyService(regDateServiceKey);
export const staticListsService = createProxyService(staticListsServiceKey);
export const userService = createProxyService(userServiceKey);
