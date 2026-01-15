import type { ProxyServiceKey } from "@webext-core/proxy-service";

import type { AffiliationService } from "../entrypoints/background/@services/affiliation-service";
import type { AuthService } from "../entrypoints/background/@services/auth-service";
import type { CommentCollectingService } from "../entrypoints/background/@services/comment-collecting-service";
import type { FrontendService } from "../entrypoints/background/@services/frontend-service";
import type { InspectorService } from "../entrypoints/background/@services/inspector-service";
import type { NotificationService } from "../entrypoints/background/@services/notification-service";
import type { PopupService } from "../entrypoints/background/@services/popup-service";
import type { RegDateService } from "../entrypoints/background/@services/reg-date-service";
import type { StaticListsService } from "../entrypoints/background/@services/static-lists-service";
import type { UserConfigService } from "../entrypoints/background/@services/user-config-service";

export const affiliationServiceKey: ProxyServiceKey<AffiliationService> =
  "affiliation-service";

export const authServiceKey: ProxyServiceKey<AuthService> = "auth-service";

export const commentCollectingServiceKey: ProxyServiceKey<CommentCollectingService> =
  "comment-collecting-service";

export const frontendServiceKey: ProxyServiceKey<FrontendService> =
  "frontend-service";

export const inspectorServiceKey: ProxyServiceKey<InspectorService> =
  "inspector-service";

export const notificationServiceKey: ProxyServiceKey<NotificationService> =
  "notification-service";

export const popupServiceKey: ProxyServiceKey<PopupService> = "popup-service";

export const regDateServiceKey: ProxyServiceKey<RegDateService> =
  "reg-date-service";

export const staticListsServiceKey: ProxyServiceKey<StaticListsService> =
  "static-lists-service";

export const userConfigServiceKey: ProxyServiceKey<UserConfigService> =
  "user-config-service";
