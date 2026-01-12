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
} from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAccountInspection } from "@/hooks/inspector-service";
import type { VkDomain } from "@/lib/primitive-values";
import { cn } from "@/lib/utils";

import type { responseSchema } from "../../../background/dynamic-api-endpoints/=inspector";
import { OptionalMark } from "./optional-mark";
import { Placeholder } from "./placeholder";

type Comment = NonNullable<
  NonNullable<ReturnType<(typeof responseSchema)["parse"]>["comments"]>[number]
>;

type LikeToBot = NonNullable<
  NonNullable<ReturnType<(typeof responseSchema)["parse"]>["likes"]>[number]
>;

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
      <span className="text-right text-sm font-medium">
        {comment.count !== undefined && comment.count !== null ? (
          comment.count.toLocaleString("ru-RU")
        ) : (
          <>&minus;</>
        )}
      </span>

      <div className="flex min-w-0 items-center gap-2">
        <a
          href={comment.link}
          target="_blank"
          rel="noreferrer"
          className="size-5 shrink-0 overflow-hidden rounded-sm bg-border"
        >
          {comment.photo && (
            <img src={comment.photo} alt="" className="size-5 object-cover" />
          )}
        </a>

        <a
          href={comment.link}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 u-link text-sm"
        >
          {comment.name}
        </a>
      </div>

      {/* Star rating */}
      {comment.mark === undefined ? (
        <div />
      ) : (
        <div
          className="
            flex shrink-0 items-center gap-1 text-xs text-muted-foreground
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
      rel="noreferrer"
      title={link.data}
      className="
        opacity-60 transition-opacity
        hover:opacity-100
      "
    >
      {link.src && (
        <img src={link.src} alt={link.data} className="size-5 rounded-sm" />
      )}
    </a>
  );
}

function LikeRow({ like }: { like: LikeToBot }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-md pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {like.links.length.toLocaleString("ru-RU")}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <a
              href={`https://vk.com/id${like.bot_id}`}
              target="_blank"
              rel="noreferrer"
              className="u-link text-sm"
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
            <div className="flex shrink-0 flex-wrap gap-1">
              {like.photos.map((photo, index) => (
                <img
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  key={index}
                  src={photo.src ?? undefined}
                  alt={photo.title}
                  title={photo.title}
                  className="size-5 rounded-sm object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className={cn(
            `
              flex size-6 shrink-0 items-center justify-center rounded-sm
              bg-muted u-ring transition-colors
              hover:bg-muted/60
            `,

            expanded && "[&_svg]:rotate-180",
          )}
        >
          <ChevronDownIcon
            className="
              size-4 shrink-0 text-muted-foreground transition-transform
              duration-200
            "
          />
        </button>
      </div>

      {expanded && like.links.length > 0 && (
        <div
          className="
            mt-2 mr-0.5 flex flex-wrap items-center gap-2 border-t
            border-t-border pt-2 pb-3
          "
        >
          <span className="text-sm text-muted-foreground">Лайки:</span>
          <div className="flex flex-wrap gap-1.5">
            {like.links.map((link, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
              <LikeDetailsRow key={index} link={link} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getCommentsSum(comments: readonly Comment[] | undefined): string {
  if (!comments || comments.length === 0) {
    return "0";
  }

  const hasCount = comments.some(
    (comment) => typeof comment.count === "number",
  );

  if (!hasCount) {
    return comments.length.toLocaleString("ru-RU");
  }

  const sum = comments.reduce((acc, comment) => acc + (comment.count ?? 0), 0);
  return sum.toLocaleString("ru-RU");
}

function getLikesSum(likes: readonly LikeToBot[] | undefined): string {
  if (!likes || likes.length === 0) {
    return "0";
  }

  const sum = likes.reduce((acc, like) => acc + like.links.length, 0);
  return sum.toLocaleString("ru-RU");
}

export function AccountActivity({ vkDomain }: { vkDomain: VkDomain }) {
  const accountInspection = useAccountInspection(vkDomain);

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

  const hasAnyActivity =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- mixed booleans and undefined values
    hasComments || hasLikes || hasReviews || hasCommentsAdvanced;

  if (!hasAnyActivity) {
    return (
      <Placeholder className="bg-muted p-4 text-sm text-muted-foreground">
        Подозрительная активность не обнаружена
      </Placeholder>
    );
  }

  return (
    <ScrollArea
      scrollBar={<ScrollBar className="mt-1.5 h-[calc(100%---spacing(2))]" />}
      className={cn(
        "absolute!", // overriding position:relative in ScrollArea's inline style
        "inset-0",
      )}
    >
      <div className="p-3 pt-2">
        <Accordion type="multiple" className="-mt-px tabular-nums">
          {hasComments && (
            <AccordionItem value="comments">
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <MessageCircleIcon className="ml-0.5 size-4" />
                  <span>
                    Комментарии в группах ({getCommentsSum(data.comments)})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                {data.comments.map((comment, index) => (
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
                  <ThumbsUpIcon className="ml-0.5 size-4" />
                  <span>Лайки ботам ({getLikesSum(data.likes)})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="pr-2">
                {data.likes.map((like, index) => (
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
                  <StarIcon className="ml-0.5 size-4" />
                  <span>Отзывы в группах ({getCommentsSum(data.reviews)})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                {data.reviews.map((comment, index) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- stable data from API for a given account
                  <CommentRow key={index} comment={comment} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {hasCommentsAdvanced && (
            <AccordionItem value="comments-advanced">
              <AccordionTrigger>
                <div className="flex items-center gap-2.5 text-sm">
                  <MessageSquareTextIcon className="ml-0.5 size-4" />
                  <span>
                    Комментарии в группах, уровень 4 (
                    {getCommentsSum(data.commentsAdvanced)})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent childClassName="px-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2">
                {data.commentsAdvanced.map((comment, index) => (
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
