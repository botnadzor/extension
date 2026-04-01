import Markdown from "marked-react";
import * as React from "react";

import {
  useFilteredAnnouncements,
  useFrontendBaseUrl,
} from "@/shared/@ui-helpers/data-hooks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/@ui-primitives/accordion";
import { formatDate } from "@/shared/formatting";

const accordionScrollDelayMs = 300;

export function AnnouncementsTabBody() {
  const announcements = useFilteredAnnouncements("default");
  const frontendBaseUrl = useFrontendBaseUrl();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = React.useRef<number | undefined>(undefined);

  // Show newer announcements first
  const announcementsToShow = announcements.toSorted((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const scrollContentIntoView = React.useEffectEvent((createdAt: string) => {
    const containerElement = containerRef.current;
    if (!containerElement) {
      return;
    }

    const itemElement = containerElement.querySelector<HTMLElement>(
      `[data-created-at="${CSS.escape(createdAt)}"]`,
    );
    if (!itemElement) {
      return;
    }

    itemElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== undefined) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Accordion ref={containerRef} className="px-3 py-2">
      {announcementsToShow.map(({ createdAt, header, content }) => (
        <AccordionItem
          data-created-at={createdAt}
          key={createdAt}
          onOpenChange={(open) => {
            if (!open) {
              return;
            }

            if (scrollTimeoutRef.current !== undefined) {
              window.clearTimeout(scrollTimeoutRef.current);
            }

            scrollTimeoutRef.current = window.setTimeout(() => {
              scrollContentIntoView(createdAt);
              scrollTimeoutRef.current = undefined;
            }, accordionScrollDelayMs);
          }}
          value={createdAt}
        >
          <AccordionTrigger>
            <div className="flex w-full flex-col items-start text-left">
              <div className="text-sm/snug text-pretty">{header}</div>
              <div className="pt-0.5 text-xs text-muted-foreground">
                {formatDate(createdAt)}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div
              className="
                prose-sm
                prose-ol:list-decimal prose-ol:pl-4
                prose-ul:list-['–'] prose-ul:pl-2.5
                [&_a]:u-link
              "
            >
              <Markdown baseURL={frontendBaseUrl} value={content} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
