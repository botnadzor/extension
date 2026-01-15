import { IntlMessageFormat } from "intl-messageformat";
import {
  ChevronDownIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  StarIcon,
  ThumbsUpIcon,
} from "lucide-react";
import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/@ui-primitives/accordion";
import { ScrollArea, ScrollBar } from "@/shared/@ui-primitives/scroll-area";
import {
  useAccountInspection,
  useAuthStatus,
} from "@/shared/pollable-value-hooks";
import type { VkDomain } from "@/shared/primitive-values";
import { cn } from "@/shared/tailwindcss-helpers";

import { OptionalMark } from "./optional-mark";
import { Placeholder } from "./placeholder";

const commentTitleMessage = new IntlMessageFormat(
  "{commentCount, plural, one {# комментарий} few {# комментария} other {# комментариев}} в {groupCount, plural, one {# группе} other {# группах}}",
  "ru",
);

const reviewTitleMessage = new IntlMessageFormat(
  "{commentCount, plural, one {# отзыв} few {# отзыва} other {# отзывов}} в {groupCount, plural, =1 {группе} other {группах}}",
  "ru",
);

const likeTitleMessage = new IntlMessageFormat(
  "{likeCount, plural, one {# лайк} few {# лайка} other {# лайков}} {botCount, plural, one {# боту} other {# ботам}}",
  "ru",
);

const advancedCommentTitleMessage = new IntlMessageFormat(
  "Комментарии в {groupCount, plural, one {# дополнительной группе} other {# дополнительных группах}}",
  "ru",
);

type Comment = NonNullable<
  (ReturnType<typeof useAccountInspection> & {
    success: true;
  })["data"]["comments"]
>[number];

type LikeToBot = NonNullable<
  (ReturnType<typeof useAccountInspection> & {
    success: true;
  })["data"]["likes"]
>[number];

type LikeLink = LikeToBot["links"][number];

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <>
      {/* Colored dot indicator */}
      <div
        className="size-2 rounded-full"
        style={{
          backgroundColor: comment.color ?? "transparent",
        }}
      />

      {/* Auto-sized count, right-aligned */}
      <span className="text-right font-medium">
        {comment.count !== undefined && comment.count !== null ? (
          comment.count.toLocaleString("ru")
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

      {/* Review */}
      {comment.mark === undefined ? (
        <div />
      ) : (
        <div
          className="
            flex shrink-0 items-center gap-1 pr-3.5 text-muted-foreground
          "
        >
          <StarIcon className="size-3" />
          {String(comment.mark)}
        </div>
      )}
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
        {like.links.length.toLocaleString("ru")}
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

  if (!accountInspection.success) {
    return (
      <Placeholder className="bg-destructive/10 text-destructive">
        Ошибка загрузки данных: {accountInspection.reason}
      </Placeholder>
    );
  }

  const data = accountInspection.data;

  const hasComments = data.comments && data.comments.length > 0;
  const hasLikes = data.likes && data.likes.length > 0;
  const hasReviews = data.reviews && data.reviews.length > 0;
  const hasCommentsAdvanced =
    data.commentsAdvanced && data.commentsAdvanced.length > 0;

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
          <AccordionItem value="comments" disabled={!hasComments}>
            <AccordionTrigger>
              <div className="flex items-center gap-2.5 text-sm">
                <MessageCircleIcon className="size-4" />
                <span>
                  {hasComments
                    ? commentTitleMessage.format(
                        calculateCommentSummary(data.comments),
                      )
                    : "Комментарии в группах не найдены"}
                </span>
              </div>
            </AccordionTrigger>
            {hasComments && (
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                {data.comments.map((comment, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <CommentRow key={index} comment={comment} />
                ))}
              </AccordionContent>
            )}
          </AccordionItem>

          <AccordionItem value="likes" disabled={!hasLikes}>
            <AccordionTrigger>
              <div className="flex items-center gap-2.5 text-sm">
                <ThumbsUpIcon className="size-4" />
                <span>
                  {hasLikes
                    ? likeTitleMessage.format(calculateLikeSummary(data.likes))
                    : "Лайки ботам не найдены"}
                </span>
              </div>
            </AccordionTrigger>
            {hasLikes && (
              <AccordionContent childClassName="pr-2.5 grid gap-2 grid-cols-[auto_1fr]">
                {data.likes.map((like, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <LikeRow key={index} like={like} />
                ))}
              </AccordionContent>
            )}
          </AccordionItem>

          <AccordionItem value="reviews" disabled={!hasReviews}>
            <AccordionTrigger>
              <div className="flex items-center gap-2.5 text-sm">
                <StarIcon className="size-4" />
                <span>
                  {hasReviews
                    ? reviewTitleMessage.format(
                        calculateCommentSummary(data.reviews),
                      )
                    : "Отзывы в группах не найдены"}
                </span>
              </div>
            </AccordionTrigger>
            {hasReviews && (
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                {data.reviews.map((comment, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <CommentRow key={index} comment={comment} />
                ))}
              </AccordionContent>
            )}
          </AccordionItem>

          {authStatus.state === "valid" && authStatus.accessLevel === 4 && (
            <AccordionItem
              value="comments-advanced"
              disabled={!hasCommentsAdvanced}
            >
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <MessageSquareTextIcon className="size-4" />
                  <span>
                    {hasCommentsAdvanced
                      ? advancedCommentTitleMessage.format({
                          groupCount: data.commentsAdvanced.length,
                        })
                      : "Комментарии в дополнительных группах не найдены"}
                  </span>
                </div>
              </AccordionTrigger>
              {hasCommentsAdvanced && (
                <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                  {data.commentsAdvanced.map((comment, index) => (
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                    <CommentRow key={index} comment={comment} />
                  ))}
                </AccordionContent>
              )}
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </ScrollArea>
  );
}
