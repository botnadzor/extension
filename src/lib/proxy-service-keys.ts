import type { ProxyServiceKey } from "@webext-core/proxy-service";

import type { CommentCollectingService } from "@/services/comment-collecting-service";

import type { AffiliationService } from "../services/affiliation-service";
import type { FrontendService } from "../services/frontend-service";
import type { InspectorService } from "../services/inspector-service";
import type { NotificationService } from "../services/notification-service";
import type { PopupService } from "../services/popup-service";
import type { RegDateService } from "../services/reg-date-service";
import type { StaticListsService } from "../services/static-lists-service";
import type { UserService } from "../services/user-service";

export const affiliationServiceKey: ProxyServiceKey<AffiliationService> =
  "affiliation-service";

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

export const userServiceKey: ProxyServiceKey<UserService> = "user-service";
