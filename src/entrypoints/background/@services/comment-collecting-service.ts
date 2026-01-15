import { delay } from "es-toolkit";
import { LRUCache } from "lru-cache";

import { getBackgroundLogger } from "@/shared/logging";
import type { PollVersion } from "@/shared/pollable";
import type { VkDomain, VkId } from "@/shared/primitive-values";

import type { AuthService } from "./auth-service";
import type { StaticListsService } from "./static-lists-service";
import type { UserConfigService } from "./user-config-service";

const logger = getBackgroundLogger(["comment-collecting-service"]);

// Context: https://botnadzor.org/docs/extension#replies-collecting

// TODO:
// 1. After 5 seconds of idling, persist a batch of registered comments in IndexedDB (dedupe before inserting)
// 2. Implement a method that takes a batch of persisted comments (in IndexedDB) and sends them to the server using dynamic API
//    - check if we still have valid auth
// 3. Call this method using web extension alarms

type CommentToCollect = {
  /** @example wall-123_456?reply=789 -> wallVkId = -123 */
  wallVkId: VkId;
  /** @example wall-123_456?reply=789 -> postVkId = 456 */
  postVkId: VkId;
  /** @example wall-123_456?reply=789 -> commentVkId = 789 */
  commentVkId: VkId;

  /**
   * @example vk.com/id123 -> commenterVkDomain = "id123"
   * @example vk.com/someone -> commenterVkDomain = "someone"
   */
  commenterVkDomain: VkDomain;

  /** number of comments on the post, if present in markup */
  postCommentCount: number | undefined;
};

// TODO: Uncomment after adding dexie to this file
// type PersistedComment = CommentToCollect & {
//   persistedAt: IsoTime;
//   lastSeenAt: IsoTime;
//   lastSubmittedAt?: IsoTime;
//   postCommentCountChangedAt: IsoTime;
// };

export class CommentCollectingService {
  private authService: AuthService;
  private staticListsService: StaticListsService;
  private userConfigService: UserConfigService;

  private cachedOptedIn: boolean | undefined;
  private disposed = false;
  private wallSkippedCache: LRUCache<VkId, boolean>;

  private registeredComments: CommentToCollect[] = [];

  private persistingDebounceTimeout: ReturnType<typeof setTimeout> | undefined;
  private persisting = false;
  private flushing = false;

  constructor({
    authService,
    staticListsService,
    userConfigService,
  }: {
    authService: AuthService;
    staticListsService: StaticListsService;
    userConfigService: UserConfigService;
  }) {
    this.authService = authService;
    this.staticListsService = staticListsService;
    this.userConfigService = userConfigService;

    const wallSkippedCache = new LRUCache<VkId, boolean>({ max: 1000 });
    this.wallSkippedCache = wallSkippedCache;

    void (async () => {
      let lastPollVersion: PollVersion | undefined;
      while (!this.disposed) {
        const result = await userConfigService.poll(lastPollVersion);
        const { collectingComments } = result.value;
        if (!collectingComments && this.cachedOptedIn) {
          void this.clearAllUnsentData();
        }
        this.cachedOptedIn = undefined;
        lastPollVersion = result.version;
      }
    })();

    void (async () => {
      let lastPollVersion: PollVersion | undefined;
      while (!this.disposed) {
        const result = await authService.pollAuthStatus(lastPollVersion);
        this.cachedOptedIn = undefined;
        lastPollVersion = result.version;
      }
    })();

    void (async () => {
      let lastPollVersion: PollVersion | undefined;
      while (!this.disposed) {
        const result = await staticListsService.pollListMetadata(
          lastPollVersion,
          "walls",
        );
        wallSkippedCache.clear();
        lastPollVersion = result.version;
      }
    })();
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async determineIfUserOptedIn(): Promise<boolean> {
    const authStatus = this.authService.getAuthStatus();
    if (authStatus.state !== "valid") {
      return false;
    }
    const userConfig = await this.userConfigService.get();
    return userConfig.collectingComments ?? false;
  }

  private async checkIfUserOptedIn(): Promise<boolean> {
    this.cachedOptedIn ??= await this.determineIfUserOptedIn();
    return this.cachedOptedIn;
  }

  private async determineIfWallSkipped(wallVkId: VkId): Promise<boolean> {
    const wall = await this.staticListsService.findItem(
      "walls",
      "vkId",
      wallVkId,
    );
    return wall?.skip ?? false;
  }

  private async checkIfWallSkipped(wallVkId: VkId): Promise<boolean> {
    const cachedValue = this.wallSkippedCache.get(wallVkId);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    const valueToCache = await this.determineIfWallSkipped(wallVkId);
    this.wallSkippedCache.set(wallVkId, valueToCache);
    return valueToCache;
  }

  /**
   * This method is a no-op if the user has not opted in or if the wall is skipped.
   *
   * Registers a comment that has been found on a page. The data is persisted
   * to IndexedDB after a short interval and is then periodically flushed to the server.
   */
  async registerIfNeeded(commentToCollect: CommentToCollect): Promise<void> {
    const [userOptedIn, wallSkipped] = await Promise.all([
      this.checkIfUserOptedIn(),
      this.checkIfWallSkipped(commentToCollect.wallVkId),
    ]);

    if (!userOptedIn) {
      logger.debug(
        "Comment not registered: user not opted in",
        commentToCollect,
      );
    }

    if (wallSkipped) {
      logger.debug("Comment not registered: wall skipped", commentToCollect);
    }

    this.registeredComments.push(commentToCollect);
    logger.debug("Comment registered", commentToCollect);
    this.persistRegisteredCommentsWithDebounce();
  }

  private persistRegisteredCommentsWithDebounce(): void {
    if (this.persistingDebounceTimeout) {
      clearTimeout(this.persistingDebounceTimeout);
    }
    this.persistingDebounceTimeout = setTimeout(
      () => void this.persistRegisteredComments(),
      5000,
    );
  }

  async persistRegisteredComments(): Promise<void> {
    if (this.persisting) {
      do {
        await delay(100);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive
      } while (this.persisting);
      return;
    }
    this.persisting = true;

    // TODO: Persist registered comments in IndexedDB
    // - upsert existing entries with lastSeenAt = now()
    await delay(1000);

    this.registeredComments = [];
    this.persisting = false;
  }

  async flushPersistedCommentsIfNeeded(): Promise<void> {
    if (this.flushing) {
      do {
        await delay(100);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive
      } while (this.flushing);
      return;
    }

    this.flushing = true;

    // TODO: List a batch of persisted comments from IndexedDB
    // Send them over to the server using dynamic API
    // If request is successful, mark them as submitted
    // If request is successful, try submitting another batch
    await delay(1000);

    this.flushing = false;
  }

  private async clearAllUnsentData(): Promise<void> {
    this.registeredComments = [];
    while (this.persisting) {
      await delay(100);
    }
    while (this.flushing) {
      await delay(100);
    }

    // TODO: Clear IndexedDB cache
    await delay(1000);
    this.registeredComments = [];

    logger.info("Cleared all unsent data");
  }
}
