import { Dexie } from "dexie";
import { delay, uniqBy } from "es-toolkit";
import { LRUCache } from "lru-cache";
import { z } from "zod/mini";

import type { PollVersion } from "@/shared/@pollable/core";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import {
  parseVkDomain,
  type PositiveVkId,
  positiveVkIdSchema,
  type VkDomain,
  type VkId,
  vkIdSchema,
  type VkNickname,
  vkNicknameSchema,
} from "@/shared/@primitives/vk";
import { getBackgroundLogger } from "@/shared/logging";

import type { AuthService } from "./auth-service";
import type { StaticListsService } from "./static-lists-service";
import type { UserConfigService } from "./user-config-service";

const logger = getBackgroundLogger(["collecting-service"]);

// Context: https://botnadzor.org/docs/extension#replies-collecting

/** Maximum number of wallVkIds to keep in service cache */
const wallSkippedCacheMaxSize = 1000;

/** Interval between persist operations */
const persistingThrottleInterval = 5000;
/** Maximum number of comments to keep in IndexedDB before pruning the oldest ones */
const persistedCommentMaxCount = 10_000;

/** Interval between upload operations */
const uploadingThrottleInterval = 5 * 60 * 1000;
const uploadedCommentsMinCount = 5;
const uploadedCommentsMaxCount = 1000;

/** Idle time between user opting out and service reset (users may opt out and then quickly opt back in) */
const resetDebounceTimeout = 10_000;

const commentsTableName = "comments";
const postsTableName = "posts";

type CommentToCollect = {
  /** @example wall-123_456?reply=789 -> wallVkId = -123 */
  wallVkId: VkId;
  /** @example wall-123_456?reply=789 -> postVkId = 456 */
  postVkId: PositiveVkId;
  /** @example wall-123_456?reply=789 -> commentVkId = 789 */
  commentVkId: PositiveVkId;

  /**
   * @example vk.com/id123 -> commenterVkDomain = "id123"
   * @example vk.com/someone -> commenterVkDomain = "someone"
   */
  commenterVkDomain: VkDomain;

  /** number of comments on the post, if present in markup */
  postCommentCount: number | undefined;
};

const notUploaded = "-";
const uploadedAtSchema = z.union([z.literal(notUploaded), isoDateTimeSchema]);

const persistedCommentSchema = z.object({
  wallVkId: vkIdSchema,
  postVkId: positiveVkIdSchema,
  commentVkId: positiveVkIdSchema,
  commenterVkIdOrNickname: z.union([positiveVkIdSchema, vkNicknameSchema]),
  persistedAt: isoDateTimeSchema,
  uploadedAt: uploadedAtSchema,
});
type PersistedComment = z.infer<typeof persistedCommentSchema>;

const persistedPostSchema = z.object({
  wallVkId: vkIdSchema,
  postVkId: positiveVkIdSchema,
  postCommentCount: z.number(),
  persistedAt: isoDateTimeSchema,
});
type PersistedPost = z.infer<typeof persistedPostSchema>;

export class CollectingService {
  private readonly authService: AuthService;
  private readonly db: Dexie;
  private readonly staticListsService: StaticListsService;
  private readonly userConfigService: UserConfigService;

  private cachedUserOptedIn: boolean | "maybe" | undefined;
  private disposed = false;
  private wallSkippedCache: LRUCache<VkId, boolean>;

  private notYetPersistedComments: CommentToCollect[] = [];

  private persistingThrottleTimeout: ReturnType<typeof setTimeout> | undefined;
  private uploadingThrottleTimeout: ReturnType<typeof setTimeout> | undefined;
  private resettingDebounceTimeout: ReturnType<typeof setTimeout> | undefined;

  private state: "idle" | "persisting" | "uploading" | "pruning" | "resetting" =
    "idle";

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

    this.db = new Dexie("collecting");
    this.db.version(1).stores({
      [commentsTableName]:
        "[wallVkId+postVkId+commentVkId], persistedAt, uploadedAt",
      [postsTableName]: "[wallVkId+postVkId]",
    });

    const wallSkippedCache = new LRUCache<VkId, boolean>({
      max: wallSkippedCacheMaxSize,
    });
    this.wallSkippedCache = wallSkippedCache;

    void (async () => {
      let lastPollVersion: PollVersion | undefined;
      while (!this.disposed) {
        const result = await userConfigService.poll(lastPollVersion);
        const { collectingComments } = result.value;
        if (lastPollVersion === result.version) {
          continue;
        }

        if (!collectingComments && this.cachedUserOptedIn !== false) {
          this.resetWithDebounce();
        }
        this.cachedUserOptedIn = undefined;
        lastPollVersion = result.version;
      }
    })();

    void (async () => {
      let lastPollVersion: PollVersion | undefined;
      while (!this.disposed) {
        const result = await authService.pollAuthStatus(lastPollVersion);
        this.cachedUserOptedIn = undefined;
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

    void this.uploadPersistedCommentsIfNeeded();
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async waitForIdle(): Promise<void> {
    while (this.state !== "idle") {
      await delay(100);
    }
  }

  private getCommentsTable() {
    return this.db.table<unknown>(commentsTableName);
  }

  private getPostsTable() {
    return this.db.table<unknown>(postsTableName);
  }

  private parsePersistedComment(
    rawItem: unknown,
  ): PersistedComment | undefined {
    if (rawItem === undefined) {
      return undefined;
    }

    const result = persistedCommentSchema.safeParse(rawItem);

    if (!result.success) {
      logger.warn("Invalid persisted comment: {error}", {
        error: result.error.message,
      });
      return undefined;
    }

    return result.data;
  }

  private parsePersistedPost(rawItem: unknown): PersistedPost | undefined {
    if (rawItem === undefined) {
      return undefined;
    }

    const result = persistedPostSchema.safeParse(rawItem);

    if (!result.success) {
      logger.warn("Invalid persisted post: {error}", {
        error: result.error.message,
      });
      return undefined;
    }

    return result.data;
  }

  private async doCheckIfUserOptedIn(): Promise<boolean | "maybe"> {
    const authStatus = this.authService.getAuthStatus();

    if (authStatus.state === "empty") {
      return false;
    }

    const userConfig = await this.userConfigService.get();
    if (!userConfig.collectingComments) {
      return false;
    }

    if (
      authStatus.state === "unknown" ||
      (authStatus.state === "invalid" && authStatus.accessCodeRecognized)
    ) {
      return "maybe";
    }

    if (authStatus.state === "valid") {
      return true;
    }

    return false;
  }

  private async checkIfUserOptedIn(): Promise<boolean | "maybe"> {
    this.cachedUserOptedIn ??= await this.doCheckIfUserOptedIn();
    return this.cachedUserOptedIn;
  }

  private async doCheckIfWallSkipped(wallVkId: VkId): Promise<boolean> {
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

    const valueToCache = await this.doCheckIfWallSkipped(wallVkId);
    this.wallSkippedCache.set(wallVkId, valueToCache);

    return valueToCache;
  }

  /**
   * This method is a no-op if the user has not opted in or if the wall is skipped.
   *
   * Collects a comment that has been found on a page. The data is persisted
   * to IndexedDB after a short interval and is then periodically uploaded to the server.
   */
  async collectCommentIfNeeded(
    commentToCollect: CommentToCollect,
  ): Promise<void> {
    const [userOptedIn, wallSkipped] = await Promise.all([
      this.checkIfUserOptedIn(),
      this.checkIfWallSkipped(commentToCollect.wallVkId),
    ]);

    const commentSlug = `wall${commentToCollect.wallVkId}_${commentToCollect.postVkId}?reply=${commentToCollect.commentVkId}`;

    if (!userOptedIn) {
      logger.debug(
        "Comment {commentSlug} was ignored on collection: user not opted in",
        { commentSlug },
      );
      return;
    }

    if (wallSkipped) {
      logger.debug(
        "Comment {commentSlug} was ignored on collection: wall skipped",
        { commentSlug },
      );
      return;
    }

    this.notYetPersistedComments.push(commentToCollect);
    logger.debug("Comment {commentSlug} was collected", {
      commentSlug,
    });

    this.scheduleNextPersist();
  }

  private scheduleNextPersist(): void {
    if (this.persistingThrottleTimeout) {
      return; // Already scheduled
    }
    this.persistingThrottleTimeout = setTimeout(() => {
      this.persistingThrottleTimeout = undefined;
      void this.persistRegisteredCommentsIfNeeded();
    }, persistingThrottleInterval);
  }

  async persistRegisteredCommentsIfNeeded(): Promise<void> {
    await this.waitForIdle();

    if (this.notYetPersistedComments.length === 0) {
      return;
    }

    this.state = "persisting";

    const persistedAt = isoDateTimeSchema.parse(undefined);
    const commentsTable = this.getCommentsTable();
    const postsTable = this.getPostsTable();

    const commentsToPersist = this.notYetPersistedComments;
    this.notYetPersistedComments = [];

    const deduplicatedCommentsToPersist = uniqBy(
      commentsToPersist,
      (c) => `${c.wallVkId}:${c.postVkId}:${c.commentVkId}`,
    );

    const postKeyToPostCommentCount = new Map<string, number>();

    for (const commentToPersist of deduplicatedCommentsToPersist) {
      const { postCommentCount } = commentToPersist;
      if (!postCommentCount) {
        continue;
      }

      const postKey = `${commentToPersist.wallVkId}:${commentToPersist.postVkId}`;
      if (postCommentCount > (postKeyToPostCommentCount.get(postKey) ?? 0)) {
        postKeyToPostCommentCount.set(postKey, postCommentCount);
      }
    }

    const commentItemsToPersist: PersistedComment[] = [];

    for (const commentToPersist of deduplicatedCommentsToPersist) {
      const commentItemKey = [
        commentToPersist.wallVkId,
        commentToPersist.postVkId,
        commentToPersist.commentVkId,
      ] as const;

      const alreadyPersistedComment = this.parsePersistedComment(
        await commentsTable.get(commentItemKey),
      );

      const parsedVkDomain = parseVkDomain(commentToPersist.commenterVkDomain);
      if (
        parsedVkDomain.kind === "vkNickname" ||
        (parsedVkDomain.kind === "vkId" && parsedVkDomain.prefix === "id")
      ) {
        commentItemsToPersist.push({
          wallVkId: commentToPersist.wallVkId,
          postVkId: commentToPersist.postVkId,
          commentVkId: commentToPersist.commentVkId,
          commenterVkIdOrNickname: parsedVkDomain.value,
          persistedAt,
          uploadedAt: alreadyPersistedComment?.uploadedAt ?? notUploaded,
        });
      }
    }
    await commentsTable.bulkPut(commentItemsToPersist);

    const postItemsToPersist: PersistedPost[] = [];
    for (const [
      postKey,
      postCommentCount,
    ] of postKeyToPostCommentCount.entries()) {
      const [wallVkIdStr, postVkIdStr] = postKey.split(":");
      const wallVkId = vkIdSchema.parse(Number(wallVkIdStr));
      const postVkId = positiveVkIdSchema.parse(Number(postVkIdStr));

      postItemsToPersist.push({
        wallVkId,
        postVkId,
        postCommentCount,
        persistedAt,
      });
    }
    await postsTable.bulkPut(postItemsToPersist);

    logger.debug(
      "Persisted {count} comment(s) & {postCount} post comment count(s)",
      {
        count: deduplicatedCommentsToPersist.length,
        postCount: postKeyToPostCommentCount.size,
      },
    );

    this.state = "idle";

    this.scheduleNextUpload();
  }

  private scheduleNextUpload(): void {
    if (this.uploadingThrottleTimeout) {
      return; // Already scheduled
    }
    this.uploadingThrottleTimeout = setTimeout(() => {
      this.uploadingThrottleTimeout = undefined;
      void this.uploadPersistedCommentsIfNeeded();
    }, uploadingThrottleInterval);
  }

  async uploadPersistedCommentsIfNeeded(): Promise<void> {
    await this.waitForIdle();

    this.state = "uploading";

    const commentsTable = this.getCommentsTable();
    const postsTable = this.getPostsTable();

    for (;;) {
      // Get comments without uploadedAt, ordered by persistedAt (oldest first)
      // We query by persistedAt index and filter out those already uploaded

      const rawNotUploadedComments = await commentsTable
        .where("uploadedAt")
        .equals(notUploaded)
        .toArray();

      const commentsToUpload = rawNotUploadedComments
        .map((rawItem) => this.parsePersistedComment(rawItem))
        .filter((item): item is PersistedComment => item !== undefined)
        .toSorted((itemA, itemB) =>
          itemA.persistedAt.localeCompare(itemB.persistedAt),
        )
        .slice(0, uploadedCommentsMaxCount);

      if (commentsToUpload.length < uploadedCommentsMinCount) {
        logger.debug(
          "Not enough comments to upload ({count} < {min}), skipping",
          { count: commentsToUpload.length, min: uploadedCommentsMinCount },
        );
        break;
      }

      // Group comments by post

      const postMap = new Map<
        string,
        {
          wallVkId: VkId;
          postVkId: PositiveVkId;
          comments: Array<{
            commentVkId: PositiveVkId;
            commenterVkIdOrNickname: PositiveVkId | VkNickname;
          }>;
        }
      >();

      for (const comment of commentsToUpload) {
        const postKey = `${comment.wallVkId}:${comment.postVkId}`;
        let post = postMap.get(postKey);
        if (!post) {
          post = {
            wallVkId: comment.wallVkId,
            postVkId: comment.postVkId,
            comments: [],
          };
          postMap.set(postKey, post);
        }
        post.comments.push({
          commentVkId: comment.commentVkId,
          commenterVkIdOrNickname: comment.commenterVkIdOrNickname,
        });
      }

      // Build payload with post comment counts

      const groupedComments: Array<{
        wallVkId: VkId;
        postVkId: PositiveVkId;
        commentCount?: number;
        comments: Array<{
          commentVkId: PositiveVkId;
          commenterVkIdOrNickname: PositiveVkId | VkNickname;
        }>;
      }> = [];

      for (const post of postMap.values()) {
        const persistedPost = this.parsePersistedPost(
          await postsTable.get([post.wallVkId, post.postVkId]),
        );

        groupedComments.push({
          wallVkId: post.wallVkId,
          postVkId: post.postVkId,
          ...(persistedPost?.postCommentCount
            ? { commentCount: persistedPost.postCommentCount }
            : {}),
          comments: post.comments,
        });
      }

      // Upload comments

      const outcome = await this.authService.fetchFromDynamicApiWithAccessCode(
        "collect",
        { groupedComments },
      );

      if (outcome.problem) {
        logger.warn("Failed to upload comments: {errorCode} {errorMessage}", {
          errorCode: outcome.type,
          errorMessage: outcome.description,
        });
        break;
      }

      // Mark comments as uploaded

      const uploadedAt = isoDateTimeSchema.parse(undefined);
      const bulkUpdateKeysAndChanges: Array<{
        key: [VkId, PositiveVkId, PositiveVkId];
        changes: { uploadedAt: string };
      }> = [];
      for (const comment of commentsToUpload) {
        bulkUpdateKeysAndChanges.push({
          key: [comment.wallVkId, comment.postVkId, comment.commentVkId],
          changes: { uploadedAt },
        });
      }
      await commentsTable.bulkUpdate(bulkUpdateKeysAndChanges);

      logger.info("Uploaded {count} comments", {
        count: commentsToUpload.length,
      });
    }

    this.state = "idle";

    void this.prunePersistedDataIfNeeded();
  }

  private async prunePersistedDataIfNeeded(): Promise<void> {
    await this.waitForIdle();

    this.state = "pruning";

    const commentsTable = this.getCommentsTable();
    const postsTable = this.getPostsTable();

    const persistedCommentCount = await commentsTable.count();

    if (persistedCommentCount <= persistedCommentMaxCount) {
      logger.debug("No pruning needed ({count} <= {max})", {
        count: persistedCommentCount,
        max: persistedCommentMaxCount,
      });
      this.state = "idle";
      return;
    }

    const countToDelete = persistedCommentCount - persistedCommentMaxCount;

    // Delete comments, mark affected posts

    const rawCommentsToDelete = await commentsTable
      .orderBy("persistedAt")
      .limit(countToDelete)
      .toArray();

    const commentsToDelete = rawCommentsToDelete
      .map((raw) => this.parsePersistedComment(raw))
      .filter((c): c is PersistedComment => c !== undefined);

    const setOfAffectedPostKeys = new Set<string>();

    const bulkDeleteCommentKeys: Array<[VkId, PositiveVkId, PositiveVkId]> = [];
    for (const comment of commentsToDelete) {
      bulkDeleteCommentKeys.push([
        comment.wallVkId,
        comment.postVkId,
        comment.commentVkId,
      ]);
      setOfAffectedPostKeys.add(`${comment.wallVkId}:${comment.postVkId}`);
    }

    await commentsTable.bulkDelete(bulkDeleteCommentKeys);

    // Delete posts that have no remaining comments

    const bulkDeletePostKeys: Array<[VkId, PositiveVkId]> = [];
    for (const postKey of setOfAffectedPostKeys) {
      const [wallVkIdStr, postVkIdStr] = postKey.split(":");
      const wallVkId = vkIdSchema.parse(Number(wallVkIdStr));
      const postVkId = positiveVkIdSchema.parse(Number(postVkIdStr));

      const remainingCommentCount = await commentsTable
        .where("[wallVkId+postVkId+commentVkId]")
        .between(
          [wallVkId, postVkId, -Infinity],
          [wallVkId, postVkId, Infinity],
        )
        .count();

      if (remainingCommentCount === 0) {
        bulkDeletePostKeys.push([wallVkId, postVkId]);
      }
    }
    await postsTable.bulkDelete(bulkDeletePostKeys);

    // Check for walls that are now skipped and delete their data
    const allWallVkIds = new Set<VkId>();
    const remainingCommentsRaw = await commentsTable.toArray();
    const remainingComments = remainingCommentsRaw
      .map((raw) => this.parsePersistedComment(raw))
      .filter((c): c is PersistedComment => c !== undefined);

    for (const comment of remainingComments) {
      allWallVkIds.add(comment.wallVkId);
    }

    for (const wallVkId of allWallVkIds) {
      const isSkipped = await this.checkIfWallSkipped(wallVkId);
      if (isSkipped) {
        // Delete all comments for this wall
        const wallComments = remainingComments.filter(
          (c) => c.wallVkId === wallVkId,
        );

        for (const comment of wallComments) {
          await commentsTable.delete([
            comment.wallVkId,
            comment.postVkId,
            comment.commentVkId,
          ]);
        }

        // Delete all posts for this wall
        const allPostsRaw = await postsTable.toArray();
        const allPosts = allPostsRaw
          .map((raw) => this.parsePersistedPost(raw))
          .filter((p): p is PersistedPost => p !== undefined);

        const wallPosts = allPosts.filter((p) => p.wallVkId === wallVkId);

        for (const post of wallPosts) {
          await postsTable.delete([post.wallVkId, post.postVkId]);
        }

        logger.debug("Deleted all data for skipped wall {wallVkId}", {
          wallVkId,
        });
      }
    }

    logger.info("Pruned {count} comments", { count: commentsToDelete.length });

    this.state = "idle";
  }

  private resetWithDebounce(): void {
    if (this.resettingDebounceTimeout) {
      clearTimeout(this.resettingDebounceTimeout);
    }
    this.resettingDebounceTimeout = setTimeout(
      () => void this.resetIfNeeded(),
      resetDebounceTimeout,
    );
  }

  async resetIfNeeded(): Promise<void> {
    await this.waitForIdle();

    const userOptedIn = await this.checkIfUserOptedIn();
    if (userOptedIn === true || userOptedIn === "maybe") {
      return;
    }

    this.state = "resetting";

    await this.getCommentsTable().clear();
    await this.getPostsTable().clear();

    this.notYetPersistedComments = [];

    this.state = "idle";

    logger.info("Service was reset");
  }
}
