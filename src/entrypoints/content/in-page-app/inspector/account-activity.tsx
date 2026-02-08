import {
  ChevronDownIcon,
  HeartIcon,
  MessageSquareMoreIcon,
  MessageSquarePlusIcon,
  StarIcon,
} from "lucide-react";
import * as React from "react";

import type { VkDomain } from "@/shared/@model/primitives";
import {
  useAccountInspection,
  useAuthStatus,
} from "@/shared/@ui-helpers/data-hooks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/@ui-primitives/accordion";
import { ScrollArea, ScrollBar } from "@/shared/@ui-primitives/scroll-area";
import { createMessage, formatInt } from "@/shared/formatting";
import { cn } from "@/shared/tailwindcss-helpers";

import { OptionalMark } from "./optional-mark";
import { Placeholder } from "./placeholder";

const commentTitleMessage = createMessage(
  "{commentCount, plural, one {# комментарий} few {# комментария} other {# комментариев}} в {groupCount, plural, one {# группе} other {# группах}}",
);

const reviewTitleMessage = createMessage(
  "{commentCount, plural, one {# отзыв} few {# отзыва} other {# отзывов}} в {groupCount, plural, =1 {группе} other {группах}}",
);

const likeTitleMessage = createMessage(
  "{likeCount, plural, one {# лайк} few {# лайка} other {# лайков}} {botCount, plural, one {# боту} other {# ботам}}",
);

const advancedCommentTitleMessage = createMessage(
  "Комментарии в {groupCount, plural, one {# другой группе} other {# других группах}} (уровень 4)",
);

type Comment = NonNullable<
  (ReturnType<typeof useAccountInspection> & {
    problem?: never;
  })["legacy"]["comments"]
>[number];

type LikeToBot = NonNullable<
  (ReturnType<typeof useAccountInspection> & {
    problem?: never;
  })["legacy"]["likes"]
>[number];

type LikeLink = LikeToBot["links"][number];

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <>
      {/* Colored dot indicator */}
      <div
        className="size-2 rounded-full"
        title={comment.reg_name ?? undefined}
        style={comment.color ? { backgroundColor: comment.color } : undefined}
      />

      {/* Auto-sized count, right-aligned */}
      <span className="text-right font-medium">
        {comment.count !== undefined && comment.count !== null ? (
          formatInt(comment.count)
        ) : (
          <>&minus;</>
        )}
      </span>

      <div className="flex min-w-0 items-center gap-2">
        <a
          href={comment.link}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex items-center gap-2 overflow-hidden u-link rounded-full pr-1
          "
        >
          <span className="size-5 shrink-0 overflow-hidden rounded-full bg-border">
            {comment.photo && (
              <img src={comment.photo} alt="" className="size-5 object-cover" />
            )}
          </span>
          <span>{comment.name}</span>
        </a>
      </div>
    </>
  );
}

function ReviewRow({ comment }: { comment: Comment }) {
  return (
    <>
      {/* Colored dot indicator */}
      <div
        className="size-2 rounded-full"
        title={comment.reg_name ?? undefined}
        style={{
          backgroundColor: comment.color ?? "transparent",
        }}
      />

      {/* Star rating */}
      <div
        className="
          flex shrink-0 items-center gap-1 pr-0.5 text-muted-foreground
        "
      >
        <StarIcon className="size-3" />
        {String(comment.mark)}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <a
          href={comment.link}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex items-center gap-2 overflow-hidden u-link rounded-full pr-1
          "
        >
          <span className="size-5 shrink-0 overflow-hidden rounded-full bg-border">
            {comment.photo && (
              <img src={comment.photo} alt="" className="size-5 object-cover" />
            )}
          </span>
          <span>{comment.name}</span>
        </a>
      </div>
    </>
  );
}

function LikeDetailsRow({ link }: { link: LikeLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.data}
      className="
        rounded-full u-ring transition-opacity
        hover:opacity-60
      "
    >
      {link.src && (
        <img src={link.src} alt={link.data} className="size-5 rounded-full" />
      )}
    </a>
  );
}

function LikeRow({ like }: { like: LikeToBot }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <>
      <div className="text-right font-medium tabular-nums">
        {formatInt(like.links.length)}
      </div>
      <div>
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div
            className={cn(
              "flex min-w-0 shrink-0 items-center gap-2",
              (like.photos.length === 0 || expanded) && "grow",
            )}
          >
            <a
              href={`https://vk.com/id${like.bot_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="u-link whitespace-nowrap"
            >
              {like.bot_name ?? `id${like.bot_id}`}
            </a>

            <OptionalMark
              mark={like.mark ?? undefined}
              markTitle={like.mark_title ?? undefined}
              markColor={like.mark_color ?? undefined}
            />
          </div>

          {like.photos.length > 0 && (
            <div
              className={cn(
                "flex flex-1 flex-wrap justify-end gap-1",
                expanded && "hidden",
              )}
            >
              {like.photos.map((photo, index) => (
                <img
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  key={index}
                  src={photo.src ?? undefined}
                  alt={photo.title}
                  title={photo.title}
                  className="size-5 rounded-full object-cover"
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded);
            }}
            className={cn(
              `
                flex size-5 shrink-0 items-center justify-center rounded-sm
                bg-muted text-foreground/50 u-ring transition-colors
                hover:text-foreground
              `,

              expanded && "[&_svg]:rotate-180",
            )}
          >
            <ChevronDownIcon className="size-4 shrink-0 transition-all duration-200" />
          </button>
        </div>

        {expanded && like.links.length > 0 && (
          <div className="flex gap-2 py-1 pr-3">
            <span className="text-muted-foreground">Лайки:</span>
            <div className="flex flex-wrap gap-1">
              {like.links.map((link, index) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                <LikeDetailsRow key={index} link={link} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function calculateCommentSummary(comments: readonly Comment[] | undefined) {
  if (!comments || comments.length === 0) {
    return { commentCount: 0, groupCount: 0 };
  }

  const groupCount = comments.length;

  const hasCount = comments.some(
    (comment) => typeof comment.count === "number",
  );

  if (!hasCount) {
    return { commentCount: groupCount, groupCount };
  }

  const commentCount = comments.reduce(
    (acc, comment) => acc + (comment.count ?? 0),
    0,
  );

  return { commentCount, groupCount };
}

function calculateLikeSummary(likes: readonly LikeToBot[] | undefined) {
  if (!likes || likes.length === 0) {
    return { likeCount: 0, botCount: 0 };
  }

  const botCount = likes.length;
  const likeCount = likes.reduce((acc, like) => acc + like.links.length, 0);

  return { likeCount, botCount };
}

export function AccountActivity({ vkDomain }: { vkDomain: VkDomain }) {
  const accountInspection = useAccountInspection(vkDomain);
  const authStatus = useAuthStatus();

  if (accountInspection.problem) {
    return (
      <Placeholder className="bg-destructive/10 text-destructive">
        {accountInspection.description || accountInspection.type}
      </Placeholder>
    );
  }

  const legacyData = accountInspection.legacy;

  const hasComments = legacyData.comments && legacyData.comments.length > 0;
  const hasLikes = legacyData.likes && legacyData.likes.length > 0;
  const hasReviews = legacyData.reviews && legacyData.reviews.length > 0;
  const hasCommentsAdvanced =
    legacyData.comments_advanced && legacyData.comments_advanced.length > 0;

  return (
    <ScrollArea
      scrollBar={<ScrollBar className="mt-1.5 h-[calc(100%---spacing(2))]" />}
      className={cn(
        "absolute!", // overriding position:relative in ScrollArea's inline style
        "inset-0",
      )}
    >
      <div className="p-3 pt-2 text-sm">
        <Accordion type="multiple" className="-mt-px tabular-nums">
          {hasComments && (
            <AccordionItem value="comments">
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <MessageSquareMoreIcon className="size-4" />
                  <span>
                    {commentTitleMessage.format(
                      calculateCommentSummary(legacyData.comments ?? undefined),
                    )}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr] items-center gap-2">
                {legacyData.comments?.map((comment, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <CommentRow key={index} comment={comment} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {hasLikes && (
            <AccordionItem value="likes">
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <HeartIcon className="size-4" />
                  <span>
                    {likeTitleMessage.format(
                      calculateLikeSummary(legacyData.likes ?? undefined),
                    )}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="pr-2.5 grid gap-2 grid-cols-[auto_1fr]">
                {legacyData.likes?.map((like, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <LikeRow key={index} like={like} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {hasReviews && (
            <AccordionItem value="reviews">
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <StarIcon className="size-4" />
                  <span>
                    {reviewTitleMessage.format(
                      calculateCommentSummary(legacyData.reviews ?? undefined),
                    )}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr] items-center gap-2">
                {legacyData.reviews?.map((comment, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <ReviewRow key={index} comment={comment} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {authStatus.state === "valid" &&
            authStatus.accessLevel === 4 &&
            hasCommentsAdvanced && (
              <AccordionItem value="comments-advanced">
                <AccordionTrigger>
                  <div className="flex items-center gap-2.5 text-sm">
                    <MessageSquarePlusIcon className="size-4" />
                    <span>
                      {advancedCommentTitleMessage.format({
                        groupCount: legacyData.comments_advanced?.length ?? 0,
                      })}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr] items-center gap-2">
                  {legacyData.comments_advanced?.map((comment, index) => (
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                    <CommentRow key={index} comment={comment} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
        </Accordion>
      </div>
    </ScrollArea>
  );
}
